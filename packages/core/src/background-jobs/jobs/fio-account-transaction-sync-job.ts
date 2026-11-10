import { type InferRow, ok, type Run, type Task } from "@evolu/common"
import { format, subDays, subMonths } from "date-fns"
import type { DeviceIdDep } from "../../deps.ts"
import {
  createFioApiDep,
  type FioApiDep,
  type FioTransaction,
  fetchFioTransactionsByPeriod,
} from "../../integrations/fio/fio-client.ts"
import type { AccountTransactionId } from "../../modules/account-transaction/account-transaction-types.ts"
import type { DeviceId } from "../../modules/device/device-types.ts"
import { defaultFioPluginSyncLookbackDays } from "../../modules/fio-plugin/fio-plugin-actions.ts"
import {
  activeFioPluginsQuery,
  fioPluginSyncLeaseByPluginIdQuery,
  fioPluginSyncPointerByPluginIdQuery,
  fioSyncDeviceUptimeByDeviceIdQuery,
} from "../../modules/fio-plugin/fio-plugin-queries.ts"
import type { FioPluginId } from "../../modules/fio-plugin/fio-plugin-types.ts"
import { fioSyncDeviceUptimeId } from "../../modules/fio-plugin/fio-plugin-utils.ts"
import {
  loadUnrecordedBankTransactions,
  reconcileUnclaimedBankTransactions,
  recordBankTransactions,
} from "../../modules/reconciliation-claim/bank-sync-actions.ts"
import type { BankTransaction } from "../../modules/reconciliation-claim/reconciliation-claim-types.ts"
import {
  dateStringToDate,
  dateToDateString,
} from "../../modules/shared/date-string-utils.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
import {
  type DateString,
  DateStringSchema,
  IntegerSchema,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  TimestampMsSchema,
} from "../../modules/shared/schema.ts"
import type { BackgroundJobContext } from "../background-job-types.ts"
import {
  type BankPluginSync,
  type BankPluginSyncOutcome,
  type BankPluginSyncSession,
  createBankPluginSyncJob,
  createBankPluginSyncSession,
} from "../bank-plugin-sync.ts"

type Context = BackgroundJobContext & DeviceIdDep

const FIO_FIRST_SYNC_LOOKBACK_MONTHS = 2
const FIO_SYNC_LEASE_MS = 10 * 60 * 1000
const FIO_SYNC_TAKEOVER_UPTIME_MARGIN = 0.1
const FIO_SYNC_UPTIME_TIME_CONSTANT_MS = 24 * 60 * 60 * 1000
const FIO_SYNC_UPTIME_TICK_MS = 60 * 1000
const FIO_SYNC_UPTIME_MAX_TICK_GAP_MS = 2 * FIO_SYNC_UPTIME_TICK_MS
const FIO_SYNC_UPTIME_SAVE_MS = 30 * 60 * 1000

export const getFioCheckIntervalMs = (
  secondsPerToken: number,
  tokenCount: number
): number => Math.ceil((secondsPerToken * 1000) / tokenCount)

type FioSyncLeaseDecision =
  | { readonly poll: false }
  | {
      readonly poll: true
      readonly renewLease: boolean
      readonly takenOverAt: number | null
    }

interface FioSyncLease {
  readonly deviceId: DeviceId
  readonly expiresAt: number
}

export const decideFioSyncLease = ({
  lease,
  deviceId,
  uptime,
  holderUptime,
  now,
}: {
  readonly lease: FioSyncLease | undefined
  readonly deviceId: DeviceId
  readonly uptime: number
  readonly holderUptime: number
  readonly now: number
}): FioSyncLeaseDecision => {
  if (lease === undefined)
    return { poll: true, renewLease: true, takenOverAt: null }
  if (lease.deviceId === deviceId) {
    return {
      poll: true,
      renewLease: lease.expiresAt - now <= FIO_SYNC_LEASE_MS / 2,
      takenOverAt: null,
    }
  }
  const runsClearlyMore =
    uptime >= holderUptime + FIO_SYNC_TAKEOVER_UPTIME_MARGIN
  if (lease.expiresAt > now && !runsClearlyMore) return { poll: false }

  return {
    poll: true,
    renewLease: true,
    takenOverAt: Math.min(now, lease.expiresAt),
  }
}

