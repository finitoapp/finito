import type { DefaultPaymentMethod } from "../app-settings/app-settings-types.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import { deriveBillSummaryTotal } from "../bill-line/bill-line-utils.ts"
import { isCashPayable } from "../payment/payment-cash-utils.ts"
import { derivePaymentStatus } from "../payment/payment-status-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import {
  type ClaimedAmount,
  toPaymentCurrencyAmount,
} from "../shared/claimed-amount.ts"
import {
  type FiatCurrency,
  type Integer,
  NonNegativeInteger,
  type TimestampMs,
} from "../shared/schema.ts"
import type { BillCoverage, BillStatus } from "./bill-types.ts"

/**
 * Whether goods can be charged through `method`: what they come to, rounded
 * the way that method hands money over, is more than zero (payment/0012).
 * Only cash rounds — a CZK bill of 0.40 rounds to no crowns at all in cash
 * (`isCashPayable`, payment/0002), and stays 0.40 on a card. `method` is
 * `null` where no payment method is turned on at all: nothing rounds then,
 * and the goods are judged as they stand.
 *
 * `goodsTotal` leaves the tip out — a bill's tip lines
 * (`deriveBillGoodsTotal`), a keypad payment's `tipAmount`: a tip is not
 * what the goods are worth, and must not lift goods that come to nothing
 * into something that can be paid. A bill whose goods come to exactly zero
 * is closed without payment instead (`closeZeroBill`, payment/0013).
 *
 * A payment offers several methods at once, so `createPayment` and both
 * apps' checkout ask it of each method through `isPayableThroughAnyMethod`.
 */
export const isBillPayable = ({
  goodsTotal,
  currency,
  method,
}: {
  readonly goodsTotal: Integer
  readonly currency: FiatCurrency
  readonly method: DefaultPaymentMethod | null
}): boolean => {
  if (goodsTotal <= 0) return false
  if (method !== "cashRegister") return true

  return isCashPayable({
    amount: NonNegativeInteger(goodsTotal),
    tipAmount: NonNegativeInteger(0),
    currency,
  })
}

/**
 * Whether a payment can be created for goods of `goodsTotal`: at least one
 * of the payment methods it will offer (`derivePaymentMethodsOffered`) can
 * collect more than zero once it rounds them (`isBillPayable`, payment/0012).
 * Only cash rounds, so this refuses goods above zero only where cash is the
 * one method on and rounds them to nothing — a cash-only shop and a CZK
 * charge of 0.01–0.49. With no method turned on at all nothing rounds, the
 * goods are judged as they stand, and the payment screen says what is
 * missing.
 *
 * The one rule `createPayment` enforces (`NoPayableMethod`) and both apps'
 * cart checks before it offers Charge (`deriveBillCheckout`), so they cannot
 * disagree.
 */
export const isPayableThroughAnyMethod = ({
  goodsTotal,
  currency,
  methods,
}: {
  readonly goodsTotal: Integer
  readonly currency: FiatCurrency
  readonly methods: ReadonlyArray<DefaultPaymentMethod>
}): boolean =>
  methods.length === 0
    ? isBillPayable({ goodsTotal, currency, method: null })
    : methods.some((method) => isBillPayable({ goodsTotal, currency, method }))

/** Why `deriveZeroBillRefusal` will not let a bill be finished at zero. */
export type ZeroBillRefusal = "noLines" | "tipLine" | "totalNotZero"

/**
 * Why a bill's netted lines cannot be finished without a payment
 * (`closeZeroBill`, payment/0013), or `null` when they can: at least one
 * line once adds and removes are netted — an empty cart is not a sale — no
 * tip line, since nobody pays a tip on a bill that is never charged, and
 * goods that come to exactly zero.
 *
 * The one rule behind `closeZeroBill` and both apps' Finish button, which
 * stands in for Charge exactly when this returns `null`.
 */
export const deriveZeroBillRefusal = (
  items: ReadonlyArray<BillLineSummary>
): ZeroBillRefusal | null => {
  if (items.length === 0) return "noLines"
  if (items.some((item) => item.type === "tip")) return "tipLine"
  if (deriveBillSummaryTotal(items) !== 0) return "totalNotZero"
  return null
}

/**
 * What a cart write does to an open bill, judged on the total it leaves:
 *
 * - `keep-open`: write the lines, the bill stays open;
 * - `close`: write the lines and, in the same batch, `closedAt` — the write
 *   brings the bill's total down to exactly what its payments have paid, so
 *   its derived status turns `closed` the moment the lines land;
 * - `reject`: write nothing — the total would drop below what has been paid.
 */
