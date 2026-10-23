import type { InferRow, Run } from "@evolu/common"
import { format, subDays, subMonths } from "date-fns"
import {
  createFioApiDep,
  type FioApiDep,
  type FioTransaction,
  fetchFioTransactionsByPeriod,
} from "../../integrations/fio/fio-client.ts"
import type { AccountTransactionId } from "../../modules/account-transaction/account-transaction-types.ts"
import { defaultFioPluginSyncLookbackDays } from "../../modules/fio-plugin/fio-plugin-actions.ts"
import {
  activeFioPluginsQuery,
  fioPluginSyncPointerByPluginIdQuery,
} from "../../modules/fio-plugin/fio-plugin-queries.ts"
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
  TimestampMsSchema,
} from "../../modules/shared/schema.ts"
import type {
  BackgroundJob,
  BackgroundJobContext,
} from "../background-job-types.ts"
import {
  type BankPluginSync,
  type BankPluginSyncSession,
  createBankPluginSyncJob,
  createBankPluginSyncSession,
} from "../bank-plugin-sync.ts"

type Context = BackgroundJobContext

const FIO_FIRST_SYNC_LOOKBACK_MONTHS = 2

type ActiveFioPlugin = Readonly<InferRow<typeof activeFioPluginsQuery>>
type FioPluginToken = ActiveFioPlugin["tokens"][number]
type ActiveFioPluginWithTokens = ActiveFioPlugin & {
  readonly tokens: readonly [FioPluginToken, ...FioPluginToken[]]
}

export const createFioAccountTransactionSyncJob = (): BackgroundJob =>
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
    createPluginSync: (run, plugin) => new FioPluginSync(run, plugin),
    describePlugin: (plugin) => ({
      accountId: plugin.accountId,
      tokenCount: plugin.tokens.length,
    }),
  })

export const startFioAccountTransactionSyncJob =
  createFioAccountTransactionSyncJob()

class FioPluginSync implements BankPluginSync<ActiveFioPluginWithTokens> {
  private readonly run: Run<Context>
  private readonly plugin: ActiveFioPluginWithTokens
  private readonly fioApiDep: FioApiDep
  private readonly session: BankPluginSyncSession

  constructor(run: Run<Context>, plugin: ActiveFioPluginWithTokens) {
    this.run = run
    this.plugin = plugin
    // The dep lives as long as this sync session, and `matches()` restarts
    // the session whenever the token set changes, so the client-side
    // `getToken` rotation always covers the current tokens.
    const [firstToken, ...restTokens] = plugin.tokens
    this.fioApiDep = createFioApiDep({
      tokens: [firstToken.token, ...restTokens.map((token) => token.token)],
    })
    this.session = createBankPluginSyncSession({
      intervalMs: plugin.numberOfSecondsBetweenChecks * 1000,
      sync: async () => {
        await this.syncTransactionsOnce()
        return "synced"
      },
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
    await this.session[Symbol.asyncDispose]()
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

  private async syncTransactionsOnce(): Promise<void> {
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
      return
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
      return
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
      if (this.session.isDisposed) return
      skippedLockedTransaction ||= !(await this.recordTransaction(transaction))
    }
    if (this.session.isDisposed) return
    await this.retryReconciliation(toReconcile)
    if (skippedLockedTransaction) {
      this.run.deps.console.debug(
        "Did not advance FIO sync pointer because a transaction was locked.",
        {
          accountId: this.plugin.accountId,
          pluginId: this.plugin.id,
        }
      )
      return
    }
    await this.saveSyncPointer(period.to)
    this.run.deps.console.info("Finished FIO transaction sync.", {
      accountId: this.plugin.accountId,
      from: period.from,
      pluginId: this.plugin.id,
      recordedCount: toRecord.length,
      to: period.to,
    })
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
