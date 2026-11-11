import { type ConsoleDep, ok, type Task } from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  type CreateAccountTransactionInput,
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import { ibanTransactionsByBankReferenceQuery } from "../account-transaction/account-transaction-queries.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import type { NonEmptyString255, TimestampMs } from "../shared/schema.ts"
import {
  loadAutomaticReconciliationClaimForNewAccountTransaction,
  loadBillClosedAtForPayment,
  reconcileAccountTransaction,
  upsertReconciliationClaimRows,
} from "./reconciliation-claim-actions.ts"
import { ibanTransactionsWithReconciliationCandidateQuery } from "./reconciliation-claim-queries.ts"
import type {
  BankTransaction,
  ReconciliationClaimWrite,
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
 *
 * A transaction that names `formerBankReferences` counts as recorded under
 * any of them too, so a bank whose sync changed how it keys a transfer does
 * not record one again that was recorded under the old key (moneta/0011).
 * Its row is still re-checked while no payment holds it.
 */
export const loadUnrecordedBankTransactions =
  <
    TTransaction extends Pick<BankTransaction, "bankReference"> & {
      readonly formerBankReferences?: ReadonlyArray<NonEmptyString255>
    },
  >({
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
    const referencesOf = ({
      bankReference,
      formerBankReferences = [],
    }: TTransaction): ReadonlyArray<NonEmptyString255> => [
      bankReference,
      ...formerBankReferences,
    ]
    const recorded = await run.ok(
      loadRecordedBankTransactions({
        accountId,
        bankReferences: [...new Set(transactions.flatMap(referencesOf))],
      })
    )
    const seen = new Set<NonEmptyString255>()
    const unrecorded = transactions.filter((transaction) => {
      const references = referencesOf(transaction)
      if (
        references.some(
          (reference) => recorded.has(reference) || seen.has(reference)
        )
      ) {
        return false
      }
      for (const reference of references) seen.add(reference)
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
    EvoluDep & EvoluOwnerDep & DateDep & ConsoleDep
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
        for (const { rows, claim, billClosing } of batch) {
          upsertAccountTransactionRows(run.deps.evolu, rows, mutationOptions)
          if (claim !== null) {
            upsertReconciliationClaimRows(
              run.deps.evolu,
              claim,
              billClosing,
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
      const claim = await run.ok(
        loadAutomaticReconciliationClaimForNewAccountTransaction(input, rows.id)
      )
      const billClosing =
        claim === null
          ? null
          : await run.ok(
              loadBillClosedAtForPayment(claim.paymentId, {
                id: rows.id,
                kind: rows.kind,
                amount: rows.input.amount,
                currency: rows.input.currency,
              })
            )
      pending.push({ rows, claim, billClosing })

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
      if (claim !== null || pending.length >= BANK_TRANSACTION_BATCH_SIZE) {
        await flush()
      }
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
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    if (accountTransactionIds.length === 0) return ok([])

    const matched = await run.deps.evolu.loadQuery(
      ibanTransactionsWithReconciliationCandidateQuery(accountTransactionIds)
    )
    const claimedPaymentIds: PaymentId[] = []
    for (const { accountTransactionId } of matched) {
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
  readonly claim: ReconciliationClaimWrite | null
  readonly billClosing: {
    readonly billId: BillId
    readonly closedAt: TimestampMs
  } | null
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
  },
})
