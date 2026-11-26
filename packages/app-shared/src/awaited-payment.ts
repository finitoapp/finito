import type { AwaitedPayment } from "@payky/core/background-jobs/awaited-payments"
import type { AccountId } from "@payky/core/modules/account/account-types"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type {
  NonEmptyString,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"

/** The columns of `paymentRequestQuery` a registration is built from. */
export interface AwaitedPaymentSource {
  readonly id: PaymentId
  readonly sparkAccountId: AccountId | null
  readonly amountSats: NonNegativeInteger | null
  readonly lnInvoice: NonEmptyString | null
  readonly sparkInvoice: NonEmptyString | null
}

/**
 * What the payment wait screen registers with the Spark sync job: a pending
 * payment with a Spark account, an amount in sats and a Lightning or Spark
 * invoice. Anything else is not awaited.
 */
export const awaitedPaymentFor = (
  payment: AwaitedPaymentSource,
  pending: boolean
): AwaitedPayment | null =>
  !pending ||
  payment.sparkAccountId === null ||
  payment.amountSats === null ||
  (payment.lnInvoice === null && payment.sparkInvoice === null)
    ? null
    : {
        paymentId: payment.id,
        accountId: payment.sparkAccountId,
        amountSats: payment.amountSats,
        lnInvoice: payment.lnInvoice,
        sparkInvoice: payment.sparkInvoice,
      }
