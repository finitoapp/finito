import { describe, expect, test } from "vitest"

import { NonNegativeInteger } from "../shared/schema.ts"
import {
  deriveReceivedTipAmount,
  isCashPayable,
  roundCashAmount,
} from "./payment-cash-utils.ts"

describe("roundCashAmount", () => {
  test.each([
    [7_890, 7_900],
    [7_840, 7_800],
    [7_850, 7_900],
    [7_900, 7_900],
    [49, 0],
    [50, 100],
  ])("rounds %i CZK minor units to %i", (amount, rounded) => {
    expect(
      roundCashAmount({ amount: NonNegativeInteger(amount), currency: "CZK" })
    ).toBe(rounded)
  })

  test("keeps any other currency exact", () => {
    expect(
      roundCashAmount({ amount: NonNegativeInteger(1_234), currency: "EUR" })
    ).toBe(1_234)
  })
})

describe("deriveReceivedTipAmount", () => {
  test.each([
    { amount: 5_828, tip: 278, received: 5_800, tipReceived: 200 },
    { amount: 6_038, tip: 288, received: 6_000, tipReceived: 200 },
    { amount: 11_000, tip: 1_000, received: 11_100, tipReceived: 1_100 },
    { amount: 7_890, tip: 0, received: 8_000, tipReceived: 0 },
    { amount: 5_828, tip: 278, received: null, tipReceived: 278 },
  ])(
    "takes $tipReceived as the tip of $amount with $tip tip and $received received",
    ({ amount, tip, received, tipReceived }) => {
      expect(
        deriveReceivedTipAmount({
          amount: NonNegativeInteger(amount),
          tipAmount: NonNegativeInteger(tip),
          cashReceivedAmount:
            received === null ? null : NonNegativeInteger(received),
          currency: "CZK",
        })
      ).toBe(tipReceived)
    }
  )
})

describe("isCashPayable", () => {
  const cashPayable = (
    amount: number,
    tipAmount = 0,
    currency: "CZK" | "EUR" = "CZK"
  ) =>
    isCashPayable({
      amount: NonNegativeInteger(amount),
      tipAmount: NonNegativeInteger(tipAmount),
      currency,
    })

  test("refuses cash for a CZK payment of 0.40, which cash rounds to nothing", () => {
    expect(cashPayable(40)).toBe(false)
    expect(cashPayable(50)).toBe(true)
    // Only CZK cash rounds.
    expect(cashPayable(40, 0, "EUR")).toBe(true)
  })

  test("does not let a tip make cash take a payment whose goods come to nothing", () => {
    expect(cashPayable(540, 500)).toBe(false)
    expect(cashPayable(600, 500)).toBe(true)
  })
})
