import {
  type LockManagerDep,
  type MutationOptions,
  ok,
  type Task,
} from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type { CreateAccountTransactionInput } from "../account-transaction/account-transaction-actions.ts"
import {
  accountTransactionAmountByIdQuery,
  selfPayTransactionByIdQuery,
} from "../account-transaction/account-transaction-queries.ts"
import type {
  AccountTransactionId,
  AccountTransactionKind,
} from "../account-transaction/account-transaction-types.ts"
import { upsertBillClosedAt } from "../bill/bill-actions.ts"
import { loadBillClosedAtIfCovered } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import { paymentBillCoverageByIdQuery } from "../payment/payment-queries.ts"
import {
  type SelfPayPaymentRows,
  upsertSelfPayPaymentRows,
} from "../payment/payment-row-actions.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  type Currency,
  NonNegativeInteger,
  type TimestampMs,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  loadSelfPayArrival,
  type SelfPayAllocationWrite,
  type SelfPayArrivalDeps,
  type SelfPayTransaction,
  upsertSelfPayAllocations,
} from "../table-self-pay/table-self-pay-actions.ts"
import {
  activeReconciliationClaimByAccountTransactionIdQuery,
  cashRegisterReconciliationCandidateByAccountTransactionIdQuery,
  cashuReconciliationCandidateByAccountTransactionIdQuery,
  cashuReconciliationCandidateByValuesQuery,
  ibanReconciliationCandidateByAccountTransactionIdQuery,
  ibanReconciliationCandidateByValuesQuery,
  sparkReconciliationCandidateByAccountTransactionIdQuery,
  sparkReconciliationCandidateByValuesQuery,
} from "./reconciliation-claim-queries.ts"
import type { ReconciliationClaimWrite } from "./reconciliation-claim-types.ts"
import {
  createAutomaticReconciliationClaim,
  deriveManualReconciliationClaimId,
} from "./reconciliation-claim-utils.ts"

/**
 * Given a payment about to gain a claim, checks whether its bill's
 * `closedAt` cache should be refreshed in the same mutation batch as the
 * claim write — see `loadBillClosedAtIfCovered`. Reads the payment directly
 * through `payment-queries.ts` (not `payment-actions.ts`) to avoid a
 * circular dependency, since `payment-actions.ts` composes this module's
 * `claimManualReconciliation`.
 *
 * Exported so a caller that must write the claim in the same mutation batch
 * as something else (the account transaction it claims, in
 * `markPaymentPaid`) can run this read first and pass the result to
 * {@link upsertReconciliationClaimRows} directly, instead of always opening
 * a separate batch through {@link writeClaimAndCloseBillIfCovered}.
 */
export const loadBillClosedAtForPayment =
  (
    paymentId: PaymentId,
    /**
     * The transaction the claim points at, by value: what it is worth and
     * in which currency. Passed rather than read back because
     * `markPaymentPaid` and the sync jobs call this *before* writing it —
     * the row is not in the database yet.
     */
    claimedTransaction: {
      readonly id: AccountTransactionId
      readonly kind: AccountTransactionKind
      readonly amount: number
      readonly currency: Currency
    }
  ): Task<
    { readonly billId: BillId; readonly closedAt: TimestampMs } | null,
    never,
    EvoluDep & DateDep
  > =>
  async (run) => {
    const [paymentRow] = await run.deps.evolu.loadQuery(
      paymentBillCoverageByIdQuery(paymentId)
    )
    if (paymentRow === undefined) return ok(null)

    return ok(
      await run.ok(loadBillClosedAtIfCovered(paymentRow, claimedTransaction))
    )
  }

