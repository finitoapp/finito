import {
  type ConsoleDep,
  type LockManagerDep,
  ok,
  type Task,
} from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  type CreateAccountTransactionInput,
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import { ibanTransactionsByBankReferenceQuery } from "../account-transaction/account-transaction-queries.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import type { NonEmptyString255 } from "../shared/schema.ts"
import type { SelfPayArrivalDeps } from "../table-self-pay/table-self-pay-actions.ts"
import {
  type AutomaticReconciliation,
  loadAutomaticReconciliation,
  reconcileAccountTransaction,
  SELF_PAY_ARRIVAL_LOCK,
  upsertAutomaticReconciliationRows,
} from "./reconciliation-claim-actions.ts"
import {
  ibanTransactionsNamingSelfPayQuery,
  ibanTransactionsWithReconciliationCandidateQuery,
} from "./reconciliation-claim-queries.ts"
import type {
  BankTransaction,
  RecordedBankTransaction,
  RecordedBankTransactions,
} from "./reconciliation-claim-types.ts"

/**
 * Which of `bankReferences` the account already holds, by bank reference.
 * A sync records the rest and re-checks only the unclaimed ones here.
 */
const loadRecordedBankTransactions =
  ({
    accountId,
    bankReferences,
  }: {
    readonly accountId: AccountId
    readonly bankReferences: ReadonlyArray<NonEmptyString255>
  }): Task<
    ReadonlyMap<NonEmptyString255, RecordedBankTransaction>,
    never,
    EvoluDep
  > =>
  async (run) => {
    if (bankReferences.length === 0) return ok(new Map())

    const rows = await run.deps.evolu.loadQuery(
      ibanTransactionsByBankReferenceQuery({ accountId, bankReferences })
    )
    return ok(
      new Map(
        rows.map((row) => [
          row.bankReference,
          {
            accountTransactionId: row.accountTransactionId,
            isClaimed: row.isClaimed === 1,
          },
        ])
      )
    )
  }

/**
 * The downloaded transactions a sync still has to record — the first of each
 * bank reference the account does not hold yet, as a page boundary or a
 * statement may repeat one — and the recorded ones no payment holds yet,
 * for `reconcileUnclaimedBankTransactions` to re-check.
 */
export const loadUnrecordedBankTransactions =
  <TTransaction extends Pick<BankTransaction, "bankReference">>({
    accountId,
    transactions,
  }: {
    readonly accountId: AccountId
    readonly transactions: ReadonlyArray<TTransaction>
  }): Task<
    {
      readonly unrecorded: ReadonlyArray<TTransaction>
      readonly unclaimed: ReadonlyArray<AccountTransactionId>
    },
    never,
    EvoluDep
  > =>
  async (run) => {
    const recorded = await run.ok(
      loadRecordedBankTransactions({
        accountId,
        bankReferences: [
          ...new Set(transactions.map(({ bankReference }) => bankReference)),
        ],
      })
    )
    const seen = new Set<NonEmptyString255>()
    const unrecorded = transactions.filter(({ bankReference }) => {
      if (recorded.has(bankReference) || seen.has(bankReference)) return false
      seen.add(bankReference)
      return true
    })

    return ok({
      unrecorded,
      unclaimed: [...recorded.values()].flatMap(
        ({ accountTransactionId, isClaimed }) =>
          isClaimed ? [] : [accountTransactionId]
      ),
    })
  }

/**
 * New transactions written in one batch: a few hundred on a first sync stay
 * one round trip, without one batch growing past what a device writes at
 * once.
 */
const BANK_TRANSACTION_BATCH_SIZE = 100

/**
 * Records new bank transactions and the claims of the payments they pay —
 * each transaction together with its claim, so none is ever recorded
 * without the claim it should have had.
 *
 * Unclaimed transactions share a batch. A claim closes its batch at once:
 * the next transaction's candidate lookup has to see it, or two transfers
 * quoting the same symbols would both take one payment while another unpaid
 * one matches the second (payment/0007). `isStopped` lets a
 * sync that is being shut down stop between transactions; what was
 * computed by then is still written.
 */
