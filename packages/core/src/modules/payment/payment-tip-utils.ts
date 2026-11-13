import {
  NonNegativeInteger,
  type NonNegativeInteger as NonNegativeIntegerValue,
} from "../shared/schema.ts"

export const calculatePercentageTipAmount = ({
  amount,
  percentage,
}: {
  readonly amount: NonNegativeIntegerValue
  readonly percentage: number
}): NonNegativeIntegerValue =>
  NonNegativeInteger(Math.round((amount * percentage) / 100))

/**
 * What share of the order a tip is, in percent, unrounded: the tip step
 * shows it under a fixed tip. An order of zero has no share to show.
 */
export const calculateTipPercentage = ({
  amount,
  tipAmount,
}: {
  readonly amount: NonNegativeIntegerValue
  readonly tipAmount: NonNegativeIntegerValue
}): number | null => (amount === 0 ? null : (tipAmount / amount) * 100)

export const calculatePaymentAmounts = ({
  amount,
  tipAmount,
}: {
  readonly amount: NonNegativeIntegerValue
  readonly tipAmount: NonNegativeIntegerValue
}): {
  readonly amount: NonNegativeIntegerValue
  readonly tipAmount: NonNegativeIntegerValue
} => ({
  amount: NonNegativeInteger(amount + tipAmount),
  tipAmount,
})

/**
 * The part of a payment's total that is not the tip.
 *
 * `payment.amount` is the whole sum the customer pays, tip included (see
 * {@link calculatePaymentAmounts}). A payment terminal that takes the tip as
 * its own field adds it to the amount it is given — Switchio Pay's ECR
 * request pairs a base `amount` with an optional `tipAmount` and reports
 * `amount + tipAmount` back in its result — so handing it the stored total
 * would charge the tip twice.
 */
export const calculatePaymentBaseAmount = ({
  amount,
  tipAmount,
}: {
  readonly amount: NonNegativeIntegerValue
  readonly tipAmount: NonNegativeIntegerValue
}): NonNegativeIntegerValue =>
  NonNegativeInteger(Math.max(0, amount - tipAmount))
