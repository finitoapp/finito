import {
  type ConsoleDep,
  err,
  type LockManagerDep,
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"

import type { EvoluOwnerDep, FetchDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  createMonetaApiDep,
  fetchMonetaAccounts,
  fetchMonetaTransactions,
  type MonetaClientError,
  type MonetaTransaction,
} from "../../integrations/moneta/moneta-client.ts"
import type { AccountId } from "../account/account-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import {
  loadUnrecordedBankTransactions,
  reconcileUnclaimedBankTransactions,
  recordBankTransactions,
} from "../reconciliation-claim/bank-sync-actions.ts"
import type { BankTransaction } from "../reconciliation-claim/reconciliation-claim-types.ts"
import { dateStringToDate } from "../shared/date-string-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  type DateString,
  type Iban,
  type NonEmptyString,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  PositiveInteger,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { SelfPayArrivalDeps } from "../table-self-pay/table-self-pay-actions.ts"
import {
  activeMonetaPluginsQuery,
  monetaPluginByIdQuery,
} from "./moneta-plugin-queries.ts"
import {
  MonetaBankAccountIdSchema,
  type MonetaPluginId,
} from "./moneta-plugin-types.ts"
import {
  defaultMonetaPluginCheckIntervalSeconds,
  earliestMonetaReadableDay,
  isIncomingMonetaTransaction,
  monetaPluginId,
} from "./moneta-plugin-utils.ts"

export const createMonetaPluginNotFoundError = defineError(
  "MonetaPluginNotFound"
)<{
  readonly id: MonetaPluginId
}>()
export type MonetaPluginNotFoundError = ReturnType<
  typeof createMonetaPluginNotFoundError
>

/** The token works, but none of the accounts it sees is the one to connect. */
const createMonetaAccountNotVisibleError = defineError(
  "MonetaAccountNotVisible"
)<{
  readonly iban: Iban
  readonly visibleIbans: ReadonlyArray<Iban>
}>()
export type MonetaAccountNotVisibleError = ReturnType<
  typeof createMonetaAccountNotVisibleError
>

export type MonetaConnectError =
  | MonetaClientError
  | MonetaAccountNotVisibleError

export type MonetaSyncError = MonetaClientError

/**
 * Checks the token against the bank and connects it to the fiat bank
 * account: the bank must list an account with `iban` to it, and that
 * account's bank id is what the sync reads from. Connecting again — a new
 * token, or the same one after the account changed — keeps the interval and
 * on/off switch already set, and the sync pointer while the bank account
 * stays the same.
 */
export const connectMonetaPlugin =
  ({
    accountId,
    iban,
    token,
  }: {
    readonly accountId: AccountId
    readonly iban: Iban
    readonly token: NonEmptyString
  }): Task<
    MonetaPluginId,
    MonetaConnectError,
    EvoluDep & EvoluOwnerDep & FetchDep
  > =>
  async (run) => {
    const accounts = await run(fetchMonetaAccounts(), {
      ...run.deps,
      ...createMonetaApiDep({ token }),
    })
    if (!accounts.ok) return accounts

    const account = accounts.value.accounts.find(
      (account) => account.iban === iban
    )
    if (account === undefined) {
      return err(
        createMonetaAccountNotVisibleError({
          iban,
          visibleIbans: accounts.value.accounts.flatMap((account) =>
            account.iban === null ? [] : [account.iban]
          ),
        })
      )
    }

    const [existing] = await run.deps.evolu.loadQuery(
      monetaPluginByIdQuery(monetaPluginId)
    )
    const monetaAccountId = MonetaBankAccountIdSchema.decode(account.id)
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: run.deps.evoluOwner }
      run.deps.evolu.upsert(
        "monetaPlugin",
        removeUndefinedValues({
          id: monetaPluginId,
          accountId,
          iban,
          token,
          monetaAccountId,
          numberOfSecondsBetweenChecks:
            existing?.numberOfSecondsBetweenChecks ??
            PositiveInteger(defaultMonetaPluginCheckIntervalSeconds),
          isActive: existing?.isActive ?? sqliteTrue,
          isDeleted: sqliteFalse,
        }),
        mutationOptions
      )
      // Another bank account, or a plugin connected afresh: its pointer
      // belonged to other history, so the first sync reads its own window.
      if (existing?.monetaAccountId !== monetaAccountId) {
        deleteMonetaPluginSyncPointer(run.deps.evolu, mutationOptions)
      }
    })

    return ok(monetaPluginId)
  }