const loadPaymentCandidateForNewAccountTransaction =
  (
    accountTransaction: CreateAccountTransactionInput
  ): Task<PaymentId | null, never, EvoluDep> =>
  async (run) => {
    const { iban, spark, cashu } = accountTransaction
    let paymentId: PaymentId | undefined

    if (cashu) {
      if (
        accountTransaction.amount < 0 ||
        accountTransaction.currency !== "BTC"
      )
        return ok(null)
      const candidates = await run.deps.evolu.loadQuery(
        cashuReconciliationCandidateByValuesQuery({
          accountId: accountTransaction.accountId,
          cashuOperationId: cashu.cashuOperationId,
          quoteId: cashu.quoteId ?? null,
          mintUrl: cashu.mintUrl,
        })
      )
      paymentId = candidates[0]?.paymentId
    } else if (
      iban?.variableSymbol !== null &&
      iban?.variableSymbol !== undefined
    ) {
      if (
        accountTransaction.amount < 0 ||
        accountTransaction.currency === "BTC"
      )
        return ok(null)
      const candidates = await run.deps.evolu.loadQuery(
        ibanReconciliationCandidateByValuesQuery({
          accountId: accountTransaction.accountId,
          amount: NonNegativeInteger(accountTransaction.amount),
          currency: accountTransaction.currency,
          variableSymbol: iban.variableSymbol,
          specificSymbol: iban.specificSymbol ?? null,
        })
      )
      paymentId = candidates[0]?.paymentId
    } else if (spark) {
      if (
        accountTransaction.amount < 0 ||
        accountTransaction.currency !== "BTC"
      )
        return ok(null)
      const candidates = await run.deps.evolu.loadQuery(
        sparkReconciliationCandidateByValuesQuery({
          accountId: accountTransaction.accountId,
          amount: NonNegativeInteger(accountTransaction.amount),
          lnInvoice: spark.lightning?.lnInvoice ?? null,
          sparkInvoice: spark.sparkInvoice?.sparkInvoice ?? null,
        })
      )
      paymentId = candidates[0]?.paymentId
    }

    return ok(paymentId ?? null)
  }

export interface AutomaticReconciliation {
  readonly claim: ReconciliationClaimWrite
  readonly billClosing: {
    readonly billId: BillId
    readonly closedAt: TimestampMs
  } | null
  readonly selfPayPayment: SelfPayPaymentRows | null
  readonly selfPayAllocations: ReadonlyArray<SelfPayAllocationWrite>
}

const loadSelfPayReconciliation =
  (
    transaction: SelfPayTransaction
  ): Task<AutomaticReconciliation | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    const arrival = await run.ok(loadSelfPayArrival(transaction))
    if (arrival === null) return ok(null)

    const { rows: selfPayPayment, allocations } = arrival
    const { payment } = selfPayPayment
    const billClosing = await run.ok(
      loadBillClosedAtIfCovered(
        {
          id: payment.id,
          billId: payment.billId ?? null,
          amount: payment.amount,
          currency: payment.currency,
          tipAmount: payment.tipAmount,
          btcAmountSats: selfPayPayment.spark?.amountSats ?? null,
          cashuAmountSats: null,
          lightningAddressAmountSats: null,
        },
        transaction
      )
    )

    return ok({
      claim: createAutomaticReconciliationClaim(
        payment.id,
        transaction.id,
        selfPayPayment.iban === null
          ? new Date(transaction.occurredAt)
          : run.deps.date.now()
      ),
      billClosing,
      selfPayPayment,
      selfPayAllocations: allocations,
    })
  }

export const SELF_PAY_ARRIVAL_LOCK = "self-pay-arrival"

/**
 * Finds the automatic claim a newly discovered FIO or Spark transaction
 * should receive before the transaction exists in Evolu, so the caller can
 * write them in one mutation batch.
 */
