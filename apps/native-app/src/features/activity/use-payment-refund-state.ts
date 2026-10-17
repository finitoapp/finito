import {
  deriveQerkoPaymentRefund,
  deriveRefundAvailability,
  deriveRefundOptions,
  deriveRefundOverpayment,
} from "@payky/app-shared/refund-form"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { eetReversalsByPaymentIdQuery } from "@payky/core/modules/eet/eet-queries"
import {
  paymentCardSwitchioRefundSourceQuery,
  paymentQerkoTerminalByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  cardSwitchioRefundAttemptsByPaymentIdQuery,
  otherClaimedPaymentOfBillQuery,
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "@payky/core/modules/refund/refund-queries"
import type {
  FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useIsSwitchioInstalled } from "../../hooks/use-is-switchio-installed.ts"
import { useOverpaymentInput } from "../shared/use-overpayment-input.ts"

/**
 * Every query the payment's refund panel and the refund screen read, for
 * their screens' `usePreloadEvoluQueries`, which know the payment first.
 */
export const paymentRefundsQueries = (paymentId: PaymentId) => [
  refundsByPaymentIdQuery(paymentId),
  refundLinesByPaymentIdQuery(paymentId),
  refundablePaymentLinesQuery(paymentId),
  otherClaimedPaymentOfBillQuery(paymentId),
  eetReversalsByPaymentIdQuery(paymentId),
  paymentQerkoTerminalByIdQuery(paymentId),
  qerkoTerminalRefundAttemptsByPaymentIdQuery(paymentId),
  qerkoPaymentAttemptsByPaymentIdQuery(paymentId),
  paymentCardSwitchioRefundSourceQuery(paymentId),
  cardSwitchioRefundAttemptsByPaymentIdQuery(paymentId),
]

export interface RefundablePayment {
  readonly id: PaymentId
  readonly billId: BillId | null
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly cashReceivedAmount: NonNegativeInteger | null
}

/**
 * What a payment allows refunding, read once for the payment detail's refund
 * panel and the refund screen: the refunds and attempts so far, what is left
 * (`deriveRefundAvailability`, refund/0002, 0004, 0005), and the choices and
 * methods the refund screen offers (`deriveRefundOptions`).
 */
export function usePaymentRefundState({
  payment,
  excess,
  isPaid,
  paymentMethodKinds,
}: {
  readonly payment: RefundablePayment
  readonly excess: NonNegativeInteger
  readonly isPaid: boolean
  /** The kinds of the transactions that settled the payment. */
  readonly paymentMethodKinds: ReadonlyArray<string>
}) {
  const switchioInstalled = useIsSwitchioInstalled()
  const refunds = useEvoluQuery(refundsByPaymentIdQuery(payment.id)).data
  const refundLines = useEvoluQuery(
    refundLinesByPaymentIdQuery(payment.id)
  ).data
  const paymentLines = useEvoluQuery(
    refundablePaymentLinesQuery(payment.id)
  ).data
  const otherClaimedPayments = useEvoluQuery(
    otherClaimedPaymentOfBillQuery(payment.id)
  ).data
  const qerkoPayment = useEvoluQuery(paymentQerkoTerminalByIdQuery(payment.id))
    .data[0]
  const qerkoAttempts = useEvoluQuery(
    qerkoTerminalRefundAttemptsByPaymentIdQuery(payment.id)
  ).data
  const qerkoPaymentAttempts = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(payment.id)
  ).data
  const overpaymentInput = useOverpaymentInput(
    payment.billId === null
      ? { paymentId: payment.id }
      : { billId: payment.billId }
  )
  const { returnableOverpayment, overpaidBy } = deriveRefundOverpayment(
    overpaymentInput,
    payment.id
  )
  const switchioSource = useEvoluQuery(
    paymentCardSwitchioRefundSourceQuery(payment.id)
  ).data[0]
  const switchioAttempts = useEvoluQuery(
    cardSwitchioRefundAttemptsByPaymentIdQuery(payment.id)
  ).data

  // A refund to the card needs the id Qerko's receipt handed out and the
  // terminal the payment was taken on, whichever terminal this device uses
  // now (qerko/0006).
  const qerkoTerminalRefundable =
    qerkoPayment !== undefined &&
    qerkoPayment.qerkoRefundId !== null &&
    qerkoPayment.terminalId !== null
  // A refund to the card needs the id the terminal gave the payment
  // (payment/0009) and a SwitchioPay on this phone to send it from.
  const switchioRefundable =
    switchioSource !== undefined &&
    switchioSource.refundId !== null &&
    switchioInstalled
  const availability = deriveRefundAvailability({
    payment,
    excess,
    isPaid,
    refunds,
    refundLines,
    paymentLines,
    hasOtherClaimedPayment: otherClaimedPayments.length > 0,
  })
  // Qerko refunds a Qerko payment whole or not at all (qerko/0010).
  const qerkoPaymentRefundAmount = deriveQerkoPaymentRefund({
    hasPaidQerkoAttempt: qerkoPaymentAttempts.some(
      (attempt) => attempt.outcome === "paid"
    ),
    isPaid,
    refunds,
    refundableAmount: availability.refundableAmount,
    refundableTipAmount: availability.refundableTipAmount,
  })
  const options = deriveRefundOptions({
    paymentMethodKinds,
    availability,
    qerkoPaymentRefundable: qerkoPaymentRefundAmount !== null,
    qerkoTerminalRefundable,
    switchioRefundable,
    returnableOverpayment,
  })
  // A refund to the card the terminal has not settled: another one could
  // refund the card twice, so the actions refuse it (qerko/0004, refund/0007).
  const cardAttemptRunning =
    qerkoAttempts.some(({ status }) => status !== "failed") ||
    switchioAttempts.some(({ status }) => status !== "failed")

  return {
    refunds,
    refundLines,
    availability,
    qerkoTerminalTid: qerkoPayment?.terminalTid ?? null,
    qerkoAttempts,
    switchioSource,
    switchioAttempts,
    options,
    cardAttemptRunning,
    overpaymentInput,
    returnableOverpayment,
    overpaidBy,
  }
}