/** Changes how the connected plugin syncs; the token stays as it is. */
export const saveMonetaPlugin =
  (input: {
    readonly numberOfSecondsBetweenChecks?: PositiveInteger
    readonly isActive?: typeof sqliteTrue | typeof sqliteFalse
  }): Task<MonetaPluginId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "monetaPlugin",
        removeUndefinedValues({ id: monetaPluginId, ...input }),
        { ...options, owner: run.deps.evoluOwner }
      )
    )

    return ok(monetaPluginId)
  }

/**
 * Disconnects the plugin and clears its token and sync pointer, so a token
 * connected later — perhaps for another account — starts from the
 * first-sync window rather than where this one stopped.
 *
 * Clearing the token stops every device from using it, but does not erase
 * it: Evolu keeps a row's earlier values in its history, on every device that
 * synced them. Only revoking the token in MONETA's internet banking makes it
 * worthless, which is what the disconnect dialog asks the merchant to do.
 */
export const disconnectMonetaPlugin =
  (): Task<MonetaPluginId, never, EvoluDep & EvoluOwnerDep> => async (run) => {
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: run.deps.evoluOwner }
      run.deps.evolu.update(
        "monetaPlugin",
        removeUndefinedValues({
          id: monetaPluginId,
          token: null,
          isDeleted: sqliteTrue,
        }),
        mutationOptions
      )
      deleteMonetaPluginSyncPointer(run.deps.evolu, mutationOptions)
    })

    return ok(monetaPluginId)
  }

const deleteMonetaPluginSyncPointer = (
  evolu: EvoluDep["evolu"],
  options: MutationOptions
): void => {
  evolu.update(
    "monetaPluginSyncPointer",
    removeUndefinedValues({ id: monetaPluginId, isDeleted: sqliteTrue }),
    options
  )
}

export const updateMonetaPluginSyncPointer =
  ({
    lastSyncedDate,
  }: {
    readonly lastSyncedDate: DateString | null
  }): Task<MonetaPluginId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: run.deps.evoluOwner }
      if (lastSyncedDate === null) {
        deleteMonetaPluginSyncPointer(run.deps.evolu, mutationOptions)
        return
      }
      run.deps.evolu.upsert(
        "monetaPluginSyncPointer",
        removeUndefinedValues({
          id: monetaPluginId,
          lastSyncedDate,
          isDeleted: sqliteFalse,
        }),
        mutationOptions
      )
    })

    return ok(monetaPluginId)
  }

/**
 * Points the MONETA plugin at another fiat bank account, as
 * `updateFioPluginAccountRow` does for Fio. A plain write taking the
 * caller's `MutationOptions`, so the account module can fold it into the
 * batch that replaces the account. The plugin keeps the IBAN its token was
 * checked against, so an account with another IBAN leaves it idle
 * (`activeMonetaPluginsQuery`) until the token is connected again.
 */
export const updateMonetaPluginAccountRow = (
  evolu: EvoluDep["evolu"],
  accountId: AccountId,
  options: MutationOptions
): void => {
  evolu.update(
    "monetaPlugin",
    removeUndefinedValues({ id: monetaPluginId, accountId }),
    options
  )
}

export interface MonetaSyncResult {
  readonly downloadedCount: number
  readonly recordedCount: number
  /** Payments this sync claimed, with a new transaction or a recorded one. */
  readonly claimedPaymentIds: ReadonlyArray<PaymentId>
  /** The bank listed more pages than one sync reads; the rest were not read. */
  readonly isTruncated: boolean
  /** Calls spent against the daily limit (moneta/0002). */
  readonly callCount: number
}

type MonetaSyncDeps = EvoluOwnerDep &
  FetchDep &
  ConsoleDep &
  LockManagerDep &
  SelfPayArrivalDeps

/**
 * Downloads the account's transactions booked from `fromDate` to `toDate`,
 * both bank days included (`monetaBankDay`), records the
 * incoming ones not recorded yet and pays the payments they match — the one
 * write path behind both the background job and the payment-wait screen.
 * Recorded transactions no payment holds yet are re-checked in one query,
 * so a check every few seconds over a busy window stays cheap.
 *
 * It takes no lock, unlike Fio's job: both ids it writes are deterministic,
 * the account transaction's from the account and the bank reference, the
 * claim's from the payment and that transaction, so two syncs running at once
 * (the job and an open payment-wait screen) write the same rows. A second
 * transfer quoting a paid payment's symbols claims it too, so the payment
 * shows as overpaid whether the two were synced together, one after the
 * other or at once (payment/0007). The sync pointer is the job's alone: the
 * screen looks into a narrower window.
 */