interface FioSyncUptimeStep {
  readonly uptime: number
  readonly elapsedMs: number
}

const fioSyncUptimePastWeight = (elapsedMs: number): number =>
  Math.exp(-Math.max(0, elapsedMs) / FIO_SYNC_UPTIME_TIME_CONSTANT_MS)

export const fioSyncUptimeAfterRunning = ({
  uptime,
  elapsedMs,
}: FioSyncUptimeStep): number =>
  1 - (1 - uptime) * fioSyncUptimePastWeight(elapsedMs)

export const fioSyncUptimeAfterOff = ({
  uptime,
  elapsedMs,
}: FioSyncUptimeStep): number => uptime * fioSyncUptimePastWeight(elapsedMs)

type ActiveFioPlugin = Readonly<InferRow<typeof activeFioPluginsQuery>>
type FioPluginToken = ActiveFioPlugin["tokens"][number]
type ActiveFioPluginWithTokens = ActiveFioPlugin & {
  readonly tokens: readonly [FioPluginToken, ...FioPluginToken[]]
}

export const createFioAccountTransactionSyncJob =
  (): Task<AsyncDisposable, never, Context> => async (run) => {
    const { deps } = run
    const restingUntilByToken = new Map<string, number>()
    const syncedPluginIds = new Set<FioPluginId>()
    const job = await run.ok(
      createFioPluginSyncJob(
        deps.deviceId,
        restingUntilByToken,
        syncedPluginIds
      )
    )
    return ok({
      [Symbol.asyncDispose]: async () => {
        await job[Symbol.asyncDispose]()
        for (const pluginId of syncedPluginIds) {
          await releaseFioSyncLease(deps, pluginId)
        }
      },
    })
  }

const createFioPluginSyncJob = (
  deviceId: DeviceId,
  restingUntilByToken: Map<string, number>,
  syncedPluginIds: Set<FioPluginId>
) =>
  createBankPluginSyncJob({
    name: "fio-account-transaction-sync-job",
    bank: "FIO",
    query: activeFioPluginsQuery,
    selectPlugins: (plugins, run, runningCount) => {
      const activePlugins = plugins.filter(hasFioTokens)
      run.deps.console.debug("Refreshing FIO plugin syncs.", {
        activePluginCount: activePlugins.length,
        pluginCount: plugins.length,
        runningPluginCount: runningCount,
        skippedPluginWithoutTokenCount: plugins.length - activePlugins.length,
      })
      return activePlugins
    },
    createPluginSync: (run, plugin) => {
      syncedPluginIds.add(plugin.id)
      return new FioPluginSync(run, plugin, deviceId, restingUntilByToken)
    },
    describePlugin: (plugin) => ({
      accountId: plugin.accountId,
      tokenCount: plugin.tokens.length,
    }),
  })

export const startFioAccountTransactionSyncJob =
  createFioAccountTransactionSyncJob()

