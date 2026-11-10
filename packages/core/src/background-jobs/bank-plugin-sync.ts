import {
  ok,
  type Query,
  type QueryRows,
  type Row,
  type Run,
} from "@evolu/common"
import type { EvoluSchema } from "../evolu/schema.ts"
import type {
  BackgroundJob,
  BackgroundJobContext,
} from "./background-job-types.ts"
import { createKeyedTaskQueue } from "./keyed-task-queue.ts"
import { reconcileAccountSyncSessions } from "./reconcile-account-sync-sessions.ts"

/** The longest a failing bank plugin sync waits between attempts. */
const BANK_PLUGIN_SYNC_MAX_RETRY_BACKOFF_MS = 15 * 60 * 1000

/**
 * How many ticks of the plugin's interval a sync waits after
 * `failedSyncCount` failures in a row before it tries again: the next tick
 * after the first, then twice as many after each further one, up to 15
 * minutes. Counted in ticks rather than against the clock, so the first
 * retry comes one interval after the failure, not two: a deadline of "one
 * interval after the failed sync ended" always lies just past the tick that
 * would have met it.
 */
export const getBankPluginSyncRetryTicks = (
  intervalMs: number,
  failedSyncCount: number
): number =>
  Math.min(
    2 ** Math.max(0, failedSyncCount - 1),
    Math.max(1, Math.floor(BANK_PLUGIN_SYNC_MAX_RETRY_BACKOFF_MS / intervalMs))
  )

/**
 * How one sync went: `synced`, `failed` (the next ones back off, as after a
 * throw, without reporting an error), `waited` (it asked the bank nothing,
 * so the backoff stays as it was), or `stopped` (the session asks no more
 * until the plugin changes and the job starts a new one).
 */
export type BankPluginSyncOutcome = "synced" | "failed" | "waited" | "stopped"

export interface BankPluginSyncSession extends AsyncDisposable {
  readonly start: () => void
  /** Whether the session was disposed; a sync in progress stops at this. */
  readonly isDisposed: boolean
}

/**
 * One plugin's polling: a sync at start and on every tick of `intervalMs`,
 * one at a time, backing off after failures (`getBankPluginSyncRetryTicks`).
 * A sync that throws counts as failed and is reported through `onError`.
 */
export const createBankPluginSyncSession = ({
  onError,
  intervalMs,
  sync,
  onDelayed,
}: {
  readonly intervalMs: number
  readonly sync: () => Promise<BankPluginSyncOutcome>
  readonly onError: (error: unknown) => void
  readonly onDelayed: (delay: {
    readonly failedSyncCount: number
    readonly retryInMs: number
  }) => void
}): BankPluginSyncSession => {
  const queue = createKeyedTaskQueue<"sync">({ onError })
  let failedSyncCount = 0
  let ticksToSkip = 0
  let isStopped = false

  const delay = (): void => {
    failedSyncCount += 1
    const retryTicks = getBankPluginSyncRetryTicks(intervalMs, failedSyncCount)
    ticksToSkip = retryTicks - 1
    onDelayed({ failedSyncCount, retryInMs: retryTicks * intervalMs })
  }

  const syncOnce = async (): Promise<void> => {
    let outcome: BankPluginSyncOutcome
    try {
      outcome = await sync()
    } catch (error) {
      delay()
      throw error
    }
    if (outcome === "failed") {
      delay()
      return
    }
    if (outcome === "waited") return
    failedSyncCount = 0
    ticksToSkip = 0
    if (outcome === "stopped") isStopped = true
  }

  const queueSync = (): void => {
    if (isStopped) return
    queue.enqueue("sync", syncOnce)
  }

  const timer = setInterval(() => {
    if (ticksToSkip > 0) {
      ticksToSkip -= 1
      return
    }
    queueSync()
  }, intervalMs)
  ;(timer as { readonly unref?: () => void }).unref?.()

  return {
    start: queueSync,
    get isDisposed() {
      return queue.isDisposed
    },
    async [Symbol.asyncDispose]() {
      if (queue.isDisposed) return
      clearInterval(timer)
      await queue[Symbol.asyncDispose]()
    },
  }
}

