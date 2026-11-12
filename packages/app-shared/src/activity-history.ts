import type { InferRow } from "@evolu/common"
import type { latestBillsQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillCoverage } from "@payky/core/modules/bill/bill-types"
import {
  type BillHistoryItemSummary,
  calculateClaimedSum,
  deriveBillCoverage,
  deriveBillHistoryItemSummary,
} from "@payky/core/modules/bill/bill-utils"
import {
  calculateBillLineSummaries,
  deriveBillSummaryTotal,
} from "@payky/core/modules/bill-line/bill-line-utils"
import type { latestPaymentsQuery } from "@payky/core/modules/payment/payment-queries"
import {
  derivePaymentHasCancellationCollision,
  derivePaymentStatus,
} from "@payky/core/modules/payment/payment-status-utils"
import type { PaymentStatus } from "@payky/core/modules/payment/payment-types"
import {
  deriveRefundState,
  type PaymentRefundSummary,
} from "@payky/core/modules/refund/refund-utils"
import { sumDistinctClaimedAmounts } from "@payky/core/modules/shared/claimed-amount"
import type { Money } from "@payky/core/modules/shared/money"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { keptGoodsTotal } from "./activity-detail.ts"
import { refundStateLabelKey } from "./activity-labels.ts"
import { formatRelativeDate } from "./format-date.ts"
import type { createTranslate } from "./i18n/translate.ts"
import type { OverpaymentEntry } from "./overpayment-input.ts"

/**
 * What the Activity lists derive per row, for both apps. The query rows carry
 * the facts; status, collisions and coverage are always derived here, never
 * stored (docs/bill-payment-states.md).
 */

type Translate = ReturnType<typeof createTranslate>

/** A day's total, one sum per currency — the fiat currency is a setting, so one day can mix them. */
const formatCurrencyTotals = (
  amounts: ReadonlyArray<Money>,
  format: (money: Money) => string
): string | null => {
  const totals = new Map<Money["currency"], number>()
  for (const { value, currency } of amounts) {
    totals.set(currency, (totals.get(currency) ?? 0) + value)
  }
  if (totals.size === 0) return null

  return Array.from(totals, ([currency, value]) =>
    format({ value: NonNegativeInteger(value), currency })
  ).join(" + ")
}

/**
 * "Today · $12.00". `isComplete` is false for the last group while more
 * pages are still to load — that day may continue on the next page, so its
 * total would undercount and is left off until it's whole. The totals go
 * through the app's own `formatMoney`, as Finito writes a whole amount
 * without its minor units and Payky with them.
 */
export const formatActivityDayTitle = ({
  date,
  now,
  locale,
  amounts,
  isComplete,
  format,
}: {
  readonly date: Date
  readonly now: Date
  readonly locale: string
  readonly amounts: ReadonlyArray<Money>
  readonly isComplete: boolean
  readonly format: (money: Money) => string
}): string => {
  const dayLabel = formatRelativeDate(date, now, locale)
  const totals = isComplete ? formatCurrencyTotals(amounts, format) : null
  return totals === null ? dayLabel : `${dayLabel} · ${totals}`
}

export type PaymentHistoryRow = InferRow<ReturnType<typeof latestPaymentsQuery>>

export interface PaymentHistoryIssueFlags {
  readonly hasCancellationCollision: boolean
  readonly hasExcessSettlement: boolean
  readonly billUnderpaid: boolean
  readonly billOverpaid: boolean
}

export interface PaymentHistoryRowState {
  readonly status: PaymentStatus
  readonly hasCancellationCollision: boolean
  readonly issueFlags: PaymentHistoryIssueFlags
  /**
   * Struck through: money that never arrived. A canceled payment whose money
   * arrived anyway is not void — striking its amount through would hide
   * exactly that.
   */
  readonly isVoid: boolean
}

/**
 * Every issue a payment's row should flag — the canceled+claimed collision,
 * money above the payment or its bill, and its bill being underpaid (see
 * docs/bill-payment-states.md's "Bill payment coverage" section).
 * `billUnderpaid` is only flagged once a partial payment has actually landed
 * on the bill (`billClaimedSum > 0`) — an ordinary open bill with nothing
 * paid yet is also "underpaid" by definition, so flagging it would put the
 * warning on every pending bill payment row.
 */