class FioPluginSync implements BankPluginSync<ActiveFioPluginWithTokens> {
  private readonly run: Run<BackgroundJobContext>
  private readonly deps: Context
  private readonly plugin: ActiveFioPluginWithTokens
  private readonly fioApiDep: FioApiDep
  private readonly uptime: FioSyncUptime
  private readonly session: BankPluginSyncSession
  private restTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    run: Run<BackgroundJobContext>,
    plugin: ActiveFioPluginWithTokens,
    deviceId: DeviceId,
    restingUntilByToken: Map<string, number>
  ) {
    this.run = run
    this.deps = { ...run.deps, deviceId }
    this.plugin = plugin
    this.uptime = new FioSyncUptime(this.deps)
    // The dep lives as long as this sync session, and `matches()` restarts
    // the session whenever the token set changes, so the client-side
    // `takeToken` rotation always covers the current tokens.
    const [firstToken, ...restTokens] = plugin.tokens
    this.fioApiDep = createFioApiDep({
      tokens: [firstToken.token, ...restTokens.map((token) => token.token)],
      restingUntilByToken,
    })
    this.session = createBankPluginSyncSession({
      intervalMs: getFioCheckIntervalMs(
        plugin.numberOfSecondsBetweenChecks,
        plugin.tokens.length
      ),
      sync: () => this.syncTransactions(),
      onError: (error) => run.deps.onError(error),
      onDelayed: ({ failedSyncCount, retryInMs }) => {
        run.deps.console.warn("Delayed FIO sync after a failed attempt.", {
          accountId: plugin.accountId,
          failedSyncCount,
          pluginId: plugin.id,
          retryInMs,
        })
      },
    })
  }

  start(): void {
    this.session.start()
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.session.isDisposed) return
    if (this.restTimer !== null) clearTimeout(this.restTimer)
    await this.session[Symbol.asyncDispose]()
    await this.uptime.dispose()
  }

  matches(plugin: ActiveFioPluginWithTokens): boolean {
    return (
      this.plugin.accountId === plugin.accountId &&
      this.plugin.numberOfSecondsBetweenChecks ===
        plugin.numberOfSecondsBetweenChecks &&
      this.plugin.syncLookbackDays === plugin.syncLookbackDays &&
      this.plugin.iban === plugin.iban &&
      areTokensEqual(this.plugin.tokens, plugin.tokens)
    )
  }

  private syncAt(at: number): void {
    if (this.restTimer !== null) clearTimeout(this.restTimer)
    this.restTimer = setTimeout(() => {
      this.restTimer = null
      this.session.start()
    }, at - this.deps.date.now().getTime())
    ;(this.restTimer as { readonly unref?: () => void }).unref?.()
  }

  private async syncTransactions(): Promise<BankPluginSyncOutcome> {
    const mayPoll = await this.holdLease()
    if (!mayPoll || this.session.isDisposed) return "waited"
    return await this.syncTransactionsOnce()
  }

  private async holdLease(): Promise<boolean> {
    const { deviceId, evolu } = this.deps
    const now = this.deps.date.now().getTime()
    const [lease] = await evolu.loadQuery(
      fioPluginSyncLeaseByPluginIdQuery(this.plugin.id)
    )
    const holderUptime =
      lease === undefined || lease.deviceId === deviceId
        ? 0
        : (await loadSavedFioSyncUptime(this.deps, lease.deviceId)).uptime
    const decision = decideFioSyncLease({
      lease,
      deviceId,
      uptime: await this.uptime.current(),
      holderUptime,
      now,
    })
    if (!decision.poll) {
      this.run.deps.console.debug(
        "Skipped FIO sync while another device holds the lease.",
        { lease, pluginId: this.plugin.id }
      )
      return false
    }
    if (decision.takenOverAt !== null) {
      const lastPossibleRequestAt = new Date(decision.takenOverAt)
      for (const { token } of this.plugin.tokens) {
        this.fioApiDep.fioApi.restToken(token, lastPossibleRequestAt)
      }
      this.run.deps.console.info("Took over the FIO sync lease.", {
        previousLease: lease,
        pluginId: this.plugin.id,
      })
    }
    if (decision.renewLease) {
      await saveFioSyncLease(this.deps, this.plugin.id, now + FIO_SYNC_LEASE_MS)
    }
    return true
  }

  private async syncTransactionsOnce(): Promise<BankPluginSyncOutcome> {
    const period = await this.getSyncPeriod()
    this.run.deps.console.info("Started FIO transaction sync.", {
      accountId: this.plugin.accountId,
      from: period.from,
      pluginId: this.plugin.id,
      to: period.to,
      tokenCount: this.plugin.tokens.length,
    })
    // Custom deps replace a Run's inherited ones rather than merging with
    // them (see `createRun`'s doc comment), so the fetch's extra `FioApiDep`
    // is layered on top of every dep this session's `run` already carries,
    // not passed alone.
    const result = await this.run(fetchFioTransactionsByPeriod(period), {
      ...this.run.deps,
      ...this.fioApiDep,
    })
    if (!result.ok && result.error.type === "FioRateLimitError") {
      this.run.deps.console.error(
        "Skipped FIO sync because of rate limiting.",
        {
          accountId: this.plugin.accountId,
          pluginId: this.plugin.id,
          responseBody: result.error.responseBody,
        }
      )
      return "failed"
    }
    if (!result.ok && result.error.type === "FioAllTokensRestingError") {
      this.run.deps.console.debug("Skipped FIO sync while every token rests.", {
        accountId: this.plugin.accountId,
        pluginId: this.plugin.id,
        retryAt: result.error.retryAt,
      })
      this.syncAt(result.error.retryAt)
      return "waited"
    }
    if (!result.ok) throw result.error
    if (result.value.iban !== this.plugin.iban) {
      this.run.deps.console.warn(
        "Skipped FIO statement for a different IBAN.",
        {
          accountId: this.plugin.accountId,
          expectedIban: this.plugin.iban,
          receivedIban: result.value.iban,
          pluginId: this.plugin.id,
        }
      )
      return "synced"
    }

    const { toRecord, toReconcile } = await this.getTransactionsToRecord(
      result.value.transactions
    )
    this.run.deps.console.info("Selected FIO transactions to record.", {
      accountId: this.plugin.accountId,
      downloadedCount: result.value.transactions.length,
      pluginId: this.plugin.id,
      selectedCount: toRecord.length,
      skippedCount: result.value.transactions.length - toRecord.length,
    })
    let skippedLockedTransaction = false
    for (const transaction of toRecord) {
      if (this.session.isDisposed) return "synced"
      skippedLockedTransaction ||= !(await this.recordTransaction(transaction))
    }
    if (this.session.isDisposed) return "synced"
    await this.retryReconciliation(toReconcile)
    if (skippedLockedTransaction) {
      this.run.deps.console.debug(
        "Did not advance FIO sync pointer because a transaction was locked.",
        {
          accountId: this.plugin.accountId,
          pluginId: this.plugin.id,
        }
      )
      return "synced"
    }
    await this.saveSyncPointer(period.to)
    this.run.deps.console.info("Finished FIO transaction sync.", {
      accountId: this.plugin.accountId,
      from: period.from,
      pluginId: this.plugin.id,
      recordedCount: toRecord.length,
      to: period.to,
    })
    return "synced"
  }

  /**
   * Re-attempts reconciliation for bank references already recorded but not
   * claimed: a payment created on another device may have synced since the
   * transfer was recorded. `reconcileUnclaimedBankTransactions` asks about
   * them all in one query and reconciles only the ones a payment matches.
   */
  private async retryReconciliation(
    accountTransactionIds: ReadonlyArray<AccountTransactionId>
  ): Promise<void> {
    const paymentIds = await this.run.ok(
      reconcileUnclaimedBankTransactions({
        accountTransactionIds,
        isStopped: () => this.session.isDisposed,
      })
    )
    this.run.deps.console.debug("Re-checked FIO transaction reconciliation.", {
      accountId: this.plugin.accountId,
      checkedCount: accountTransactionIds.length,
      paymentIds,
      pluginId: this.plugin.id,
    })
  }

  /**
   * Records one transaction under its lock, so two tabs of the app do not
   * both write it; `false` when another one holds the lock.
   */
  private async recordTransaction(
    transaction: BankTransaction
  ): Promise<boolean> {
    return await this.run.deps.lockManager.request(
      `fio-transaction-${this.plugin.accountId}-${transaction.bankReference}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock === null) {
          this.run.deps.console.debug("Skipped locked FIO transaction.", {
            accountId: this.plugin.accountId,
            bankReference: transaction.bankReference,
            pluginId: this.plugin.id,
          })
          return false
        }

        const recorded = await this.run.ok(
          recordBankTransactions({
            accountId: this.plugin.accountId,
            transactions: [transaction],
          })
        )
        this.run.deps.console.info("Created FIO account transaction.", {
          accountId: this.plugin.accountId,
          amount: transaction.amount,
          bankReference: transaction.bankReference,
          paymentId: recorded.claimedPaymentIds[0] ?? null,
          pluginId: this.plugin.id,
        })
        return true
      }
    )
  }

  private async getSyncPeriod(): Promise<{
    readonly from: DateString
    readonly to: DateString
  }> {
    const to = dateToDateString(this.run.deps.date.now())
    const [pointer] = await this.run.deps.evolu.loadQuery(
      fioPluginSyncPointerByPluginIdQuery(this.plugin.id)
    )
    const syncLookbackDays =
      this.plugin.syncLookbackDays ?? defaultFioPluginSyncLookbackDays
    const from =
      pointer?.lastSyncedDate === null || pointer?.lastSyncedDate === undefined
        ? getFioFirstSyncDate(this.run.deps.date.now())
        : dateToDateString(
            subDays(dateStringToDate(pointer.lastSyncedDate), syncLookbackDays)
          )

    this.run.deps.console.debug("Resolved FIO sync period.", {
      from,
      lastSyncedDate: pointer?.lastSyncedDate ?? null,
      pluginId: this.plugin.id,
      syncLookbackDays,
      to,
    })

    return { from, to }
  }

  private async getTransactionsToRecord(
    transactions: ReadonlyArray<FioTransaction>
  ): Promise<{
    readonly toRecord: ReadonlyArray<BankTransaction>
    readonly toReconcile: ReadonlyArray<AccountTransactionId>
  }> {
    if (transactions.length === 0) {
      this.run.deps.console.debug("Downloaded no FIO transactions.", {
        accountId: this.plugin.accountId,
        pluginId: this.plugin.id,
        transactionCount: transactions.length,
      })
      return { toRecord: [], toReconcile: [] }
    }

    const { unrecorded, unclaimed } = await this.run.ok(
      loadUnrecordedBankTransactions({
        accountId: this.plugin.accountId,
        transactions: transactions.map(toBankTransaction),
      })
    )

    this.run.deps.console.debug("Filtered FIO transactions.", {
      accountId: this.plugin.accountId,
      downloadedCount: transactions.length,
      pluginId: this.plugin.id,
      selectedCount: unrecorded.length,
      unclaimedCount: unclaimed.length,
    })

    return { toRecord: unrecorded, toReconcile: unclaimed }
  }

  private async saveSyncPointer(lastSyncedDate: DateString): Promise<void> {
    await runMutationWithCompletion((options) =>
      this.run.deps.evolu.upsert(
        "fioPluginSyncPointer",
        removeUndefinedValues({
          id: this.plugin.id,
          lastSyncedDate,
        }),
        { ...options, owner: this.run.deps.evoluOwner }
      )
    )
    this.run.deps.console.debug("Saved FIO sync pointer.", {
      lastSyncedDate,
      pluginId: this.plugin.id,
    })
  }
}

class FioSyncUptime {
  private readonly deps: Context
  private readonly timer: ReturnType<typeof setInterval>
  private readonly loaded: Promise<void>
  private uptime = 0
  private tickedAt: number
  private savedAt: number

  constructor(deps: Context) {
    this.deps = deps
    this.tickedAt = deps.date.now().getTime()
    this.savedAt = this.tickedAt
    this.loaded = this.load().catch((error: unknown) =>
      this.deps.onError(error)
    )
    this.timer = setInterval(() => {
      this.tick()
      if (this.tickedAt - this.savedAt >= FIO_SYNC_UPTIME_SAVE_MS)
        this.save().catch((error: unknown) => this.deps.onError(error))
    }, FIO_SYNC_UPTIME_TICK_MS)
    ;(this.timer as { readonly unref?: () => void }).unref?.()
  }

  async current(): Promise<number> {
    await this.loaded
    return this.uptime
  }

  async dispose(): Promise<void> {
    clearInterval(this.timer)
    await this.loaded
    this.tick()
    await this.save()
  }

  private async load(): Promise<void> {
    const saved = await loadSavedFioSyncUptime(this.deps, this.deps.deviceId)
    this.uptime = fioSyncUptimeAfterOff({
      uptime: saved.uptime,
      elapsedMs: this.deps.date.now().getTime() - saved.measuredAt,
    })
    this.deps.console.debug("Loaded FIO sync uptime.", {
      uptime: this.uptime,
    })
    await this.save()
  }

  private tick(): void {
    const now = this.deps.date.now().getTime()
    const elapsedMs = now - this.tickedAt
    const advance =
      elapsedMs <= FIO_SYNC_UPTIME_MAX_TICK_GAP_MS
        ? fioSyncUptimeAfterRunning
        : fioSyncUptimeAfterOff
    this.uptime = advance({ uptime: this.uptime, elapsedMs })
    this.tickedAt = now
  }

  private async save(): Promise<void> {
    this.savedAt = this.tickedAt
    await runMutationWithCompletion((options) =>
      this.deps.evolu.upsert(
        "fioSyncDeviceUptime",
        removeUndefinedValues({
          id: fioSyncDeviceUptimeId(this.deps.deviceId),
          uptimePerMille: NonNegativeIntegerSchema.decode(
            Math.round(this.uptime * 1000)
          ),
          measuredAt: TimestampMsSchema.decode(this.tickedAt),
        }),
        { ...options, owner: this.deps.evoluOwner }
      )
    )
  }
}

const NEVER_MEASURED_FIO_SYNC_UPTIME = { uptime: 0, measuredAt: 0 }

const loadSavedFioSyncUptime = async (
  deps: Context,
  deviceId: DeviceId
): Promise<{ readonly uptime: number; readonly measuredAt: number }> => {
  const [saved] = await deps.evolu.loadQuery(
    fioSyncDeviceUptimeByDeviceIdQuery(deviceId)
  )
  if (saved === undefined) return NEVER_MEASURED_FIO_SYNC_UPTIME
  return { uptime: saved.uptimePerMille / 1000, measuredAt: saved.measuredAt }
}

const saveFioSyncLease = async (
  deps: Context,
  pluginId: FioPluginId,
  expiresAt: number
): Promise<void> => {
  await runMutationWithCompletion((options) =>
    deps.evolu.upsert(
      "fioPluginSyncLease",
      removeUndefinedValues({
        id: pluginId,
        deviceId: deps.deviceId,
        expiresAt: TimestampMsSchema.decode(expiresAt),
      }),
      { ...options, owner: deps.evoluOwner }
    )
  )
}

const releaseFioSyncLease = async (
  deps: Context,
  pluginId: FioPluginId
): Promise<void> => {
  const now = deps.date.now().getTime()
  const [lease] = await deps.evolu.loadQuery(
    fioPluginSyncLeaseByPluginIdQuery(pluginId)
  )
  if (lease?.deviceId !== deps.deviceId || lease.expiresAt <= now) return
  await saveFioSyncLease(deps, pluginId, now)
}

const getFioFirstSyncDate = (now: Date): DateString => {
  return DateStringSchema.decode(
    format(subMonths(now, FIO_FIRST_SYNC_LOOKBACK_MONTHS), "yyyy-MM-dd")
  )
}

const hasFioTokens = (
  plugin: ActiveFioPlugin
): plugin is ActiveFioPluginWithTokens => plugin.tokens.length > 0

const areTokensEqual = (
  left: ReadonlyArray<FioPluginToken>,
  right: ReadonlyArray<FioPluginToken>
): boolean =>
  left.length === right.length &&
  left.every((token, index) => token.token === right[index]?.token)

const createRecipientMessage = ({ recipientMessage }: FioTransaction) => {
  const parsed = NonEmptyStringSchema.safeParse(recipientMessage)
  return parsed.success ? parsed.data : null
}

const createTransactionNote = (transaction: FioTransaction) => {
  const parts = [
    transaction.counterAccountName,
    transaction.recipientMessage,
    transaction.userIdentification,
    transaction.type,
  ].filter((part): part is string => part !== null && part.length > 0)

  if (parts.length === 0) return null

  return NonEmptyStringSchema.decode(parts.join(" | "))
}

const toBankTransaction = (transaction: FioTransaction): BankTransaction => ({
  bankReference: NonEmptyString255Schema.decode(transaction.id),
  amount: IntegerSchema.decode(transaction.amountMinor),
  currency: transaction.currency,
  occurredAt: TimestampMsSchema.decode(
    dateStringToDate(transaction.bookedDate).getTime()
  ),
  note: createTransactionNote(transaction),
  recipientMessage: createRecipientMessage(transaction),
  variableSymbol: transaction.variableSymbol,
  constantSymbol: transaction.constantSymbol,
  specificSymbol: transaction.specificSymbol,
})
