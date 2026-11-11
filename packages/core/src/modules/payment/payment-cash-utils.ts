import { currencyFractionDigits } from "../shared/money.ts"
import { type FiatCurrency, NonNegativeInteger } from "../shared/schema.ts"
import { calculatePaymentBaseAmount } from "./payment-tip-utils.ts"

export const roundCashAmount = ({
  amount,
  currency,
}: {
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
}): NonNegativeInteger => {
  if (currency !== "CZK") return amount

  const crown = 10 ** currencyFractionDigits.CZK
  return NonNegativeInteger(Math.floor((amount + crown / 2) / crown) * crown)
}

/**
 * Whether cash can take a payment: what its goods — its amount without the
 * tip — come to, rounded to what cash can hand over, is more than zero
 * (payment/0012). A CZK payment of 0.01–0.49 rounds to no crowns at all
 * (payment/0002), and a tip does not lift goods that come to nothing.
 *
 * The one cash rule behind `isBillPayable` (whether a payment may be created
 * with cash as one of its methods), `markPaymentPaidCash` (which refuses to
 * settle such a payment in cash, `CashAmountRoundsToZero`) and both apps'
 * payment screens (which offer no cash for it), so none of them can
 * disagree. It judges the payment as created, never the bill as it stands
 * later: a bill another device lowers afterwards leaves its payment payable
 * in cash, and the bill ends up closed and overpaid.
 */
export const isCashPayable = ({
  amount,
  tipAmount,
  currency,
}: {
  /** The payment's whole amount, tip included (`payment.amount`). */
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly currency: FiatCurrency
}): boolean =>
  roundCashAmount({
    amount: calculatePaymentBaseAmount({ amount, tipAmount }),
    currency,
  }) > 0

export const deriveReceivedTipAmount = ({
  amount,
  tipAmount,
  cashReceivedAmount,
  currency,
}: {
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly cashReceivedAmount: NonNegativeInteger | null
  readonly currency: FiatCurrency
}): NonNegativeInteger => {
  if (cashReceivedAmount === null || tipAmount === 0) return tipAmount

  const goodsAmount = roundCashAmount({
    amount: NonNegativeInteger(Math.max(0, amount - tipAmount)),
    currency,
  })
  return NonNegativeInteger(Math.max(0, cashReceivedAmount - goodsAmount))
}