export type CartWriteClosing = "keep-open" | "close" | "reject"

/**
 * Whether a write to an open bill's cart keeps it open, closes it or is
 * refused (payment/0014), from the total the bill's lines would come to after
 * the write and what its payments have paid:
 *
 * - no active claim: `keep-open`, whatever the total — closing by coverage
 *   needs a claim (`deriveBillStatus`), so a bill nobody paid for, an empty
 *   cart or one whose goods come to zero (`closeZeroBill`) included, is never
 *   closed by a cart write;
 * - a total above what was paid: `keep-open`, the rest is still owed;
 * - a total equal to it: `close` — the write itself pays the bill off, as
 *   taking an item off a partly paid bill does, and `closedAt` has to be
 *   written with it or the bill hangs on the floor view while every guard
 *   already reads it closed;
 * - a total below it: `reject` — the bill would close overpaid and hand money
 *   back outside a refund, which is where returning money belongs.
 *
 * Compares the numbers themselves rather than going through
 * `deriveBillCoverage`, so it holds for any total, one a discount takes below
 * zero included. `billTotalAfter` is the bill's whole total, tip lines
 * included, the same total coverage compares against.
 */
export const deriveCartWriteClosing = ({
  billTotalAfter,
  claimedSum,
  hasActiveClaim,
}: {
  readonly billTotalAfter: Integer
  readonly claimedSum: NonNegativeInteger
  readonly hasActiveClaim: boolean
}): CartWriteClosing => {
  if (!hasActiveClaim) return "keep-open"
  if (billTotalAfter > claimedSum) return "keep-open"
  return billTotalAfter === claimedSum ? "close" : "reject"
}

/**
 * Derives a bill's display status, in precedence order (first match wins):
 * `confirmedClosedAt` > `canceledAt` > coverage > `open`. Mirrors
 * `derivePaymentStatus`'s shape and reasoning:
 *
 * - `confirmedClosedAt` is staff confirming the bill closed, from either of
 *   two places: the resolution of the canceled+funded collision (see
 *   `confirmBillClosedDespiteCancellation`), or closing a bill whose goods
 *   come to exactly zero, which no payment can settle (`closeZeroBill`,
 *   payment/0013). It outranks `canceledAt` on purpose, the same way
 *   `payment.confirmedPaidAt` outranks `payment.canceledAt`, and it makes the
 *   closing final: a line another device adds afterwards leaves the bill
 *   closed and underpaid rather than open again.
 * - `canceledAt` otherwise wins over coverage: an explicit discard is not
 *   silently undone just because a stray/late claim happens to cover the
 *   total (see docs/bill-payment-states.md).
 * - Coverage only counts as "closed" together with `hasActiveClaim` — a
 *   brand-new bill with no line items yet also has `billTotal === 0 ===
 *   claimedSum` (trivially "paid" by `deriveBillCoverage`'s own definition),
 *   but must stay `open`/editable until an actual payment has been claimed
 *   for it. Requiring at least one claim is what keeps that fresh-empty-cart
 *   case from reading as instantly `closed`. A bill that totals zero with
 *   lines on it is not closed by coverage either: staff close it explicitly,
 *   through `confirmedClosedAt` above.
 */
export const deriveBillStatus = ({
  canceledAt,
  confirmedClosedAt,
  hasActiveClaim,
  coverage,
}: {
  readonly canceledAt: TimestampMs | null
  readonly confirmedClosedAt: TimestampMs | null
  readonly hasActiveClaim: boolean
  readonly coverage: BillCoverage
}): BillStatus => {
  if (confirmedClosedAt !== null) return "closed"
  if (canceledAt !== null) return "canceled"
  return hasActiveClaim && coverage !== "underpaid" ? "closed" : "open"
}

/**
 * Compares what has actually been claimed as paid against a bill's
 * line-item total, independent of `bill.status`. See
 * docs/bill-payment-states.md.
 *
 * A total below zero — discounts outweighing the goods — is owed as nothing,
 * so it compares as zero: a negative bill nobody paid reads `paid`, not
 * `overpaid`, on every screen that shows coverage, and one with money claimed
 * against it reads `overpaid` by all of that money. Its status does not move:
 * closing by coverage still needs a claim (`deriveBillStatus`), and a cart
 * write cannot take a paid bill below what was paid (`deriveCartWriteClosing`,
 * payment/0014), so a negative bill stays open until it is discarded
 * (payment/0015).
 */
export const deriveBillCoverage = (
  billTotal: Integer,
  claimedSum: NonNegativeInteger
): BillCoverage => {
  const owed = deriveBillOwedAmount(billTotal)
  if (claimedSum === owed) return "paid"
  return claimedSum < owed ? "underpaid" : "overpaid"
}

