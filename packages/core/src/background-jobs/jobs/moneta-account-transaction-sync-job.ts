import { ok, type Run } from "@evolu/common"
import {
  type MonetaPluginNotFoundError,
  type MonetaSyncError,
  syncMonetaTransactions,
  updateMonetaPluginSyncPointer,
} from "../../modules/moneta-plugin/moneta-plugin-actions.ts"
import {
  activeMonetaPluginsQuery,
  monetaPluginSyncPointerByPluginIdQuery,
} from "../../modules/moneta-plugin/moneta-plugin-queries.ts"
import type { MonetaPluginId } from "../../modules/moneta-plugin/moneta-plugin-types.ts"
import {
  addMonetaBankDays,
  earliestMonetaReadableDay,
  monetaBankDay,
  monetaFirstSyncStartDate,
  monetaPluginCheckIntervalSeconds,
} from "../../modules/moneta-plugin/moneta-plugin-utils.ts"
import type { DateString } from "../../modules/shared/schema.ts"
import type {
  BackgroundJob,
  BackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"
import { reconcileAccountSyncSessions } from "../reconcile-account-sync-sessions.ts"

type Context = BackgroundJobContext

/**
 * The windows one call of `syncMonetaTransactions` reads, widest first, as
 * the last bank day each includes: a week of a busy merchant fits the pages
 * one sync reads, two months of it may not. A window the bank lists more
 * pages for is read again in the next narrower one. A day is the narrowest:
 * the bank filters by date alone, so an hour lists the whole day again
 * (moneta/0006).
 */
const narrowestMonetaSyncWindow = (fromDate: DateString): DateString => fromDate
const MONETA_SYNC_WINDOWS: ReadonlyArray<(fromDate: DateString) => DateString> =
  [(fromDate) => addMonetaBankDays(fromDate, 6), narrowestMonetaSyncWindow]

const earlierDay = (a: DateString, b: DateString): DateString => (a < b ? a : b)
const MONETA_MAX_RETRY_BACKOFF_MS = 15 * 60 * 1000

export const getMonetaRetryBackoffMs = (
  checkIntervalSeconds: number,
  failedSyncCount: number
): number =>
  Math.min(
    checkIntervalSeconds * 1000 * 2 ** (failedSyncCount - 1),
    MONETA_MAX_RETRY_BACKOFF_MS
  )

const loadActiveMonetaPlugins = (deps: Context) =>
  deps.evolu.loadQuery(activeMonetaPluginsQuery)

type ActiveMonetaPlugin = Awaited<
  ReturnType<typeof loadActiveMonetaPlugins>
>[number]

/**
 * MONETA's slow speed (moneta/0002): every active plugin is synced on its
 * interval, the sync pointer advancing as with Fio. The fast one is the
 * payment-wait screen, which runs the same `syncMonetaTransactions`.
 */
export const createMonetaAccountTransactionSyncJob =
  (): BackgroundJob => (run) => {
    // A fresh scope that lives as long as the job — see the Fio job.
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("moneta-account-transaction-sync-job"),
    })
    const sync = new MonetaAccountTransactionSync(jobRun)

    sync.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => sync.dispose())

    return ok(disposer)
  }

export const startMonetaAccountTransactionSyncJob =
  createMonetaAccountTransactionSyncJob()

class MonetaAccountTransactionSync {
  private readonly pluginSyncs = new Map<MonetaPluginId, MonetaPluginSync>()
  private readonly unsubscribePlugins: () => void
  private readonly run: Run<Context>
  private readonly refreshQueue = createKeyedTaskQueue<"refresh">({
    onError: (error) => this.run.deps.onError(error),
  })

  constructor(run: Run<Context>) {
    this.run = run
    this.unsubscribePlugins = run.deps.evolu.subscribeQuery(
      activeMonetaPluginsQuery
    )(() => {
      this.queueRefresh()
    })
  }

  start(): void {
    this.run.deps.console.info("Started MONETA account transaction sync job.")
    this.queueRefresh()
  }

  async dispose(): Promise<void> {
    if (this.refreshQueue.isDisposed) return

    this.unsubscribePlugins()
    await this.refreshQueue[Symbol.asyncDispose]()

    for (const sync of this.pluginSyncs.values()) {
      await sync.dispose()
    }
    this.pluginSyncs.clear()
    this.run.deps.console.info("Stopped MONETA account transaction sync job.")
  }

  private queueRefresh(): void {
    this.refreshQueue.enqueue("refresh", () => this.refreshPlugins())
  }