/** A plugin's sync as the job keeps it: restarted when `matches` fails. */
export interface BankPluginSync<TPlugin> extends AsyncDisposable {
  readonly start: () => void
  readonly matches: (plugin: TPlugin) => boolean
}

/**
 * The background job of a bank plugin (Fio, MONETA): one sync per active
 * plugin, started, restarted and stopped as the plugins query changes.
 */
export const createBankPluginSyncJob =
  <TRow extends Row, TPlugin extends { readonly id: string }>({
    name,
    bank,
    query,
    selectPlugins,
    createPluginSync,
    describePlugin,
  }: {
    /** The job's console child and log name. */
    readonly name: string
    /** The bank as the log lines name it. */
    readonly bank: string
    readonly query: Query<EvoluSchema, TRow>
    /** The rows that can sync, logging the ones that cannot. */
    readonly selectPlugins: (
      rows: QueryRows<TRow>,
      run: Run<BackgroundJobContext>,
      runningCount: number
    ) => ReadonlyArray<TPlugin>
    readonly createPluginSync: (
      run: Run<BackgroundJobContext>,
      plugin: TPlugin
    ) => BankPluginSync<TPlugin>
    /** What "Started … plugin sync." logs besides the plugin id. */
    readonly describePlugin: (plugin: TPlugin) => Record<string, unknown>
  }): BackgroundJob =>
  (run) => {
    // A fresh `run.create()` scope, not the Task's own `run`: that one is
    // disposed the instant this Task function returns, but the syncs keep
    // composing Tasks (via their stored `run`) for as long as the job itself
    // runs. Explicitly disposed with the job — see AGENTS.md and
    // `createRun`'s doc comment on why a detached `createRun` call per
    // transaction leaks a root Evolu never gets to dispose.
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child(name),
    })
    const { console, evolu } = jobRun.deps
    const pluginSyncs = new Map<TPlugin["id"], BankPluginSync<TPlugin>>()
    const refreshQueue = createKeyedTaskQueue<"refresh">({
      onError: (error) => jobRun.deps.onError(error),
    })

    const refresh = async (): Promise<void> => {
      const plugins = selectPlugins(
        await evolu.loadQuery(query),
        jobRun,
        pluginSyncs.size
      )
      await reconcileAccountSyncSessions({
        sessions: pluginSyncs,
        activeAccounts: plugins,
        getKey: (plugin) => plugin.id,
        matches: (sync, plugin) => sync.matches(plugin),
        createSession: (plugin) => {
          const sync = createPluginSync(jobRun, plugin)
          sync.start()
          return sync
        },
        disposeSession: (sync) => sync[Symbol.asyncDispose](),
        onSessionStopped: (pluginId) => {
          console.info(`Stopped ${bank} plugin sync.`, { pluginId })
        },
        onSessionStarted: (pluginId, plugin, replacedExistingSync) => {
          console.info(`Started ${bank} plugin sync.`, {
            ...describePlugin(plugin),
            pluginId,
            replacedExistingSync,
          })
        },
      })
    }
    const queueRefresh = () => refreshQueue.enqueue("refresh", refresh)

    const unsubscribe = evolu.subscribeQuery(query)(queueRefresh)
    console.info(`Started ${bank} account transaction sync job.`)
    queueRefresh()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(async () => {
      if (refreshQueue.isDisposed) return
      unsubscribe()
      await refreshQueue[Symbol.asyncDispose]()
      for (const sync of pluginSyncs.values()) {
        await sync[Symbol.asyncDispose]()
      }
      pluginSyncs.clear()
      console.info(`Stopped ${bank} account transaction sync job.`)
    })

    return ok(disposer)
  }