/** What a bill's payments are measured against: its total, never below zero. */
const deriveBillOwedAmount = (billTotal: Integer): NonNegativeInteger =>
  NonNegativeInteger(Math.max(0, billTotal))

/**
 * How far what was claimed is from what a bill owes — the amount a coverage
 * warning says is missing or paid over. Measured against the same owed amount
 * `deriveBillCoverage` judged, so a negative bill with money on it is overpaid
 * by all of that money, not by more.
 */
export const deriveBillCoverageDelta = (
  billTotal: Integer,
  claimedSum: NonNegativeInteger
): NonNegativeInteger =>
  NonNegativeInteger(Math.abs(deriveBillOwedAmount(billTotal) - claimedSum))

/**
 * One claimed transaction as the bill-coverage queries return it: the
 * shared money fields plus which payment it settles and that payment's tip.
 */
export interface ClaimedTransaction extends ClaimedAmount {
  readonly paymentId: PaymentId
  readonly tipAmount: NonNegativeInteger
}

/**
 * Sums, per payment, the non-tip portion of every distinct account
 * transaction actively claimed against it, then adds those per-payment
 * totals together.
 *
 * The dedup-by-transaction-id rule and the currency conversion both come
 * from `sumDistinctClaimedAmounts`, which the payment's own
 * excess-settlement check uses too; what this adds is the tip. Tip is
 * subtracted only once per payment (it's an attribute of the payment, not
 * of any one transaction), and a payment whose transactions still fall
 * short of its tip (a partial, incomplete split) contributes zero rather
 * than a negative amount.
 */
export const calculateClaimedSum = (
  claimedTransactions: ReadonlyArray<ClaimedTransaction>
): NonNegativeInteger => {
  const uniqueTransactions = new Map(
    claimedTransactions.map((transaction) => [
      transaction.accountTransactionId,
      transaction,
    ])
  )

  // Gross and tip travel together per payment rather than in two parallel
  // maps: the tip is only meaningful against the gross it is subtracted from,
  // and keeping them apart made it possible to look one up without the other.
  //
  // Every row of a payment carries that payment's own `tipAmount`, joined from
  // the same `payment` row, so through either current query these values
  // always agree and the `max` below is whichever one they all are. Nothing
  // enforces that though — a widened join would break it silently — and
  // taking whichever row was read last would then be a coin flip in one of
  // two directions. Too small a tip inflates the claimed sum, and an inflated
  // sum can read a bill as covered while money is still missing. The largest
  // tip can only leave a bill looking *less* covered, which staff notice.
  const claimedByPayment = new Map<
    PaymentId,
    { readonly gross: number; readonly tip: NonNegativeInteger }
  >()
  for (const transaction of uniqueTransactions.values()) {
    const { paymentId, tipAmount } = transaction
    const claimed = claimedByPayment.get(paymentId)
    claimedByPayment.set(paymentId, {
      gross: (claimed?.gross ?? 0) + toPaymentCurrencyAmount(transaction),
      tip:
        claimed === undefined
          ? tipAmount
          : NonNegativeInteger(Math.max(claimed.tip, tipAmount)),
    })
  }

  return NonNegativeInteger(
    [...claimedByPayment.values()].reduce(
      (sum, { gross, tip }) => sum + Math.max(0, gross - tip),
      0
    )
  )
}

export interface BillHistoryItemSummary {
  readonly status: BillStatus
  /**
   * The canceled+funded collision from docs/bill-payment-states.md: the
   * bill was discarded, but its payments already cover its total —
   * `deriveBillStatus` still reads `canceled` until staff explicitly
   * resolves it via `confirmBillClosedDespiteCancellation`.
   */
  readonly hasCancellationCollision: boolean
  /**
   * Staff closed the bill without a payment, its goods coming to exactly
   * zero (`closeZeroBill`): `confirmedClosedAt` with no `canceledAt` beside
   * it, which the collision resolution always has. Such a bill that reads
   * `underpaid` had a line added by a device that had not yet seen it
   * closed (payment/0013).
   */
  readonly closedWithoutPayment: boolean
  readonly billTotal: Integer
  readonly claimedSum: NonNegativeInteger
  readonly coverage: BillCoverage
}

/**
 * Combines a bill's `canceledAt`/`confirmedClosedAt`, its precomputed
 * `billTotal` (from `calculateBillLineSummaries`), and its claimed
 * transactions into its derived status, coverage and cancellation collision.
 * The history list (`BillHistory`) and the detail screens (`useBillStatus`)
 * both read it, so they cannot disagree. See docs/bill-payment-states.md.
 */