  private async refreshPlugins(): Promise<void> {
    const plugins = await loadActiveMonetaPlugins(this.run.deps)

    await reconcileAccountSyncSessions({
      sessions: this.pluginSyncs,
      activeAccounts: plugins,
      getKey: (plugin) => plugin.id,
      matches: (sync, plugin) => sync.matches(plugin),
      createSession: (plugin) => {
        const sync = new MonetaPluginSync(this.run, plugin)
        sync.start()
        return sync
      },
      disposeSession: (sync) => sync.dispose(),
      onSessionStopped: (pluginId) => {
        this.run.deps.console.info("Stopped MONETA plugin sync.", { pluginId })
      },
      onSessionStarted: (pluginId, plugin, replacedExistingSync) => {
        this.run.deps.console.info("Started MONETA plugin sync.", {
          accountId: plugin.accountId,
          pluginId,
          replacedExistingSync,
        })
      },
    })
  }
}

class MonetaPluginSync {
  private readonly timer: ReturnType<typeof setInterval>
  private readonly run: Run<Context>
  private readonly plugin: ActiveMonetaPlugin
  private failedSyncCount = 0
  private nextRetryAt: number | null = null
  /**
   * Set once the bank refuses the token. Every further call would only spend
   * the daily limit, so the session stops asking until the plugin changes —
   * a new token restarts it (`matches`). Kept in memory only: the next app
   * start tries once more, which is also what notices a token the merchant
   * re-enabled in the bank.
   */
  private isUnauthorized = false
  private readonly syncQueue = createKeyedTaskQueue<"sync">({
    onError: (error) => this.run.deps.onError(error),
  })

  constructor(run: Run<Context>, plugin: ActiveMonetaPlugin) {
    this.run = run
    this.plugin = plugin
    this.timer = setInterval(() => {
      this.queueSync()
    }, monetaPluginCheckIntervalSeconds(plugin.numberOfSecondsBetweenChecks) *
      1000)
    ;(this.timer as { readonly unref?: () => void }).unref?.()
  }

  start(): void {
    this.queueSync()
  }

  async dispose(): Promise<void> {
    if (this.syncQueue.isDisposed) return

    clearInterval(this.timer)
    await this.syncQueue[Symbol.asyncDispose]()
  }

  matches(plugin: ActiveMonetaPlugin): boolean {
    return (
      this.plugin.accountId === plugin.accountId &&
      this.plugin.token === plugin.token &&
      this.plugin.monetaAccountId === plugin.monetaAccountId &&
      this.plugin.numberOfSecondsBetweenChecks ===
        plugin.numberOfSecondsBetweenChecks &&
      this.plugin.iban === plugin.iban &&
      this.plugin.currency === plugin.currency
    )
  }

  private queueSync(): void {
    if (this.isUnauthorized) return
    if (
      this.nextRetryAt !== null &&
      this.run.deps.date.now().getTime() < this.nextRetryAt
    )
      return
    this.syncQueue.enqueue("sync", () => this.syncTransactions())
  }

  private async syncTransactions(): Promise<void> {
    try {
      const succeeded = await this.syncTransactionsOnce()
      if (succeeded) {
        this.failedSyncCount = 0
        this.nextRetryAt = null
      } else {
        this.delayNextSync()
      }
    } catch (error) {
      this.delayNextSync()
      throw error
    }
  }

  private delayNextSync(): void {
    this.failedSyncCount += 1
    const retryInMs = getMonetaRetryBackoffMs(
      monetaPluginCheckIntervalSeconds(
        this.plugin.numberOfSecondsBetweenChecks
      ),
      this.failedSyncCount
    )
    this.nextRetryAt = this.run.deps.date.now().getTime() + retryInMs
    this.run.deps.console.warn("Delayed MONETA sync after a failed attempt.", {
      accountId: this.plugin.accountId,
      failedSyncCount: this.failedSyncCount,
      pluginId: this.plugin.id,
      retryInMs,
    })
  }