const isBillCanceled = (item: PaymentHistoryRow): boolean =>
  item.billCanceledAt !== null && item.billConfirmedClosedAt === null

const resolvePaymentHistoryIssueFlags = (
  item: PaymentHistoryRow,
  hasCancellationCollision: boolean,
  hasUnresolvedOverpayment: boolean
): PaymentHistoryIssueFlags => {
  const billSummaries = calculateBillLineSummaries(
    item.billLines,
    item.billItems
  )
  const billTotal = deriveBillSummaryTotal(billSummaries)
  const billClaimedSum = calculateClaimedSum(item.billClaimedTransactions)
  const coverage = deriveBillCoverage(
    keptGoodsTotal({ billTotal, isCanceled: isBillCanceled(item) }),
    billClaimedSum
  )

  return {
    hasCancellationCollision,
    hasExcessSettlement: item.billId === null && hasUnresolvedOverpayment,
    billUnderpaid:
      item.billId !== null && coverage === "underpaid" && billClaimedSum > 0,
    billOverpaid: item.billId !== null && hasUnresolvedOverpayment,
  }
}

/**
 * Status, collision, issue flags and voidness of one payment-history row.
 * "Claimed" means claims whose `accountTransaction` is still there, which is
 * what `ownClaimedTransactions` holds — a claim pointing at a deleted
 * transaction is not money that arrived.
 */
export const derivePaymentHistoryRowState = (
  item: PaymentHistoryRow,
  now: Date,
  hasUnresolvedOverpayment: boolean
): PaymentHistoryRowState => {
  const hasActiveClaim = item.ownClaimedTransactions.length > 0
  const status = derivePaymentStatus({
    canceledAt: item.canceledAt,
    confirmedPaidAt: item.confirmedPaidAt,
    expiresAt: item.expiresAt,
    hasActiveClaim,
    now,
  })
  const hasCancellationCollision = derivePaymentHasCancellationCollision({
    canceledAt: item.canceledAt,
    confirmedPaidAt: item.confirmedPaidAt,
    hasActiveClaim,
  })

  return {
    status,
    hasCancellationCollision,
    issueFlags: resolvePaymentHistoryIssueFlags(
      item,
      hasCancellationCollision,
      hasUnresolvedOverpayment
    ),
    isVoid:
      (status === "canceled" || status === "expired") &&
      !hasCancellationCollision,
  }
}

export const deriveOverpaymentEntry = (
  item: PaymentHistoryRow
): OverpaymentEntry | null => {
  if (item.billId === null) {
    return sumDistinctClaimedAmounts(item.ownClaimedTransactions) > item.amount
      ? { paymentId: item.id }
      : null
  }
  const billTotal = deriveBillSummaryTotal(
    calculateBillLineSummaries(item.billLines, item.billItems)
  )
  const isCanceled = isBillCanceled(item)
  return deriveBillCoverage(
    keptGoodsTotal({ billTotal, isCanceled }),
    calculateClaimedSum(item.billClaimedTransactions)
  ) === "overpaid"
    ? { billId: item.billId, billTotal, isCanceled }
    : null
}

export const hasAnyIssue = (flags: PaymentHistoryIssueFlags): boolean =>
  Object.values(flags).some(Boolean)

/**
 * One specific label per distinct error. The two collisions reuse the titles
 * the payment detail shows for the identical collision.
 */
export const paymentHistoryIssueLabels = (
  flags: PaymentHistoryIssueFlags,
  t: Translate
): ReadonlyArray<string> =>
  [
    flags.hasCancellationCollision ? t("paymentDetail.collision.title") : null,
    flags.hasExcessSettlement ? t("paymentDetail.excessCollision.title") : null,
    flags.billUnderpaid ? t("paymentHistory.billUnderpaid") : null,
    flags.billOverpaid ? t("paymentHistory.billOverpaid") : null,
  ].filter((issue): issue is string => issue !== null)

/**
 * The row's title: the bill it paid (its label, else its number), else the
 * payment's own sequential number, so rows can be told apart without
 * opening each one.
 */
