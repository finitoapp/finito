import {
  deriveBillSummaryTotal,
  deriveBillTotalAfterLines,
} from "../bill-line/bill-line-utils.ts"
/**
 * The read-and-validate half of the bill module: everything that answers "what
 * state is this bill in, and may the caller do X to it" without writing
 * anything. `bill-actions.ts` holds the mutations and composes these.
 *
 * Split out because the two halves share only the bill id: the guards are a
 * coherent vocabulary of their own (`loadBillStatusSnapshot` ->
 * `requireBillInStatus` -> `requireEditableBill`/`requireCancelableBill`),
 * they carry most of the module's doc comments about the lifecycle in
 * docs/bill-payment-states.md, and they are what every other module reaches
 * for. The errors live here too, since a guard is what raises them —
 * `billLineSummaryMissing` stays with the mutations that produce it, and
 * `CatalogItemNotFound` with the catalog-item module whose row is missing.
 */

import { err, ok, type Result, type Task } from "@evolu/common"

import type { DateDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import type {
  AccountTransactionId,
  AccountTransactionKind,
} from "../account-transaction/account-transaction-types.ts"
import type { BillLineRow } from "../bill-line/bill-line.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { quotedAmountSats } from "../shared/claimed-amount.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { getFirstOr } from "../shared/result.ts"
import {
  type Currency,
  type FiatCurrency,
  type NonNegativeInteger,
  type TimestampMs,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { BillRow } from "./bill.ts"
import {
  claimedTransactionsByBillIdQuery,
  paymentsByBillIdQuery,
} from "./bill-coverage-queries.ts"
import { billByIdQuery } from "./bill-queries.ts"
import type { BillCoverage, BillId, BillStatus } from "./bill-types.ts"
import {
  type ClaimedTransaction,
  calculateClaimedSum,
  claimedPaymentIdSet,
  deriveBillCoverage,
  deriveBillStatus,
  hasPendingPayment,
} from "./bill-utils.ts"

export interface BillWithItems {
  readonly bill: BillRow
  readonly items: ReadonlyArray<BillLineSummary>
}

export const createBillNotFoundError = defineError("BillNotFound")<{
  readonly id: BillId
}>()
export type BillNotFoundError = ReturnType<typeof createBillNotFoundError>
/**
 * A bill whose derived status is not one the caller accepts.
 *
 * Carries `allowedStatuses` because the status alone does not explain the
 * refusal: this used to be `BillNotOpen`, which was true every time it fired
 * and still told the operator nothing — `requireCancelableBill` accepts a
 * `canceled` bill and rejects a `closed` one, and `closeBill` accepts
 * `closed`. Neither of those is about being open. `bin/cli-bills.ts` prints
 * the error verbatim, so the payload is the message.
 */
export const createBillStatusNotAllowedError = defineError(
  "BillStatusNotAllowed"
)<{
  readonly id: BillId
  readonly status: BillStatus
  readonly allowedStatuses: ReadonlyArray<BillStatus>
}>()
export type BillStatusNotAllowedError = ReturnType<
  typeof createBillStatusNotAllowedError
>
export const createBillLockedError = defineError("BillLocked")<{
  readonly id: BillId
}>()
export type BillLockedError = ReturnType<typeof createBillLockedError>
export const createBillUnderpaidError = defineError("BillUnderpaid")<{
  readonly id: BillId
  readonly billTotal: NonNegativeInteger
  readonly claimedSum: NonNegativeInteger
}>()
export type BillUnderpaidError = ReturnType<typeof createBillUnderpaidError>
export const createBillNotCanceledError = defineError("BillNotCanceled")<{
  readonly id: BillId
}>()
export type BillNotCanceledError = ReturnType<typeof createBillNotCanceledError>
const createBillSplitSelectionStaleError = defineError(
  "BillSplitSelectionStale"
)<{
  readonly billId: BillId
  readonly summaryId: BillLineSummary["id"]
  readonly selectedQuantity: number
  readonly availableQuantity: number
  readonly selectedTotalAmount: number
  readonly availableTotalAmount: number
}>()
export type BillSplitSelectionStaleError = ReturnType<
  typeof createBillSplitSelectionStaleError
>
export const loadBill =
  (idValue: BillId): Task<BillRow, BillNotFoundError, EvoluDep> =>
  async (run) =>
    getFirstOr(
      await run.deps.evolu.loadQuery(billByIdQuery(idValue)),
      createBillNotFoundError({ id: idValue })
    )
export interface BillCoverageSummary {
  readonly billTotal: NonNegativeInteger
  readonly claimedSum: NonNegativeInteger
  readonly coverage: BillCoverage
}

/**
 * Shared "bill's line-item total + its claimed transactions" load behind
 * `loadBillCoverage` and `loadBillClosedAtIfCovered`.
 */
const loadBillTotalAndClaimedSum =
  (
    billId: BillId
  ): Task<
    {
      readonly summaries: ReadonlyArray<BillLineSummary>
      readonly billTotal: NonNegativeInteger
      readonly claimedTransactions: ReadonlyArray<ClaimedTransaction>
    },
    never,
    EvoluDep
  > =>
  async (run) => {
    const [summaries, claimedTransactions] = await Promise.all([
      run.ok(loadCalculatedBillLineSummaries(billId)),
      run.deps.evolu.loadQuery(claimedTransactionsByBillIdQuery(billId)),
    ])

    return ok({
      summaries,
      billTotal: deriveBillSummaryTotal(summaries),
      claimedTransactions,
    })
  }
/**
 * Compares a bill's line-item total against what has actually been claimed
 * as paid across all of its payments, independent of `bill.status`. See
 * docs/bill-payment-states.md.
 */
export const loadBillCoverage =
  (billId: BillId): Task<BillCoverageSummary, never, EvoluDep> =>
  async (run) => {
    const { billTotal, claimedTransactions } = await run.ok(
      loadBillTotalAndClaimedSum(billId)
    )
    const claimedSum = calculateClaimedSum(claimedTransactions)

    return ok({
      billTotal,
      claimedSum,
      coverage: deriveBillCoverage(billTotal, claimedSum),
    })
  }
export interface BillStatusSnapshot {
  readonly bill: BillRow
  /**
   * The line summaries the status and coverage above were derived from —
   * handed back so a caller that needs the bill's items too (`splitBill`)
   * reads the same projection this guard just judged, instead of loading a
   * second, independent one alongside it.
   */
  readonly items: ReadonlyArray<BillLineSummary>
  readonly status: BillStatus
  readonly coverage: BillCoverage
  readonly billTotal: NonNegativeInteger
  readonly claimedSum: NonNegativeInteger
  /** Whether at least one payment on this bill has an active claim. */
  readonly hasActiveClaim: boolean
}

/**
 * Loads a bill together with its live-derived status and coverage — the
 * one place that composes `deriveBillStatus` from the bill row's
 * `canceledAt`/`confirmedClosedAt` and its payments' coverage. Every guard
 * below reads through this instead of any stored field, so a bill's
 * editability/cancelability is always computed fresh. See
 * docs/bill-payment-states.md.
 */
export const loadBillStatusSnapshot =
  (billId: BillId): Task<BillStatusSnapshot, BillNotFoundError, EvoluDep> =>
  async (run) => {
    const billResult = await run(loadBill(billId))
    if (!billResult.ok) return billResult

    const { summaries, billTotal, claimedTransactions } = await run.ok(
      loadBillTotalAndClaimedSum(billId)
    )
    const claimedSum = calculateClaimedSum(claimedTransactions)
    const coverage = deriveBillCoverage(billTotal, claimedSum)
    const hasActiveClaim = claimedTransactions.length > 0
    const status = deriveBillStatus({
      canceledAt: billResult.value.canceledAt,
      confirmedClosedAt: billResult.value.confirmedClosedAt,
      hasActiveClaim,
      coverage,
    })

    return ok({
      bill: billResult.value,
      items: summaries,
      status,
      coverage,
      billTotal,
      claimedSum,
      hasActiveClaim,
    })
  }
/**
 * Reactive-free (`Task`) equivalent of `useBillStatus` — a bill's current
 * derived status, and nothing else.
 *
 * Kept as a named reader even though it is one field off
 * `loadBillStatusSnapshot`: every guard in this file needs the rest of that
 * snapshot (coverage, totals, the summaries), so they take the whole thing,
 * and a caller that only wants to *ask* a bill's status should not have to
 * know which of its seven fields to reach for. That is the whole of its
 * current use — the tests, and any non-reactive caller outside React.
 */
export const loadBillStatus =
  (billId: BillId): Task<BillStatus, BillNotFoundError, EvoluDep> =>
  async (run) => {
    const snapshotResult = await run(loadBillStatusSnapshot(billId))
    if (!snapshotResult.ok) return snapshotResult
    return ok(snapshotResult.value.status)
  }
/**
 * Loads a bill and rejects it unless its *derived* status is one of
 * `allowedStatuses`. Used to guard domain invariants around the `open` ->
 * `closed`/`canceled` lifecycle before a mutation is applied. See
 * `docs/bill-payment-states.md`.
 */
const requireBillInStatus =
  (
    billId: BillId,
    allowedStatuses: ReadonlySet<BillStatus>
  ): Task<
    BillStatusSnapshot,
    BillNotFoundError | BillStatusNotAllowedError,
    EvoluDep
  > =>
  async (run) => {
    const snapshotResult = await run(loadBillStatusSnapshot(billId))
    if (!snapshotResult.ok) return snapshotResult

    const { status } = snapshotResult.value
    if (!allowedStatuses.has(status)) {
      return err(
        createBillStatusNotAllowedError({
          id: billId,
          status,
          allowedStatuses: [...allowedStatuses],
        })
      )
    }

    return snapshotResult
  }
const openBillStatuses: ReadonlySet<BillStatus> = new Set(["open"])
/**
 * Whether a bill currently has a live (pending) payment attempt — see
 * `hasPendingPayment`.
 */
const isBillLocked =
  (billId: BillId): Task<boolean, never, EvoluDep & DateDep> =>
  async (run) => {
    // `claimedTransactions`, not `claimedPayments` — see
    // `claimedPaymentIdSet`. `loadBillStatusSnapshot` loads the same rows for
    // its coverage, but this runs concurrently with it (see
    // `requireEditableBill`), so sharing them would cost the round trip that
    // concurrency just saved. Two concurrent reads of one query is the
    // cheaper half of that trade.
    const [payments, claimedTransactions] = await Promise.all([
      run.deps.evolu.loadQuery(paymentsByBillIdQuery(billId)),
      run.deps.evolu.loadQuery(claimedTransactionsByBillIdQuery(billId)),
    ])

    return ok(
      hasPendingPayment(
        payments,
        claimedPaymentIdSet(claimedTransactions),
        run.deps.date.now()
      )
    )
  }
/**
 * A bill that currently accepts line/table edits: `open`, and not locked by
 * a live payment attempt. This is the guard behind every cart-editing
 * action (`addCatalogItemToBill`, `addManualAmountToBill`, `addTipToBill`,
 * `appendRemoveBillLine`, `splitBill`). See docs/bill-payment-states.md.
 */
export const requireEditableBill =
  (
    billId: BillId
  ): Task<
    BillStatusSnapshot,
    BillNotFoundError | BillStatusNotAllowedError | BillLockedError,
    EvoluDep & DateDep
  > =>
  async (run) => {
    // Independent reads, so they run concurrently rather than one after the
    // other: the status guard does not depend on the lock check and vice
    // versa. This guard sits on every cart tap, and awaiting them in sequence
    // cost a second round trip per tap. Errors are still reported in the same
    // order — status before lock, pinned by a test — the same
    // concurrently-read-then-check-in-order shape `splitBill` uses.
    const [billResult, locked] = await Promise.all([
      run(requireBillInStatus(billId, openBillStatuses)),
      run.ok(isBillLocked(billId)),
    ])
    if (!billResult.ok) return billResult
    if (locked) return err(createBillLockedError({ id: billId }))

    return billResult
  }
/**
 * A bill that can accept a new payment attempt: still `open`. Unlike
 * `requireEditableBill`, this deliberately does **not** check for an
 * existing pending payment — starting a second/split payment attempt while
 * another is still pending and unresolved is allowed. Guards here are
 * best-effort for the common single-device path, not a proof, under
 * CRDT/multi-device concurrency. Exported for `payment-actions.ts`'s
 * `createPayment`. See docs/bill-payment-states.md.
 */
export const requireBillAcceptingPayment = (billId: BillId) =>
  requireBillInStatus(billId, openBillStatuses)
const cancelableBillStatuses: ReadonlySet<BillStatus> = new Set([
  "open",
  "canceled",
])
/**
 * Allows re-canceling an already-`canceled` bill as an idempotent no-op, but
 * rejects a `closed` one — once a bill is fully settled it is closed and
 * final, never cancelable.
 */
export const requireCancelableBill = (billId: BillId) =>
  requireBillInStatus(billId, cancelableBillStatuses)
/**
 * Given a payment about to gain (or that just gained) a claim, checks
 * whether its bill's coverage is now fully covered (`paid`/`overpaid`,
 * i.e. no longer `underpaid`) and, if so, returns the `closedAt` write
 * ready to fold into the caller's own mutation batch alongside the claim
 * insert — see `upsertBillClosedAt`. Returns `null` when the payment has no
 * bill or the bill isn't (yet) fully covered.
 *
 * Unlike a `status` transition, this no longer excludes `canceled` bills:
 * `closedAt` is just a best-effort cache of "when did this bill's coverage
 * stop being underpaid", independent of `canceledAt` (see `bill.ts`'s doc
 * comment). A cancellation is never overridden by this — the *derived*
 * status still reads `canceled` until staff explicitly resolves it via
 * `confirmBillClosedDespiteCancellation`. See docs/bill-payment-states.md.
 */
export const loadBillClosedAtIfCovered =
  (
    payment: {
      readonly id: PaymentId
      readonly billId: BillId | null
      readonly amount: NonNegativeInteger
      readonly currency: FiatCurrency
      readonly tipAmount: NonNegativeInteger
      /** The quotes `quotedAmountSats` picks from; see `calculateClaimedSum`. */
      readonly btcAmountSats: NonNegativeInteger | null
      readonly cashuAmountSats: NonNegativeInteger | null
      readonly lightningAddressAmountSats: NonNegativeInteger | null
    },
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
    if (payment.billId === null) return ok(null)

    const billResult = await run(loadBill(payment.billId))
    if (!billResult.ok) return ok(null)

    const { billTotal, claimedTransactions } = await run.ok(
      loadBillTotalAndClaimedSum(payment.billId)
    )
    // The new claim isn't written yet, so it can't show up in
    // `claimedTransactions` — append it here. If it's a retry of a claim
    // that (per a concurrent write) already landed, `calculateClaimedSum`'s
    // own dedup-by-transaction-id collapses the duplicate, so this never
    // double-counts.
    //
    // It carries the claimed transaction's own amount and currency, the same
    // thing `claimedTransactionsByBillIdQuery` reads for every claim that is
    // already written. Standing in the payment's nominal amount instead made
    // this cache decide `paid` on a number the live `deriveBillStatus` never
    // computes — a bill would vanish from the floor view while every guard
    // still read it as open.
    const claimedSum = calculateClaimedSum([
      ...claimedTransactions,
      {
        paymentId: payment.id,
        accountTransactionId: claimedTransaction.id,
        amount: claimedTransaction.amount,
        currency: claimedTransaction.currency,
        tipAmount: payment.tipAmount,
        paymentAmount: payment.amount,
        paymentCurrency: payment.currency,
        paymentAmountSats: quotedAmountSats(claimedTransaction.kind, {
          btc: payment.btcAmountSats,
          cashu: payment.cashuAmountSats,
          lightningAddress: payment.lightningAddressAmountSats,
        }),
      },
    ])

    if (deriveBillCoverage(billTotal, claimedSum) === "underpaid") {
      return ok(null)
    }

    return ok({
      billId: payment.billId,
      // Preserve the bill's original closing time across an idempotent
      // re-close (e.g. a second split payment confirmed after the bill
      // already closed) instead of overwriting it with `now()` every time.
      closedAt:
        billResult.value.closedAt ??
        TimestampMsSchema.decode(run.deps.date.now().getTime()),
    })
  }
export interface SelectedLineTotals {
  readonly quantity: number
  readonly totalAmount: number
}

/**
 * Sums a split selection per line, keyed by `BillLineSummary["id"]` (stable
 * per bill/catalogItemId/itemId/type — see `createBillLineSummaryId`), and
 * rejects it unless the source bill actually still holds at least that much
 * of every selected line.
 *
 * Without this check `buildSplitLines` wrote a `remove` on the source and an
 * `add` on the target for whatever the caller passed. A stale selection —
 * the split screen was opened, then the line was reduced or removed, here or
 * on another device — therefore *invented money*: the source's own summaries
 * clamp at zero (`calculateBillLineSummaries` drops a line once its running
 * quantity does, and floors its amount at 0), so the source looked fine while
 * the target gained an `add` for an amount the source never carried. Selecting
 * 3x1000 of a line the source had once over meant 1000 on one bill before the
 * split and 3000 across two bills after it, reported as success.
 *
 * Summing per id matters as much as the comparison: a caller may legitimately
 * pass the same line twice (two partial quantities of one line), and taking
 * only the last entry would both wave through an over-selection and misjudge
 * the emptiness check in `cancelSourceBillIfEmptied`.
 *
 * Deliberately an error rather than a clamp. Each selected line carries its
 * own `totalAmount`, and trimming a quantity gives no sound way to recompute
 * it — a net summary does not expose a unit price for manual amounts — so
 * "move as much as is there" cannot be answered exactly. Refusing leaves the
 * money untouched and sends the operator back to a selection that reflects
 * the bill. Best-effort against concurrent writes, like every other guard
 * here; see docs/bill-payment-states.md.
 */
export const requireSelectionOnSourceBill = (
  sourceBillId: BillId,
  currentSummaries: ReadonlyArray<BillLineSummary>,
  items: ReadonlyArray<BillLineSummary>
): Result<
  ReadonlyMap<BillLineSummary["id"], SelectedLineTotals>,
  BillSplitSelectionStaleError
> => {
  const selectedById = new Map<BillLineSummary["id"], SelectedLineTotals>()
  for (const item of items) {
    const selected = selectedById.get(item.id)
    selectedById.set(item.id, {
      quantity: (selected?.quantity ?? 0) + item.quantity,
      totalAmount: (selected?.totalAmount ?? 0) + item.totalAmount,
    })
  }

  const availableById = new Map(
    currentSummaries.map((summary) => [summary.id, summary])
  )
  for (const [summaryId, selected] of selectedById) {
    // A missing id covers more than "the line is gone": the id is derived
    // from the bill too, so a selection belonging to another bill, or to a
    // since-repriced item snapshot, lands here as well.
    const available = availableById.get(summaryId)
    if (
      available === undefined ||
      selected.quantity > available.quantity ||
      selected.totalAmount > available.totalAmount
    ) {
      return err(
        createBillSplitSelectionStaleError({
          billId: sourceBillId,
          summaryId,
          selectedQuantity: selected.quantity,
          availableQuantity: available?.quantity ?? 0,
          selectedTotalAmount: selected.totalAmount,
          availableTotalAmount: available?.totalAmount ?? 0,
        })
      )
    }
  }

  return ok(selectedById)
}

const createBillSplitLeavesOverpaymentError = defineError(
  "BillSplitLeavesOverpayment"
)<{
  readonly billId: BillId
  readonly claimedSum: NonNegativeInteger
  readonly totalAfterSplit: NonNegativeInteger
}>()
export type BillSplitLeavesOverpaymentError = ReturnType<
  typeof createBillSplitLeavesOverpaymentError
>

export const requireSplitLeavingNoOverpayment = (
  source: BillStatusSnapshot,
  lines: ReadonlyArray<Omit<BillLineRow, "id">>
): Result<undefined, BillSplitLeavesOverpaymentError> => {
  const totalAfterSplit = deriveBillTotalAfterLines(
    source.items,
    lines.filter((line) => line.billId === source.bill.id)
  )
  return source.claimedSum > totalAfterSplit
    ? err(
        createBillSplitLeavesOverpaymentError({
          billId: source.bill.id,
          claimedSum: source.claimedSum,
          totalAfterSplit,
        })
      )
    : ok(undefined)
}