export const deriveBillHistoryItemSummary = ({
  canceledAt,
  confirmedClosedAt,
  billTotal,
  claimedTransactions,
}: {
  readonly canceledAt: TimestampMs | null
  readonly confirmedClosedAt: TimestampMs | null
  readonly billTotal: Integer
  readonly claimedTransactions: ReadonlyArray<ClaimedTransaction>
}): BillHistoryItemSummary => {
  const claimedSum = calculateClaimedSum(claimedTransactions)
  const coverage = deriveBillCoverage(billTotal, claimedSum)
  const hasActiveClaim = claimedTransactions.length > 0
  const status = deriveBillStatus({
    canceledAt,
    confirmedClosedAt,
    hasActiveClaim,
    coverage,
  })

  return {
    status,
    hasCancellationCollision:
      canceledAt !== null &&
      confirmedClosedAt === null &&
      hasActiveClaim &&
      coverage !== "underpaid",
    closedWithoutPayment: confirmedClosedAt !== null && canceledAt === null,
    billTotal,
    claimedSum,
    coverage,
  }
}

/**
 * Which of a bill's payments count as settled, from its claimed *transaction*
 * rows — shared by `isBillLocked` (`bill-actions.ts`) and
 * `usePendingPayments` (the reactive equivalent) so the Task guard and the UI
 * lock can never answer this differently. That sharing is the point; see
 * `hasPendingPayment` below.
 *
 * The `paymentId` parameter is load-bearing, not incidental: payment rows key
 * their own id as `id`, so handing this the payments that merely *have* a
 * claim — the drift it exists to prevent — is a type error rather than a
 * plausible-looking set.
 *
 * Built from `claimedTransactionsByBillIdQuery` rather than
 * `claimedPaymentsByBillIdQuery`, i.e. from claims whose account transaction
 * is actually present. A claim on its own is not evidence that money arrived:
 * `calculateClaimedSum` cannot count a transaction that is not there, so
 * feeding the lock the looser "has any claim at all" reading let a bill read
 * `open` with coverage 0 while its payment still displayed as paid — and the
 * cart stayed editable underneath an outstanding payment, which is the one
 * thing the lock exists to prevent.
 *
 * The cost is a transient false lock during the sync window where a claim has
 * arrived from another device and its transaction has not. That resolves
 * itself, and errs towards keeping a cart still rather than letting it move
 * under a customer who is mid-payment.
 */
export const claimedPaymentIdSet = (
  claimedTransactions: ReadonlyArray<{ readonly paymentId: PaymentId }>
): ReadonlySet<PaymentId> =>
  new Set(claimedTransactions.map((transaction) => transaction.paymentId))

/**
 * The ids of every *live* payment attempt on a bill — one whose derived
 * status (see `derivePaymentStatus`) is `pending`. This is the basis of the
 * bill's editing lock: `editable = bill.status === "open" && !hasPendingPayment(...)`.
 * Nothing is stored for this — it is recomputed from the payment rows every
 * time, so the lock clears itself the moment the live payment resolves
 * (paid, canceled, or expires), with no separate "unlock" step. See
 * docs/bill-payment-states.md.
 */
export const derivePendingPaymentIds = (
  payments: ReadonlyArray<{
    readonly id: PaymentId
    readonly canceledAt: TimestampMs | null
    readonly expiresAt: TimestampMs | null
  }>,
  claimedPaymentIds: ReadonlySet<PaymentId>,
  now: Date
): ReadonlyArray<PaymentId> =>
  payments
    .filter(
      (payment) =>
        derivePaymentStatus({
          canceledAt: payment.canceledAt,
          // `confirmedPaidAt` can only ever be set once `canceledAt` already
          // is (see `confirmPaymentPaidDespiteCancellation`), and both of
          // those branches resolve to a non-"pending" status ahead of this
          // one — so passing `null` here can never change whether a bill
          // counts as locked. Not selected by this query on purpose, to
          // avoid widening it for a value that can't affect the result.
          confirmedPaidAt: null,
          expiresAt: payment.expiresAt,
          hasActiveClaim: claimedPaymentIds.has(payment.id),
          now,
        }) === "pending"
    )
    .map((payment) => payment.id)

export const hasPendingPayment = (
  payments: ReadonlyArray<{
    readonly id: PaymentId
    readonly canceledAt: TimestampMs | null
    readonly expiresAt: TimestampMs | null
  }>,
  claimedPaymentIds: ReadonlySet<PaymentId>,
  now: Date
): boolean =>
  derivePendingPaymentIds(payments, claimedPaymentIds, now).length > 0