export const syncMonetaTransactions =
  ({
    fromDate,
    toDate,
    isStopped,
  }: {
    readonly fromDate: DateString
    readonly toDate: DateString
    /** Checked between writes, so a job being shut down stops early. */
    readonly isStopped?: () => boolean
  }): Task<
    MonetaSyncResult,
    MonetaSyncError | MonetaPluginNotFoundError,
    MonetaSyncDeps
  > =>
  async (run) => {
    const [plugin] = await run.deps.evolu.loadQuery(activeMonetaPluginsQuery)
    if (plugin === undefined) {
      return err(createMonetaPluginNotFoundError({ id: monetaPluginId }))
    }

    const now = run.deps.date.now()
    // Measured from today: the bank reads two years back from now, not
    // from the end of the window.
    const earliestDay = earliestMonetaReadableDay(now)
    const readableFrom = fromDate < earliestDay ? earliestDay : fromDate
    if (readableFrom > toDate) {
      return ok({
        downloadedCount: 0,
        recordedCount: 0,
        claimedPaymentIds: [],
        isTruncated: false,
        callCount: 0,
      })
    }

    const downloaded = await run(
      fetchMonetaTransactions({
        monetaAccountId: plugin.monetaAccountId,
        fromDate: readableFrom,
        toDate,
      }),
      { ...run.deps, ...createMonetaApiDep({ token: plugin.token }) }
    )
    if (!downloaded.ok) return downloaded

    const { transactions, skipped, isTruncated, callCount } = downloaded.value
    if (skipped.length > 0) {
      run.deps.console.warn(
        "Skipped MONETA transactions in an unknown shape.",
        { skippedCount: skipped.length }
      )
    }
    if (isTruncated) {
      run.deps.console.warn("Read only the first MONETA transaction pages.", {
        fromDate: readableFrom,
        toDate,
      })
    }

    const incoming = transactions.flatMap((transaction) =>
      isIncomingMonetaTransaction(transaction, plugin.currency)
        ? [toMonetaBankTransaction(transaction, now)]
        : []
    )
    const { unrecorded, unclaimed } = await run.ok(
      loadUnrecordedBankTransactions({
        accountId: plugin.accountId,
        transactions: incoming,
      })
    )
    const recordedNow = await run.ok(
      recordBankTransactions({
        accountId: plugin.accountId,
        transactions: unrecorded,
        isStopped,
      })
    )
    const reconciled = await run.ok(
      reconcileUnclaimedBankTransactions({
        accountTransactionIds: unclaimed,
        isStopped,
      })
    )
    const claimedPaymentIds = [...recordedNow.claimedPaymentIds, ...reconciled]

    run.deps.console.info("Synced MONETA transactions.", {
      accountId: plugin.accountId,
      downloadedCount: transactions.length,
      incomingCount: incoming.length,
      recordedCount: recordedNow.recordedCount,
      claimedPaymentCount: claimedPaymentIds.length,
      callCount,
    })

    return ok({
      downloadedCount: transactions.length,
      recordedCount: recordedNow.recordedCount,
      claimedPaymentIds,
      isTruncated,
      callCount,
    })
  }

const toMonetaBankTransaction = (
  transaction: MonetaTransaction & { readonly id: string },
  now: Date
): BankTransaction => ({
  bankReference: NonEmptyString255Schema.decode(transaction.id),
  amount: transaction.amountMinor,
  currency: transaction.currency,
  occurredAt: TimestampMsSchema.decode(
    transaction.occurredOn === null
      ? now.getTime()
      : dateStringToDate(transaction.occurredOn).getTime()
  ),
  note:
    transaction.note === null
      ? null
      : (NonEmptyStringSchema.safeParse(transaction.note).data ?? null),
  recipientMessage:
    transaction.recipientMessage === null
      ? null
      : (NonEmptyStringSchema.safeParse(transaction.recipientMessage).data ??
        null),
  variableSymbol: transaction.variableSymbol,
  constantSymbol: transaction.constantSymbol,
  specificSymbol: transaction.specificSymbol,
})