export const recordBankTransactions =
  ({
    accountId,
    transactions,
    isStopped = () => false,
  }: {
    readonly accountId: AccountId
    readonly transactions: ReadonlyArray<BankTransaction>
    readonly isStopped?: () => boolean
  }): Task<
    RecordedBankTransactions,
    never,
    EvoluOwnerDep & ConsoleDep & LockManagerDep & SelfPayArrivalDeps
  > =>
  async (run) => {
    let pending: PendingBankTransaction[] = []
    const claimedPaymentIds: PaymentId[] = []
    let recordedCount = 0

    const flush = async () => {
      if (pending.length === 0) return
      const batch = pending
      pending = []
      await runMutationWithCompletion((options) => {
        const mutationOptions = { ...options, owner: run.deps.evoluOwner }
        for (const { rows, reconciliation } of batch) {
          upsertAccountTransactionRows(run.deps.evolu, rows, mutationOptions)
          if (reconciliation !== null) {
            upsertAutomaticReconciliationRows(
              run.deps.evolu,
              reconciliation,
              mutationOptions
            )
          }
        }
      })
      recordedCount += batch.length
    }

    for (const transaction of transactions) {
      if (isStopped()) break

      const input = toAccountTransactionInput(accountId, transaction)
      const rows = computeAccountTransactionRows(input, run.deps.date.now())
      const claim = await run.deps.lockManager.request(
        SELF_PAY_ARRIVAL_LOCK,
        async () => {
          const reconciliation = await run.ok(
            loadAutomaticReconciliation(input, rows)
          )
          pending.push({ rows, reconciliation })
          if (reconciliation !== null) await flush()
          return reconciliation?.claim ?? null
        }
      )
      if (claim !== null) {
        claimedPaymentIds.push(claim.paymentId)
        run.deps.console.info(
          "Claimed a payment with a new bank transaction.",
          {
            accountId,
            accountTransactionId: rows.id,
            bankReference: transaction.bankReference,
            paymentId: claim.paymentId,
          }
        )
      }
      if (pending.length >= BANK_TRANSACTION_BATCH_SIZE) await flush()
    }
    await flush()

    return ok({ recordedCount, claimedPaymentIds })
  }

/**
 * Re-checks recorded but unclaimed transactions for a payment that may have
 * appeared since — created on another device that had not synced yet when
 * the transfer was recorded. One query finds the few some payment matches;
 * only those go through `reconcileAccountTransaction`, so a window full of
 * ordinary income costs one read, not five per transaction.
 */
export const reconcileUnclaimedBankTransactions =
  ({
    accountTransactionIds,
    isStopped = () => false,
  }: {
    readonly accountTransactionIds: ReadonlyArray<AccountTransactionId>
    readonly isStopped?: () => boolean
  }): Task<
    ReadonlyArray<PaymentId>,
    never,
    EvoluOwnerDep & LockManagerDep & SelfPayArrivalDeps
  > =>
  async (run) => {
    if (accountTransactionIds.length === 0) return ok([])

    const [matched, namingSelfPay] = await Promise.all(
      run.deps.evolu.loadQueries([
        ibanTransactionsWithReconciliationCandidateQuery(accountTransactionIds),
        ibanTransactionsNamingSelfPayQuery(accountTransactionIds),
      ])
    )
    const toReconcile = new Set(
      [...matched, ...namingSelfPay].map(
        ({ accountTransactionId }) => accountTransactionId
      )
    )
    const claimedPaymentIds: PaymentId[] = []
    for (const accountTransactionId of toReconcile) {
      if (isStopped()) break
      const paymentId = await run.ok(
        reconcileAccountTransaction(accountTransactionId)
      )
      if (paymentId !== null) claimedPaymentIds.push(paymentId)
    }

    return ok(claimedPaymentIds)
  }

interface PendingBankTransaction {
  readonly rows: ReturnType<typeof computeAccountTransactionRows>
  readonly reconciliation: AutomaticReconciliation | null
}

const toAccountTransactionInput = (
  accountId: AccountId,
  transaction: BankTransaction
): CreateAccountTransactionInput => ({
  accountId,
  amount: transaction.amount,
  currency: transaction.currency,
  occurredAt: transaction.occurredAt,
  note: transaction.note,
  internalTransferGroupId: null,
  source: { deviceId: null, source: "auto" },
  iban: {
    variableSymbol: transaction.variableSymbol,
    constantSymbol: transaction.constantSymbol,
    specificSymbol: transaction.specificSymbol,
    bankReference: transaction.bankReference,
    recipientMessage: transaction.recipientMessage,
  },
})