export const resolvePaymentTitle = (
  item: Pick<
    PaymentHistoryRow,
    "billLabel" | "billDisplayNumber" | "paymentSerialNumber"
  >,
  t: Translate
): string => {
  if (item.billLabel !== null) return item.billLabel
  if (item.billDisplayNumber !== null)
    return t("bill.list.label", { number: item.billDisplayNumber })
  if (item.paymentSerialNumber !== null)
    return t("paymentHistory.paymentNumber", {
      number: item.paymentSerialNumber,
    })
  return t("paymentHistory.payment")
}

/**
 * "Partially refunded 3.00": the refund marks of a payment, none when nothing
 * was refunded: the overpayment it returned (refund/0015) and everything else
 * given back, the tip included (refund/0009). The amounts go through the
 * app's own `formatMoney`, as Finito writes a whole amount without its minor
 * units and Payky with them.
 */
export const refundBadgeLabels = (
  summary: PaymentRefundSummary | undefined,
  t: Translate,
  format: (money: Money) => string
): ReadonlyArray<string> => {
  if (summary === undefined) return []

  const state = deriveRefundState(summary)
  if (state === "none") return []

  const formatAmount = (value: NonNegativeInteger) =>
    format({ value, currency: summary.currency })
  const givenBackAmount = NonNegativeInteger(
    Math.max(0, summary.returnedAmount - summary.returnedOverpaymentAmount)
  )
  return [
    ...(summary.returnedOverpaymentAmount > 0
      ? [
          t("refund.state.overpayment", {
            amount: formatAmount(summary.returnedOverpaymentAmount),
          }),
        ]
      : []),
    ...(givenBackAmount > 0
      ? [
          t(refundStateLabelKey[state], {
            amount: formatAmount(givenBackAmount),
          }),
        ]
      : []),
  ]
}

export type BillHistoryRow = InferRow<ReturnType<typeof latestBillsQuery>>

export const summarizeBillHistoryRow = (
  bill: BillHistoryRow
): BillHistoryItemSummary =>
  deriveBillHistoryItemSummary({
    canceledAt: bill.canceledAt,
    confirmedClosedAt: bill.confirmedClosedAt,
    billTotal: deriveBillSummaryTotal(
      calculateBillLineSummaries(bill.lines, bill.items)
    ),
    claimedTransactions: bill.claimedTransactions,
  })

/**
 * Everything this bill row should flag — the canceled+funded collision (see
 * docs/bill-payment-states.md), and coverage being off. Underpaid is only
 * flagged once a partial payment has actually landed (`claimedSum > 0`) —
 * an ordinary open cart with nothing paid yet is also "underpaid" by
 * definition, and flagging every one of those would drown out the genuine
 * signal (see the "reading the combination" table in
 * docs/bill-payment-states.md). Overpaid is flagged while money above the
 * bill is unresolved.
 */
export const deriveKeptGoodsCoverage = (
  summary: BillHistoryItemSummary
): BillCoverage =>
  deriveBillCoverage(
    keptGoodsTotal({
      billTotal: summary.billTotal,
      isCanceled: summary.status === "canceled",
    }),
    summary.claimedSum
  )

export const billHistoryIssueLabels = (
  summary: BillHistoryItemSummary,
  t: Translate,
  hasUnresolvedOverpayment: boolean
): ReadonlyArray<string> =>
  [
    summary.hasCancellationCollision ? t("bill.collision.title") : null,
    hasUnresolvedOverpayment ? t("billHistory.overpaid") : null,
    deriveKeptGoodsCoverage(summary) === "underpaid" && summary.claimedSum > 0
      ? t("billHistory.underpaid")
      : null,
  ].filter((issue): issue is string => issue !== null)

/**
 * Tips of the bill's settled payments, each counted once however many
 * transactions settled it. Shown on top of the bill total, which excludes
 * them.
 */
export const sumSettledTips = (
  bill: Pick<BillHistoryRow, "claimedTransactions">
): number =>
  Array.from(
    new Map(
      bill.claimedTransactions.map((transaction) => [
        transaction.paymentId,
        transaction.tipAmount,
      ])
    ).values()
  ).reduce((sum, tip) => sum + tip, 0)