  /**
   * Syncs from the pointer up to now a week at a time, saving the pointer
   * after each window, so a long gap — a first sync, a token refused for
   * months — is read in windows that fit `MONETA_MAX_PAGES`. A window the
   * bank lists more pages for is read again a day at a time
   * (`MONETA_SYNC_WINDOWS`) rather than moving past its unread transfers,
   * to the end of that window, and only then a week again (moneta/0007): the
   * rest of a week the bank listed too much for is not asked for whole
   * again. A narrower window that would end
   * on the day the truncated one did — both clamped to today — is not asked
   * for. A day still too long is passed with what was read of it and
   * logged: no narrower request reads more of it (moneta/0006). Windows are
   * bank days (`monetaBankDay`, moneta/0008); today's is read again on the
   * next sync, as it is not over yet.
   * `false` when the bank answered with an error the session handles itself.
   */
  private async syncTransactionsOnce(): Promise<boolean> {
    const now = this.run.deps.date.now()
    const today = monetaBankDay(now)
    let fromDate = await this.getSyncStart(now)
    let windowIndex = 0
    /** The last day of the window the bank listed too much for. */
    let narrowedUntil: DateString | null = null

    while (!this.syncQueue.isDisposed) {
      const windowEnd =
        MONETA_SYNC_WINDOWS[windowIndex] ?? narrowestMonetaSyncWindow
      const toDate = earlierDay(windowEnd(fromDate), today)
      const result = await this.run(
        syncMonetaTransactions({
          fromDate,
          toDate,
          isStopped: () => this.syncQueue.isDisposed,
        })
      )

      if (!result.ok) return this.handleSyncError(result.error, fromDate)
      if (result.value.isTruncated) {
        const narrowerIndex = MONETA_SYNC_WINDOWS.findIndex(
          (narrowerEnd, index) =>
            index > windowIndex &&
            earlierDay(narrowerEnd(fromDate), today) < toDate
        )
        if (narrowerIndex !== -1) {
          windowIndex = narrowerIndex
          narrowedUntil ??= toDate
          this.run.deps.console.warn(
            "Narrowed the MONETA sync window because the bank listed more pages than one sync reads.",
            { pluginId: this.plugin.id, fromDate, toDate }
          )
          continue
        }
        this.run.deps.console.error(
          "Skipped MONETA transactions the bank listed beyond the pages one sync reads.",
          { pluginId: this.plugin.id, fromDate, toDate }
        )
      }
      if (this.syncQueue.isDisposed) return true

      if (toDate >= today) {
        await this.run.ok(
          updateMonetaPluginSyncPointer({ lastSyncedDate: today })
        )
        return true
      }
      fromDate = addMonetaBankDays(toDate, 1)
      await this.run.ok(
        updateMonetaPluginSyncPointer({ lastSyncedDate: fromDate })
      )
      if (narrowedUntil === null || toDate >= narrowedUntil) {
        windowIndex = 0
        narrowedUntil = null
      }
    }
    return true
  }

  private handleSyncError(
    error: MonetaSyncError | MonetaPluginNotFoundError,
    fromDate: DateString
  ): boolean {
    switch (error.type) {
      case "MonetaPluginNotFound":
        // Switched off or disconnected since this session started; the
        // query subscription stops the session next.
        return true
      case "MonetaRateLimitError":
        this.run.deps.console.error(
          "Skipped MONETA sync because the daily limit was exceeded.",
          { pluginId: this.plugin.id, responseBody: error.responseBody }
        )
        return false
      case "MonetaUnauthorizedError":
        if (error.code === "NARR") {
          // The window is clamped to the readable history already
          // (`earliestMonetaReadableDay`), so this is the bank changing
          // its mind; back off rather than stop.
          this.run.deps.console.error(
            "MONETA requires strong authentication for the sync period.",
            { pluginId: this.plugin.id, fromDate }
          )
          return false
        }
        this.isUnauthorized = true
        this.run.deps.console.warn(
          "Stopped MONETA sync because the bank refused the token.",
          { pluginId: this.plugin.id, status: error.status, code: error.code }
        )
        return true
      case "MonetaApiError":
      case "MonetaHttpError":
      case "FetchError":
        throw error
    }
  }

  private async getSyncStart(now: Date): Promise<DateString> {
    const [pointer] = await this.run.deps.evolu.loadQuery(
      monetaPluginSyncPointerByPluginIdQuery(this.plugin.id)
    )
    // The pointer's own day is read again and no earlier one: the bank
    // filters by booking date, which is never before the day a transfer is
    // first listed (moneta/0004).
    const start = pointer?.lastSyncedDate ?? monetaFirstSyncStartDate(now)

    // A pointer set by hand past the readable history would be refused with
    // `NARR` on every attempt, and one in the future would ask for a window
    // that ends before it starts; start where the bank still answers, and
    // no later than today.
    const earliestDay = earliestMonetaReadableDay(now)
    return earlierDay(
      start < earliestDay ? earliestDay : start,
      monetaBankDay(now)
    )
  }
}
