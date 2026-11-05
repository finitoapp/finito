import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import type { BillStatus } from "@payky/core/modules/bill/bill-types"
import type { PaymentStatus } from "@payky/core/modules/payment/payment-types"
import type { RefundState } from "@payky/core/modules/refund/refund-types"
import type { TranslationKey } from "./i18n/resources.ts"

/** Label keys of the derived states the Activity screens show, for both apps. */

export const paymentStatusLabelKey = {
  canceled: "payment.status.canceled",
  paid: "payment.status.paid",
  expired: "payment.status.expired",
  pending: "payment.status.pending",
} satisfies Record<PaymentStatus, TranslationKey>

export const billStatusLabelKey = {
  open: "bill.status.open",
  closed: "bill.status.closed",
  canceled: "bill.status.canceled",
} satisfies Record<BillStatus, TranslationKey>

/**
 * The method that actually settled a payment (its claimed transaction's
 * `kind`): the payment detail's "Paid by" label and the list's per-row mark.
 */
export const paymentMethodLabelKey = {
  cashRegister: "paymentDetail.paymentMethod.cash",
  iban: "paymentDetail.paymentMethod.iban",
  onchain: "paymentDetail.paymentMethod.onchain",
  cardSwitchio: "paymentDetail.paymentMethod.card",
  qerkoTerminal: "paymentDetail.paymentMethod.qerkoTerminal",
  qerkoPayment: "paymentDetail.paymentMethod.qerkoPayment",
  spark: "paymentDetail.paymentMethod.spark",
  cashu: "paymentDetail.paymentMethod.cashu",
  lightningAddress: "paymentDetail.paymentMethod.lightningAddress",
} satisfies Record<AccountTransactionKind, TranslationKey>

export const refundStateLabelKey = {
  partial: "refund.state.partial",
  full: "refund.state.full",
} satisfies Record<Exclude<RefundState, "none">, TranslationKey>
