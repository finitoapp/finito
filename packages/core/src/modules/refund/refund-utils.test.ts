import { sqliteTrue } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { PaymentLineId } from "../payment-line/payment-line-types.ts"
import {
  Integer,
  NonNegativeInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import {
  calculateRefundLineAmount,
  deriveCashRefundHandedAmounts,
  deriveRefundableAmount,
  deriveRefundableLines,
  deriveRefundableTipAmount,
  deriveRefundPrefillAmount,
  deriveRefundState,
  summarizeRefundsByPayment,
} from "./refund-utils.ts"

const lineId = "line" as PaymentLineId

const threeCoffees = {
  id: lineId,
  type: "catalogItem",
  quantity: PositiveNumber(3),
  totalAmount: NonNegativeInteger(10_000),
  discountShare: null,
} as const

describe("deriveRefundableAmount", () => {
  test("is the cash received when there is one", () => {
    expect(
      deriveRefundableAmount({
        amount: NonNegativeInteger(7_890),
        cashReceivedAmount: NonNegativeInteger(7_900),
        excess: NonNegativeInteger(0),
        tipAmount: NonNegativeInteger(0),
        currency: "CZK",
      })
    ).toBe(7_900)
    expect(
      deriveRefundableAmount({
        amount: NonNegativeInteger(7_890),
        cashReceivedAmount: null,
        excess: NonNegativeInteger(0),
        tipAmount: NonNegativeInteger(0),
        currency: "CZK",
      })
    ).toBe(7_890)
  })

  test("adds what the payment received beyond its amount", () => {
    expect(
      deriveRefundableAmount({
        amount: NonNegativeInteger(25_000),
        cashReceivedAmount: NonNegativeInteger(25_000),
        excess: NonNegativeInteger(25_000),
        tipAmount: NonNegativeInteger(0),
        currency: "CZK",
      })
    ).toBe(50_000)
  })

  test("leaves the tip out", () => {
    expect(
      deriveRefundableAmount({
        amount: NonNegativeInteger(25_000),
        cashReceivedAmount: null,
        excess: NonNegativeInteger(0),
        tipAmount: NonNegativeInteger(2_000),
        currency: "CZK",
      })
    ).toBe(23_000)
    expect(
      deriveRefundableAmount({
        amount: NonNegativeInteger(25_000),
        cashReceivedAmount: NonNegativeInteger(25_000),
        excess: NonNegativeInteger(0),
        tipAmount: NonNegativeInteger(2_000),
        currency: "CZK",
      })
    ).toBe(23_000)
  })
})

describe("deriveRefundableTipAmount", () => {
  test("offers the whole tip until a tip refund returns it", () => {
    const payment = {
      amount: NonNegativeInteger(25_000),
      tipAmount: NonNegativeInteger(2_000),
      cashReceivedAmount: null,
      currency: "CZK",
    } as const
    expect(deriveRefundableTipAmount({ ...payment, refunds: [] })).toBe(2_000)
    expect(
      deriveRefundableTipAmount({ ...payment, refunds: [{ isTip: null }] })
    ).toBe(2_000)
    expect(
      deriveRefundableTipAmount({
        ...payment,
        refunds: [{ isTip: sqliteTrue }],
      })
    ).toBe(0)
    expect(
      deriveRefundableTipAmount({
        ...payment,
        tipAmount: NonNegativeInteger(0),
        refunds: [],
      })
    ).toBe(0)
  })

  test("offers the tip the cash brought above the goods in whole crowns", () => {
    expect(
      deriveRefundableTipAmount({
        amount: NonNegativeInteger(5_828),
        tipAmount: NonNegativeInteger(278),
        cashReceivedAmount: NonNegativeInteger(5_800),
        currency: "CZK",
        refunds: [],
      })
    ).toBe(200)
  })
})

describe("deriveCashRefundHandedAmounts", () => {
  test.each([
    { goods: 5_790, tip: 580, currency: "CZK", handed: [5_820, 580] },
    { goods: 5_750, tip: 580, currency: "CZK", handed: [5_720, 580] },
    { goods: 5_790, tip: 0, currency: "CZK", handed: [5_800, 0] },
    { goods: 5_749, tip: 0, currency: "CZK", handed: [5_700, 0] },
    { goods: 0, tip: 580, currency: "CZK", handed: [0, 600] },
    { goods: 7_900, tip: 2_000, currency: "CZK", handed: [7_900, 2_000] },
    { goods: 10, tip: 520, currency: "CZK", handed: [0, 500] },
    { goods: 5_790, tip: 580, currency: "EUR", handed: [5_790, 580] },
  ] as const)(
    "hands out $handed for $goods goods and a $tip tip in $currency",
    ({ goods, tip, currency, handed }) => {
      const result = deriveCashRefundHandedAmounts({
        goodsAmount: NonNegativeInteger(goods),
        tipAmount: NonNegativeInteger(tip),
        currency,
      })
      expect([result.goods, result.tip]).toEqual(handed)
    }
  )
})

describe("deriveRefundPrefillAmount", () => {
  test.each([
    { remaining: 25_000, excess: 0, prefill: 25_000 },
    { remaining: 50_000, excess: 25_000, prefill: 25_000 },
    { remaining: 10_000, excess: 25_000, prefill: 10_000 },
  ])(
    "prefills $prefill of $remaining left with $excess excess",
    ({ remaining, excess, prefill }) => {
      expect(
        deriveRefundPrefillAmount({
          remainingAmount: NonNegativeInteger(remaining),
          excess: NonNegativeInteger(excess),
          method: "outside",
          currency: "CZK",
        })
      ).toBe(prefill)
    }
  )

  test.each([
    {
      remaining: 5_525,
      method: "cashRegister",
      currency: "CZK",
      prefill: 5_500,
    },
    {
      remaining: 7_900,
      method: "cashRegister",
      currency: "CZK",
      prefill: 7_900,
    },
    {
      remaining: 5_550,
      method: "cashRegister",
      currency: "CZK",
      prefill: 5_500,
    },
    { remaining: 5_525, method: "outside", currency: "CZK", prefill: 5_525 },
    {
      remaining: 5_525,
      method: "cashRegister",
      currency: "EUR",
      prefill: 5_525,
    },
  ] as const)(
    "prefills $prefill of $remaining $currency left for a refund $method",
    ({ remaining, method, currency, prefill }) => {
      expect(
        deriveRefundPrefillAmount({
          remainingAmount: NonNegativeInteger(remaining),
          excess: NonNegativeInteger(0),
          method,
          currency,
        })
      ).toBe(prefill)
    }
  )
})

describe("summarizeRefundsByPayment", () => {
  const paymentId = "payment" as PaymentId
  const refundOf = (
    amount: number,
    claimAmounts: ReadonlyArray<number>,
    {
      isTip = null,
      tipAmount = 0,
    }: { readonly isTip?: 1 | null; readonly tipAmount?: number } = {}
  ) => ({
    paymentId,
    amount: NonNegativeInteger(amount),
    currency: "CZK" as const,
    isTip,
    paymentAmount: NonNegativeInteger(25_000),
    paymentTipAmount: NonNegativeInteger(tipAmount),
    paymentCurrency: "CZK" as const,
    cashReceivedAmount: null,
    paymentClaims: claimAmounts.map((claimAmount, index) => ({
      accountTransactionId: `tx-${index}` as AccountTransactionId,
      amount: claimAmount,
      currency: "CZK" as const,
      paymentAmountSats: null,
    })),
  })

  test("measures a returned duplicate against everything the payment received", () => {
    const summary = summarizeRefundsByPayment([
      refundOf(25_000, [25_000, 25_000]),
    ]).get(paymentId)

    expect(summary).toEqual({
      refundedAmount: 25_000,
      refundableAmount: 50_000,
      returnedAmount: 25_000,
      currency: "CZK",
    })
    expect(summary === undefined ? null : deriveRefundState(summary)).toBe(
      "partial"
    )
  })

  test("leaves a tip refund out of the refunded state", () => {
    const tipOnly = summarizeRefundsByPayment([
      refundOf(2_000, [25_000], { isTip: sqliteTrue, tipAmount: 2_000 }),
    ]).get(paymentId)
    const goodsAndTip = summarizeRefundsByPayment([
      refundOf(23_000, [25_000], { tipAmount: 2_000 }),
      refundOf(2_000, [25_000], { isTip: sqliteTrue, tipAmount: 2_000 }),
    ]).get(paymentId)
    const goodsOnly = summarizeRefundsByPayment([
      refundOf(23_000, [25_000], { tipAmount: 2_000 }),
    ]).get(paymentId)

    expect(tipOnly === undefined ? null : deriveRefundState(tipOnly)).toBe(
      "none"
    )
    expect(goodsAndTip).toMatchObject({
      refundedAmount: 23_000,
      refundableAmount: 23_000,
      returnedAmount: 25_000,
    })
    expect(
      goodsAndTip === undefined ? null : deriveRefundState(goodsAndTip)
    ).toBe("full")
    expect(goodsOnly === undefined ? null : deriveRefundState(goodsOnly)).toBe(
      "full"
    )
  })

  test("reads a payment settled once and refunded in full as full", () => {
    const summary = summarizeRefundsByPayment([refundOf(25_000, [25_000])]).get(
      paymentId
    )

    expect(summary === undefined ? null : deriveRefundState(summary)).toBe(
      "full"
    )
  })
})

describe("deriveRefundState", () => {
  test.each([
    [0, "none"],
    [5_000, "partial"],
    [25_000, "full"],
  ] as const)("reads %i refunded of 25000 as %s", (refundedAmount, state) => {
    expect(
      deriveRefundState({
        refundedAmount: NonNegativeInteger(refundedAmount),
        refundableAmount: NonNegativeInteger(25_000),
      })
    ).toBe(state)
  })
})

describe("deriveRefundableLines", () => {
  test("leaves out tips and what was already refunded", () => {
    const tip = {
      id: "tip" as PaymentLineId,
      type: "tip",
      quantity: PositiveNumber(1),
      totalAmount: NonNegativeInteger(2_000),
      discountShare: null,
    } as const

    expect(
      deriveRefundableLines(
        [threeCoffees, tip],
        [
          {
            paymentLineId: lineId,
            quantity: PositiveNumber(1),
            amount: NonNegativeInteger(3_333),
          },
        ]
      )
    ).toEqual([
      { line: threeCoffees, remainingQuantity: 2, remainingAmount: 6_667 },
    ])
  })

  test("does not offer a free line", () => {
    const water = {
      id: "water" as PaymentLineId,
      type: "catalogItem",
      quantity: PositiveNumber(2),
      totalAmount: NonNegativeInteger(0),
      discountShare: null,
    } as const

    expect(deriveRefundableLines([threeCoffees, water], [])).toEqual([
      { line: threeCoffees, remainingQuantity: 3, remainingAmount: 10_000 },
    ])
  })

  test("offers a discounted goods line at its net amount, and neither the discount line nor a line it took to zero", () => {
    const coffees = { ...threeCoffees, discountShare: Integer(-1_000) }
    const cake = {
      id: "cake" as PaymentLineId,
      type: "catalogItem",
      quantity: PositiveNumber(1),
      totalAmount: Integer(500),
      discountShare: Integer(-500),
    } as const
    const discount = {
      id: "discount" as PaymentLineId,
      type: "catalogItem",
      quantity: PositiveNumber(1),
      totalAmount: Integer(-1_500),
      discountShare: null,
    } as const

    expect(deriveRefundableLines([coffees, cake, discount], [])).toEqual([
      { line: coffees, remainingQuantity: 3, remainingAmount: 9_000 },
    ])
  })
})

describe("calculateRefundLineAmount", () => {
  test("returns the rest of the line without a rounding remainder", () => {
    const [first] = deriveRefundableLines([threeCoffees], [])
    if (first === undefined) throw new Error("Expected a refundable line.")
    expect(calculateRefundLineAmount(first, 1)).toBe(3_333)

    const [rest] = deriveRefundableLines(
      [threeCoffees],
      [
        {
          paymentLineId: lineId,
          quantity: PositiveNumber(1),
          amount: NonNegativeInteger(3_333),
        },
      ]
    )
    if (rest === undefined) throw new Error("Expected a refundable line.")
    expect(calculateRefundLineAmount(rest, 2)).toBe(6_667)
  })

  test("returns a discounted line's net amount, pro rata to the quantity returned", () => {
    const coffees = { ...threeCoffees, discountShare: Integer(-1_000) }
    const [first] = deriveRefundableLines([coffees], [])
    if (first === undefined) throw new Error("Expected a refundable line.")
    expect(calculateRefundLineAmount(first, 1)).toBe(3_000)

    const [rest] = deriveRefundableLines(
      [coffees],
      [
        {
          paymentLineId: lineId,
          quantity: PositiveNumber(1),
          amount: NonNegativeInteger(3_000),
        },
      ]
    )
    if (rest === undefined) throw new Error("Expected a refundable line.")
    expect(calculateRefundLineAmount(rest, 2)).toBe(6_000)
  })
})
