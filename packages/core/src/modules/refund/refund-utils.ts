import { sqliteTrue } from "@evolu/common"

import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { ItemLineType } from "../item/item-types.ts"
import {
  deriveReceivedTipAmount,
  roundCashAmount,
} from "../payment/payment-cash-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { PaymentLineId } from "../payment-line/payment-line-types.ts"
import { calculatePaymentExcess } from "../shared/claimed-amount.ts"
import { currencyFractionDigits } from "../shared/money.ts"
import {
  type Currency,
  type FiatCurrency,
  NonNegativeInteger,
  type PositiveNumber,
} from "../shared/schema.ts"
import type { RefundMethod, RefundState } from "./refund-types.ts"

export const deriveRefundableAmount = ({
  amount,
  cashReceivedAmount,
  excess,
  tipAmount,
  currency,
}: {
  readonly amount: NonNegativeInteger
  readonly cashReceivedAmount: NonNegativeInteger | null
  readonly excess: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly currency: FiatCurrency
}): NonNegativeInteger =>
  NonNegativeInteger(
    Math.max(
      0,
      (cashReceivedAmount ?? amount) +
        excess -
        deriveReceivedTipAmount({
          amount,
          tipAmount,
          cashReceivedAmount,
          currency,
        })
    )
  )

export const isTipRefund = ({
  isTip,
}: {
  readonly isTip: typeof sqliteTrue | null
}): boolean => isTip === sqliteTrue

export const sumGoodsRefundAmounts = (
  refunds: ReadonlyArray<{
    readonly amount: NonNegativeInteger
    readonly isTip: typeof sqliteTrue | null
  }>
): NonNegativeInteger =>
  sumRefundAmounts(refunds.filter((refund) => !isTipRefund(refund)))

export const deriveRefundableTipAmount = ({
  amount,
  tipAmount,
  cashReceivedAmount,
  currency,
  refunds,
}: {
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly cashReceivedAmount: NonNegativeInteger | null
  readonly currency: FiatCurrency
  readonly refunds: ReadonlyArray<{ readonly isTip: typeof sqliteTrue | null }>
}): NonNegativeInteger =>
  refunds.some(isTipRefund)
    ? NonNegativeInteger(0)
    : deriveReceivedTipAmount({
        amount,
        tipAmount,
        cashReceivedAmount,
        currency,
      })

export const deriveRefundPrefillAmount = ({
  remainingAmount,
  excess,
  method,
  currency,
}: {
  readonly remainingAmount: NonNegativeInteger
  readonly excess: NonNegativeInteger
  readonly method: RefundMethod
  readonly currency: FiatCurrency
}): NonNegativeInteger => {
  const amount =
    excess > 0
      ? NonNegativeInteger(Math.min(excess, remainingAmount))
      : remainingAmount
  if (method !== "cashRegister") return amount

  const rounded = roundCashAmount({ amount, currency })
  return rounded > remainingAmount
    ? NonNegativeInteger(rounded - 10 ** currencyFractionDigits[currency])
    : rounded
}

/**
 * The cash a refund from the cash register hands out (refund/0012): what it
 * gives back rounded as a cash total is (`roundCashAmount`, whole crowns for
 * CZK, other currencies exact), split over the goods' and the tip's records.
 * Given back together, the customer is handed the rounded sum once: the tip
 * keeps its exact amount and the goods take the rounding, as the goods are
 * what the EET storno reverses whoever the tip belongs to (eet/0011). Only
 * when the goods are too few to absorb a rounding down does the tip take
 * the rest. Either may exceed what it returns by less than half a crown,
 * which is the business's, as a payment's rounding is (payment/0002).
 */
export const deriveCashRefundHandedAmounts = ({
  goodsAmount,
  tipAmount,
  currency,
}: {
  readonly goodsAmount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly currency: FiatCurrency
}): {
  readonly goods: NonNegativeInteger
  readonly tip: NonNegativeInteger
} => {
  const handed = roundCashAmount({
    amount: NonNegativeInteger(goodsAmount + tipAmount),
    currency,
  })
  const goods = goodsAmount === 0 ? 0 : Math.max(0, handed - tipAmount)
  return {
    goods: NonNegativeInteger(goods),
    tip: NonNegativeInteger(handed - goods),
  }
}

export const sumRefundAmounts = (
  refunds: ReadonlyArray<{ readonly amount: NonNegativeInteger }>
): NonNegativeInteger =>
  NonNegativeInteger(refunds.reduce((sum, { amount }) => sum + amount, 0))