export const loadAutomaticReconciliation =
  (
    accountTransaction: CreateAccountTransactionInput,
    {
      id: accountTransactionId,
      kind,
    }: {
      readonly id: AccountTransactionId
      readonly kind: AccountTransactionKind
    }
  ): Task<AutomaticReconciliation | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    const paymentId = await run.ok(
      loadPaymentCandidateForNewAccountTransaction(accountTransaction)
    )
    if (paymentId === null) {
      const { iban, spark } = accountTransaction
      return run(
        loadSelfPayReconciliation({
          id: accountTransactionId,
          kind,
          accountId: accountTransaction.accountId,
          amount: accountTransaction.amount,
          currency: accountTransaction.currency,
          occurredAt: accountTransaction.occurredAt,
          variableSymbol: iban?.variableSymbol ?? null,
          recipientMessage: iban?.recipientMessage ?? null,
          lnInvoice: spark?.lightning?.lnInvoice ?? null,
          paymentHash: spark?.lightning?.paymentHash ?? null,
          firstSeenAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        })
      )
    }

    return ok({
      claim: createAutomaticReconciliationClaim(
        paymentId,
        accountTransactionId,
        run.deps.date.now()
      ),
      billClosing: await run.ok(
        loadBillClosedAtForPayment(paymentId, {
          id: accountTransactionId,
          kind,
          amount: accountTransaction.amount,
          currency: accountTransaction.currency,
        })
      ),
      selfPayPayment: null,
      selfPayAllocations: [],
    })
  }

/**
 * Upserts a reconciliation claim and, if `billClosing` says it now fully
 * covers the claimed payment's bill, that bill's `closedAt` cache — both in
 * one call to the caller's own `MutationOptions`, so they land in whichever
 * mutation batch the caller is building. Pass the result of
 * {@link loadBillClosedAtForPayment} as `billClosing`.
 */
export const upsertReconciliationClaimRows = (
  evolu: EvoluDep["evolu"],
  claim: ReconciliationClaimWrite,
  billClosing: {
    readonly billId: BillId
    readonly closedAt: TimestampMs
  } | null,
  options: MutationOptions
): void => {
  evolu.upsert("reconciliationClaim", removeUndefinedValues(claim), options)

  if (billClosing !== null) {
    upsertBillClosedAt(evolu, billClosing.billId, billClosing.closedAt, options)
  }
}

export const upsertAutomaticReconciliationRows = (
  evolu: EvoluDep["evolu"],
  {
    claim,
    billClosing,
    selfPayPayment,
    selfPayAllocations,
  }: AutomaticReconciliation,
  options: MutationOptions
): void => {
  if (selfPayPayment !== null) {
    upsertSelfPayPaymentRows(evolu, selfPayPayment, options)
  }
  upsertSelfPayAllocations(evolu, selfPayAllocations, options)
  upsertReconciliationClaimRows(evolu, claim, billClosing, options)
}

/**
 * Writes a reconciliation claim and, if it now fully covers the claimed
 * payment's bill, refreshes that bill's `closedAt` cache in the same
 * mutation batch — shared by `claimManualReconciliation` and
 * `reconcileAccountTransaction` so this isn't duplicated (and possibly
 * forgotten) at each call site.
 *
 * Unlike the old status-closing write this replaced, there is no
 * "recheck right after commit" step: `closedAt` is only ever a best-effort
 * cache (see `bill.ts`'s doc comment) — nothing that decides
 * money-correctness reads it, so under CRDT/multi-device concurrency it can
 * lag a split bill's true coverage for a while without being a correctness
 * problem, only a cosmetic one in `openBillsQuery`'s list. See
 * docs/bill-payment-states.md.
 */
const writeClaimAndCloseBillIfCovered =
  (
    claim: ReconciliationClaimWrite
  ): Task<void, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    // Unlike the sync jobs and `markPaymentPaid`, this path claims a
    // transaction that already exists, so its amount has to be read back
    // before coverage can be told what the claim is worth.
    const [claimedTransaction] = await run.deps.evolu.loadQuery(
      accountTransactionAmountByIdQuery(claim.accountTransactionId)
    )
    const billClosing =
      claimedTransaction === undefined
        ? null
        : await run.ok(
            loadBillClosedAtForPayment(claim.paymentId, {
              id: claim.accountTransactionId,
              kind: claimedTransaction.kind,
              amount: claimedTransaction.amount,
              currency: claimedTransaction.currency,
            })
          )

    await runMutationWithCompletion((options) =>
      upsertReconciliationClaimRows(run.deps.evolu, claim, billClosing, {
        ...options,
        owner: evoluOwner,
      })
    )

    return ok(undefined)
  }

