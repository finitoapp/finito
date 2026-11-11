import type { InferRow } from "@evolu/common"
import type { latestBillsQuery } from "@payky/core/modules/bill/bill-queries"
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
  derivePaymentHasExcessSettlement,
  derivePaymentStatus,
} from "@payky/core/modules/payment/payment-status-utils"
import type { PaymentStatus } from "@payky/core/modules/payment/payment-types"
import {
  deriveRefundState,
  type PaymentRefundSummary,
} from "@payky/core/modules/refund/refund-utils"
import { sumDistinctClaimedAmounts } from "@payky/core/modules/shared/claimed-amount"
import type { Money } from "@payky/core/modules/shared/money"
import { Integer } from "@payky/core/modules/shared/schema"
import { refundStateLabelKey } from "./activity-labels.ts"
import { formatRelativeDate } from "./format-date.ts"
import type { createTranslate } from "./i18n/translate.ts"

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
    format({ value: Integer(value), currency })
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
 * this payment's own duplicate-settlement collision, and/or its bill's
 * coverage being off (see docs/bill-payment-states.md's "Bill payment
 * coverage" section). `billUnderpaid` is only flagged once a partial payment
 * has actually landed on the bill (`billClaimedSum > 0`) — an ordinary open
 * bill with nothing paid yet is also "underpaid" by definition, so flagging
 * it would put the warning on every pending bill payment row. `billOverpaid`
 * needs no such gate: an unpaid bill is never overpaid.
 *
 * `billOverpaid` is deliberately suppressed when it's fully explained by this
 * same payment's own excess settlement (this is the only claimed payment on
 * the bill) — "Paid more than once" already says that. It still shows when
 * *another* payment is also claimed against the bill, a genuinely different
 * cause.
 */
const resolvePaymentHistoryIssueFlags = (
  item: PaymentHistoryRow,
  hasCancellationCollision: boolean
): PaymentHistoryIssueFlags => {
  const billSummaries = calculateBillLineSummaries(
    item.billLines,
    item.billItems
  )
  const billTotal = deriveBillSummaryTotal(billSummaries)
  const billClaimedSum = calculateClaimedSum(item.billClaimedTransactions)
  const coverage = deriveBillCoverage(billTotal, billClaimedSum)

  const hasExcessSettlement = derivePaymentHasExcessSettlement({
    amount: item.amount,
    excessAcknowledgedAt: item.excessAcknowledgedAt,
    claimedSum: sumDistinctClaimedAmounts(item.ownClaimedTransactions),
  })
  const hasOtherClaimedPayment = item.billClaimedTransactions.some(
    (transaction) => transaction.paymentId !== item.id
  )

  return {
    hasCancellationCollision,
    hasExcessSettlement,
    billUnderpaid:
      item.billId !== null && coverage === "underpaid" && billClaimedSum > 0,
    billOverpaid:
      item.billId !== null &&
      coverage === "overpaid" &&
      (!hasExcessSettlement || hasOtherClaimedPayment),
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
  now: Date
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
    issueFlags: resolvePaymentHistoryIssueFlags(item, hasCancellationCollision),
    isVoid:
      (status === "canceled" || status === "expired") &&
      !hasCancellationCollision,
  }
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
 * "Partially refunded 3.00": the refund mark of a payment, `null` when nothing
 * was refunded. The amount goes through the app's own `formatMoney`, as Finito
 * writes a whole amount without its minor units and Payky with them.
 */
export const refundBadgeLabel = (
  summary: PaymentRefundSummary | undefined,
  t: Translate,
  format: (money: Money) => string
): string | null => {
  if (summary === undefined) return null

  const state = deriveRefundState(summary)
  if (state === "none") return null

  return t(refundStateLabelKey[state], {
    amount: format({
      value: summary.returnedAmount,
      currency: summary.currency,
    }),
  })
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
 * docs/bill-payment-states.md), and coverage being off. Overpaid is always
 * worth flagging; underpaid is only flagged once a partial payment has
 * actually landed (`claimedSum > 0`) — an ordinary open cart with nothing
 * paid yet is also "underpaid" by definition, and flagging every one of
 * those would drown out the genuine signal (see the "reading the
 * combination" table in docs/bill-payment-states.md) — or once staff closed
 * the bill without a payment: a zero bill that reads underpaid had a line
 * added on a device that had not yet seen it closed (payment/0013).
 */
export const billHistoryIssueLabels = (
  summary: BillHistoryItemSummary,
  t: Translate
): ReadonlyArray<string> =>
  [
    summary.hasCancellationCollision ? t("bill.collision.title") : null,
    summary.coverage === "overpaid" ? t("billHistory.overpaid") : null,
    summary.coverage === "underpaid" &&
    (summary.claimedSum > 0 || summary.closedWithoutPayment)
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