export const deriveRefundState = ({
  refundedAmount,
  refundableAmount,
}: {
  readonly refundedAmount: NonNegativeInteger
  readonly refundableAmount: NonNegativeInteger
}): RefundState => {
  if (refundedAmount === 0) return "none"
  return refundedAmount >= refundableAmount ? "full" : "partial"
}

export interface PaymentRefundSummary {
  /** The goods refunded: what the refunded state is measured by (refund/0011). */
  readonly refundedAmount: NonNegativeInteger
  readonly refundableAmount: NonNegativeInteger
  /** Every amount given back, the tip included: what the badge shows (refund/0009). */
  readonly returnedAmount: NonNegativeInteger
  readonly currency: FiatCurrency
}

export const summarizeRefundsByPayment = (
  refunds: ReadonlyArray<{
    readonly paymentId: PaymentId
    readonly amount: NonNegativeInteger
    readonly currency: FiatCurrency
    readonly isTip: typeof sqliteTrue | null
    readonly paymentAmount: NonNegativeInteger
    readonly paymentTipAmount: NonNegativeInteger
    readonly paymentCurrency: FiatCurrency
    readonly cashReceivedAmount: NonNegativeInteger | null
    readonly paymentClaims: ReadonlyArray<{
      readonly accountTransactionId: AccountTransactionId
      readonly amount: number
      readonly currency: Currency
      /** The settling method's quote, as `quotedAmountSats`. */
      readonly paymentAmountSats: NonNegativeInteger | null
    }>
  }>
): ReadonlyMap<PaymentId, PaymentRefundSummary> => {
  const summaries = new Map<PaymentId, PaymentRefundSummary>()
  for (const refund of refunds) {
    const excess = calculatePaymentExcess({
      claims: refund.paymentClaims.map((claim) => ({
        ...claim,
        paymentAmount: refund.paymentAmount,
        paymentCurrency: refund.paymentCurrency,
      })),
      amount: refund.paymentAmount,
    })
    const previous = summaries.get(refund.paymentId)
    summaries.set(refund.paymentId, {
      refundedAmount: NonNegativeInteger(
        (previous?.refundedAmount ?? 0) +
          (isTipRefund(refund) ? 0 : refund.amount)
      ),
      returnedAmount: NonNegativeInteger(
        (previous?.returnedAmount ?? 0) + refund.amount
      ),
      refundableAmount: deriveRefundableAmount({
        amount: refund.paymentAmount,
        cashReceivedAmount: refund.cashReceivedAmount,
        excess,
        tipAmount: refund.paymentTipAmount,
        currency: refund.paymentCurrency,
      }),
      currency: refund.currency,
    })
  }
  return summaries
}

const roundQuantity = (quantity: number) => Math.round(quantity * 1e6) / 1e6

export interface RefundableLine<TLine> {
  readonly line: TLine
  readonly remainingQuantity: number
  readonly remainingAmount: NonNegativeInteger
}

export const deriveRefundableLines = <
  TLine extends {
    readonly id: PaymentLineId
    readonly type: ItemLineType
    readonly quantity: PositiveNumber
    readonly totalAmount: NonNegativeInteger
  },
>(
  lines: ReadonlyArray<TLine>,
  refundLines: ReadonlyArray<{
    readonly paymentLineId: PaymentLineId
    readonly quantity: PositiveNumber
    readonly amount: NonNegativeInteger
  }>
): ReadonlyArray<RefundableLine<TLine>> =>
  lines.flatMap((line) => {
    if (line.type === "tip") return []

    const refunded = refundLines.filter(
      ({ paymentLineId }) => paymentLineId === line.id
    )
    const remainingQuantity = roundQuantity(
      line.quantity - refunded.reduce((sum, { quantity }) => sum + quantity, 0)
    )
    if (remainingQuantity <= 0) return []

    return [
      {
        line,
        remainingQuantity,
        remainingAmount: NonNegativeInteger(
          Math.max(0, line.totalAmount - sumRefundAmounts(refunded))
        ),
      },
    ]
  })

export const calculateRefundLineAmount = (
  {
    line,
    remainingQuantity,
    remainingAmount,
  }: RefundableLine<{
    readonly quantity: PositiveNumber
    readonly totalAmount: NonNegativeInteger
  }>,
  quantity: number
): NonNegativeInteger =>
  quantity >= remainingQuantity
    ? remainingAmount
    : NonNegativeInteger(
        Math.min(
          remainingAmount,
          Math.round((line.totalAmount * quantity) / line.quantity)
        )
      )
