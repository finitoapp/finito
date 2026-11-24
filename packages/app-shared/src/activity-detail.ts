import type { InferRow } from "@evolu/common"
import type { BillCoverage } from "@payky/core/modules/bill/bill-types"
import type { BillLineSummaryDiff } from "@payky/core/modules/bill-line/bill-line-utils"
import { deriveReceivedTipAmount } from "@payky/core/modules/payment/payment-cash-utils"
import type {
  paymentDetailQuery,
  paymentReconciliationsQuery,
} from "@payky/core/modules/payment/payment-queries"
import {
  derivePaymentHasCancellationCollision,
  derivePaymentHasExcessSettlement,
  derivePaymentStatus,
} from "@payky/core/modules/payment/payment-status-utils"
import type { PaymentStatus } from "@payky/core/modules/payment/payment-types"
import {
  calculatePaymentExcess,
  sumDistinctClaimedAmounts,
} from "@payky/core/modules/shared/claimed-amount"
import type { NonNegativeInteger } from "@payky/core/modules/shared/schema"

/**
 * What the payment and bill detail screens derive, for both apps. Like the
 * list rows (`activity-history.ts`), nothing here is stored: status,
 * collisions and coverage warnings are recomputed from the rows every time.
 */

export type PaymentDetailRow = InferRow<ReturnType<typeof paymentDetailQuery>>
export type PaymentReconciliationRow = InferRow<
  ReturnType<typeof paymentReconciliationsQuery>
>

export interface PaymentDetailState {
  readonly status: PaymentStatus
  /**
   * The collision docs/bill-payment-states.md calls out: a multi-device merge
   * can leave a payment canceled with an active claim (real money) at the same
   * time — the status still reads Canceled until staff resolves it via
   * `confirmPaymentPaidDespiteCancellation`.
   */
  readonly hasCancellationCollision: boolean
  /**
   * The duplicate-settlement collision: two offline devices can each claim
   * this payment through a different method — both real money, so the sum of
   * its distinct claimed transactions can exceed its own `amount`. See
   * `payment.ts`'s `excessAcknowledgedAt`.
   */
  readonly hasExcessSettlementCollision: boolean
  readonly excess: NonNegativeInteger
  readonly receivedTipAmount: NonNegativeInteger
  /**
   * Whether the screen offers deleting it (payment/0029): pending or
   * canceled, with no money. `deleteUnpaidPayment` still judges for itself.
   */
  readonly canDelete: boolean
  /** The methods that settled it, once each, in claim order. */
  readonly paymentMethodKinds: ReadonlyArray<
    PaymentReconciliationRow["transactionKind"]
  >
}

export const derivePaymentDetailState = ({
  payment,
  reconciliations,
  now,
}: {
  readonly payment: PaymentDetailRow
  readonly reconciliations: ReadonlyArray<PaymentReconciliationRow>
  readonly now: Date
}): PaymentDetailState => {
  const hasActiveClaim = reconciliations.length > 0
  const claims = reconciliations.flatMap((reconciliation) =>
    reconciliation.accountTransactionId === null
      ? []
      : [
          {
            accountTransactionId: reconciliation.accountTransactionId,
            amount: reconciliation.transactionAmount,
            currency: reconciliation.transactionCurrency,
            paymentAmount: payment.amount,
            paymentCurrency: payment.currency,
            paymentAmountSats: reconciliation.paymentAmountSats,
          },
        ]
  )

  const status = derivePaymentStatus({
    canceledAt: payment.canceledAt,
    confirmedPaidAt: payment.confirmedPaidAt,
    expiresAt: payment.expiresAt,
    hasActiveClaim,
    now,
  })

  return {
    status,
    canDelete:
      !hasActiveClaim && (status === "pending" || status === "canceled"),
    hasCancellationCollision: derivePaymentHasCancellationCollision({
      canceledAt: payment.canceledAt,
      confirmedPaidAt: payment.confirmedPaidAt,
      hasActiveClaim,
    }),
    hasExcessSettlementCollision: derivePaymentHasExcessSettlement({
      amount: payment.amount,
      excessAcknowledgedAt: payment.excessAcknowledgedAt,
      claimedSum: sumDistinctClaimedAmounts(claims),
    }),
    excess: calculatePaymentExcess({ claims, amount: payment.amount }),
    receivedTipAmount: deriveReceivedTipAmount(payment),
    paymentMethodKinds: [
      ...new Set(
        reconciliations.map((reconciliation) => reconciliation.transactionKind)
      ),
    ],
  }
}

/**
 * Which of the two known causes explains a bill's coverage mismatch (see the
 * "Bill payment coverage" section of docs/bill-payment-states.md) — a
 * bill-line change since the payment was made, or another payment also
 * claimed against the same bill. Either can be absent, in which case only the
 * plain coverage fact is shown.
 */
export type BillCoverageMismatchReason = "billLinesChanged" | "multiplePayments"

export interface PaymentBillCoverageNotice {
  readonly warning: "underpaid" | "overpaid" | null
  readonly reason: BillCoverageMismatchReason | null
  readonly hasLineDiff: boolean
}

export const hasLineDiff = (diff: BillLineSummaryDiff | null): boolean =>
  diff !== null &&
  (diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0)

/**
 * The coverage warning of the payment detail's bill card. An open bill with
 * nothing claimed against it yet is also "underpaid" by `deriveBillCoverage`'s
 * definition, so underpayment is only flagged once a partial payment has
 * actually landed — the same gate the list rows use. Overpaid needs no gate:
 * an unpaid bill is never overpaid.
 */
export const derivePaymentBillCoverageNotice = ({
  coverage,
  claimedSum,
  lineDiff,
  otherClaimedPaymentCount,
}: {
  readonly coverage: BillCoverage
  readonly claimedSum: NonNegativeInteger
  readonly lineDiff: BillLineSummaryDiff | null
  readonly otherClaimedPaymentCount: number
}): PaymentBillCoverageNotice => {
  const linesChanged = hasLineDiff(lineDiff)

  return {
    warning:
      coverage === "overpaid"
        ? "overpaid"
        : coverage === "underpaid" && claimedSum > 0
          ? "underpaid"
          : null,
    reason: linesChanged
      ? "billLinesChanged"
      : otherClaimedPaymentCount > 0
        ? "multiplePayments"
        : null,
    hasLineDiff: linesChanged,
  }
}
