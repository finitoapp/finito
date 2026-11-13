import { describe, expect, test } from "vitest"

import { NonNegativeInteger } from "../shared/schema.ts"
import {
  calculatePaymentAmounts,
  calculatePaymentBaseAmount,
  calculatePercentageTipAmount,
  calculateTipPercentage,
} from "./payment-tip-utils.ts"

describe("calculatePercentageTipAmount", () => {
  test("rounds percentage tips to the nearest minor unit", () => {
    expect(
      calculatePercentageTipAmount({
        amount: NonNegativeInteger(500),
        percentage: 5,
      })
    ).toBe(25)
    expect(
      calculatePercentageTipAmount({
        amount: NonNegativeInteger(10),
        percentage: 5,
      })
    ).toBe(1)
  })
})

describe("calculatePaymentAmounts", () => {
  test("keeps the tip separately while adding it to the payment total", () => {
    expect(
      calculatePaymentAmounts({
        amount: NonNegativeInteger(500),
        tipAmount: NonNegativeInteger(25),
      })
    ).toEqual({
      amount: 525,
      tipAmount: 25,
    })
  })

  test("supports an explicit no-tip selection", () => {
    expect(
      calculatePaymentAmounts({
        amount: NonNegativeInteger(500),
        tipAmount: NonNegativeInteger(0),
      })
    ).toEqual({
      amount: 500,
      tipAmount: 0,
    })
  })
})

describe("calculatePaymentBaseAmount", () => {
  test("takes the tip back out of a payment total", () => {
    expect(
      calculatePaymentBaseAmount({
        amount: NonNegativeInteger(525),
        tipAmount: NonNegativeInteger(25),
      })
    ).toBe(500)
  })

  test("round-trips a tipped total back to the amount it was built from", () => {
    const amount = NonNegativeInteger(12_900)
    const tipAmount = NonNegativeInteger(1_000)

    expect(
      calculatePaymentBaseAmount(calculatePaymentAmounts({ amount, tipAmount }))
    ).toBe(amount)
  })

  test("never goes negative, however inconsistent the stored pair is", () => {
    expect(
      calculatePaymentBaseAmount({
        amount: NonNegativeInteger(100),
        tipAmount: NonNegativeInteger(500),
      })
    ).toBe(0)
  })
})

describe("calculateTipPercentage", () => {
  test("is the tip's share of the order, unrounded", () => {
    expect(
      calculateTipPercentage({
        amount: NonNegativeInteger(20000),
        tipAmount: NonNegativeInteger(2000),
      })
    ).toBe(10)
    expect(
      calculateTipPercentage({
        amount: NonNegativeInteger(24500),
        tipAmount: NonNegativeInteger(2000),
      })
    ).toBeCloseTo(8.163, 3)
  })

  test("has nothing to show for an order of zero", () => {
    expect(
      calculateTipPercentage({
        amount: NonNegativeInteger(0),
        tipAmount: NonNegativeInteger(2000),
      })
    ).toBeNull()
  })
})