export const claimManualReconciliation =
  ({
    paymentId,
    accountTransactionId,
    deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly accountTransactionId: AccountTransactionId
    readonly deviceId: DeviceId | null
  }): Task<PaymentId, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const id = deriveManualReconciliationClaimId(
      paymentId,
      accountTransactionId
    )

    await run.ok(
      writeClaimAndCloseBillIfCovered({
        id,
        deviceId,
        paymentId,
        accountTransactionId,
        source: "manual",
        claimedAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
      })
    )

    return ok(paymentId)
  }

export const reconcileAccountTransaction =
  (
    accountTransactionId: AccountTransactionId
  ): Task<
    PaymentId | null,
    never,
    EvoluOwnerDep & LockManagerDep & SelfPayArrivalDeps
  > =>
  async (run) => {
    const existingClaims = await run.deps.evolu.loadQuery(
      activeReconciliationClaimByAccountTransactionIdQuery(accountTransactionId)
    )
    const existingClaim = existingClaims[0]
    if (
      existingClaim?.paymentId !== null &&
      existingClaim?.paymentId !== undefined
    )
      return ok(existingClaim.paymentId)

    // Asked together rather than in sequence. Each candidate query filters on
    // `accountTransaction.kind`, which is a single non-nullable enum, so at
    // most one of the three can ever return a row: the kind decides, and the
    // `??` order below is only a total function over that, not a tie-break
    // (pinned by "picks the candidate matching the transaction's kind"). The
    // short-circuit it replaces therefore skipped nothing the kind filter
    // would not have — it only cost round trips, one per incoming transaction
    // on the sync jobs' hot path.
    const [
      ibanCandidates,
      sparkCandidates,
      cashRegisterCandidates,
      cashuCandidates,
    ] = await Promise.all(
      run.deps.evolu.loadQueries([
        ibanReconciliationCandidateByAccountTransactionIdQuery(
          accountTransactionId
        ),
        sparkReconciliationCandidateByAccountTransactionIdQuery(
          accountTransactionId
        ),
        cashRegisterReconciliationCandidateByAccountTransactionIdQuery(
          accountTransactionId
        ),
        cashuReconciliationCandidateByAccountTransactionIdQuery(
          accountTransactionId
        ),
      ])
    )
    const candidate =
      ibanCandidates[0] ??
      sparkCandidates[0] ??
      cashRegisterCandidates[0] ??
      cashuCandidates[0]
    if (!candidate) {
      const [transaction] = await run.deps.evolu.loadQuery(
        selfPayTransactionByIdQuery(accountTransactionId)
      )
      if (transaction === undefined) return ok(null)

      return await run.deps.lockManager.request(
        SELF_PAY_ARRIVAL_LOCK,
        async () => {
          const reconciliation = await run.ok(
            loadSelfPayReconciliation({
              ...transaction,
              firstSeenAt: TimestampMsSchema.decode(
                Date.parse(transaction.createdAt)
              ),
            })
          )
          if (reconciliation === null) return ok(null)

          await runMutationWithCompletion((options) =>
            upsertAutomaticReconciliationRows(run.deps.evolu, reconciliation, {
              ...options,
              owner: run.deps.evoluOwner,
            })
          )
          return ok(reconciliation.claim.paymentId)
        }
      )
    }

    await run.ok(
      writeClaimAndCloseBillIfCovered({
        ...createAutomaticReconciliationClaim(
          candidate.paymentId,
          accountTransactionId,
          run.deps.date.now()
        ),
      })
    )

    return ok(candidate.paymentId)
  }
