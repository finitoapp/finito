import type { PaymentLineId } from "@payky/core/modules/payment-line/payment-line-types"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import {
  deriveRefundAmountText,
  deriveRefundAvailability,
  deriveRefundForm,
  deriveRefundOptions,
  describeQerkoRefundError,
  describeRefundOutcome,
  type RefundablePaymentLine,
  type RefundChoice,
  selectRefundMethod,
  stepRefundQuantity,
} from "./refund-form.ts"

const n = NonNegativeInteger
const lineId = "line-1" as unknown as PaymentLineId
const beer = {
  id: lineId,
  type: "catalogItem",
  quantity: 2,
  totalAmount: 9001,
  name: "Beer",
} as unknown as RefundablePaymentLine
const refundable = {
  line: beer,
  remainingQuantity: 2,
  remainingAmount: n(9001),
}

const payment = {
  billId: "bill-1" as never,
  amount: n(10000),
  tipAmount: n(0),
  currency: "CZK" as const,
  cashReceivedAmount: null,
}

describe("refund availability (refund/0002, 0005)", () => {
  const base = {
    payment,
    excess: n(0),
    isPaid: true,
    refunds: [],
    refundLines: [],
    paymentLines: [beer],
    hasOtherClaimedPayment: false,
  }

  test("offers items only from a bill's only payment", () => {
    expect(deriveRefundAvailability(base).refundableLines).toHaveLength(1)
    expect(
      deriveRefundAvailability({ ...base, hasOtherClaimedPayment: true })
        .refundableLines
    ).toEqual([])
    expect(
      deriveRefundAvailability({
        ...base,
        payment: { ...payment, billId: null },
      }).refundableLines
    ).toEqual([])
  })

  test("offers nothing on an unpaid payment and counts earlier refunds", () => {
    expect(deriveRefundAvailability({ ...base, isPaid: false }).canRefund).toBe(
      false
    )
    const refunded = deriveRefundAvailability({
      ...base,
      refunds: [{ amount: n(10000), isTip: null }],
    })
    expect(refunded.remainingAmount).toBe(0)
    expect(refunded.canRefund).toBe(false)
  })
})

describe("refund form", () => {
  const form = {
    mode: "amount" as const,
    amountText: "50",
    quantities: {},
    refundableLines: [refundable],
    remainingAmount: n(10000),
    currency: "CZK" as const,
  }

  test("a typed amount above what is left is not valid", () => {
    expect(deriveRefundForm(form).refundAmount).toBe(5000)
    expect(deriveRefundForm({ ...form, amountText: "101" }).refundAmount).toBe(
      null
    )
    expect(deriveRefundForm({ ...form, amountText: "abc" }).refundAmount).toBe(
      null
    )
  })

  test("items refund the rest of a line without a rounding remainder", () => {
    const items = { ...form, mode: "items" as const }
    expect(deriveRefundForm(items).refundAmount).toBe(null)
    expect(
      deriveRefundForm({ ...items, quantities: { [lineId]: 1 } }).refundAmount
    ).toBe(4501)
    expect(
      deriveRefundForm({ ...items, quantities: { [lineId]: 2 } }).refundAmount
    ).toBe(9001)
  })

  test("steps a quantity within what is left", () => {
    const up = stepRefundQuantity({ [lineId]: 2 }, refundable, 1)
    expect(up[lineId]).toBe(2)
    expect(stepRefundQuantity({}, refundable, -1)[lineId]).toBe(0)
    expect(stepRefundQuantity({}, refundable, 1)[lineId]).toBe(1)
  })

  test("prefills whole crowns from the cash register, the exact amount outside (refund/0006)", () => {
    const text = (method: "cashRegister" | "outside", left = 7940) =>
      deriveRefundAmountText({
        typedAmountText: null,
        remainingAmount: n(left),
        excess: n(0),
        method,
        currency: "CZK",
      })
    expect(text("outside")).toBe("79.4")
    expect(text("cashRegister")).toBe("79")
    // Rounding up would exceed what is left, so one crown lower.
    expect(text("cashRegister", 7890)).toBe("78")
    expect(
      deriveRefundAmountText({
        typedAmountText: "12",
        remainingAmount: n(7890),
        excess: n(0),
        method: "cashRegister",
        currency: "CZK",
      })
    ).toBe("12")
  })
})

describe("describeQerkoRefundError", () => {
  test("keeps the wording of a refund's own checks", () => {
    expect(describeQerkoRefundError({ type: "RefundAmountInvalid" })).toBe(
      "refund.error.amount"
    )
    expect(describeQerkoRefundError({ type: "RefundTipUnavailable" })).toBe(
      "refund.error.tip"
    )
  })

  test("says what is specific to the card terminal", () => {
    expect(describeQerkoRefundError({ type: "QerkoRefundNotAvailable" })).toBe(
      "refund.qerko.error.notAvailable"
    )
    expect(
      describeQerkoRefundError({
        type: "QerkoTerminalRefundFailed",
        reason: "cancelled",
      })
    ).toBe("refund.qerko.failed.cancelled")
  })

  test("words a refusal to start like a payment's", () => {
    expect(
      describeQerkoRefundError({
        type: "QerkoTerminalRefundNotStarted",
        reason: "terminalBusy",
      })
    ).toBe("paymentWait.qerko.notStarted.busy")
  })

  test("a terminal that cannot take the refund is not one to choose again", () => {
    expect(
      describeQerkoRefundError({
        type: "QerkoTerminalRefundNotStarted",
        reason: "terminalNotActivated",
      })
    ).toBe("refund.qerko.error.terminalNotActivated")
    expect(
      describeQerkoRefundError({
        type: "QerkoTerminalRefundNotStarted",
        reason: "unknownTerminal",
      })
    ).toBe("refund.qerko.error.unknownTerminal")
    expect(
      describeQerkoRefundError({
        type: "QerkoTerminalRefundNotStarted",
        reason: "terminalNotConnected",
      })
    ).toBe("refund.qerko.error.terminalNotConnected")
  })
})

describe("deriveRefundOptions", () => {
  const availability = {
    remainingAmount: n(23000),
    refundableTipAmount: n(2000),
    refundableLines: [refundable],
    canRefund: true,
    canRefundTip: true,
  }
  const everything = {
    paymentMethodKinds: ["cashRegister"],
    availability,
    qerkoPaymentRefundable: true,
    qerkoTerminalRefundable: true,
    switchioRefundable: true,
  }
  const allowed = (method: string, choice: RefundChoice) =>
    deriveRefundOptions(everything).methods[choice].includes(method as never)

  // The plan's table: which method suits which choice, where it is possible.
  test.each`
    method             | whole   | part     | tip
    ${"cardSwitchio"}  | ${true} | ${true}  | ${true}
    ${"qerkoTerminal"} | ${true} | ${true}  | ${true}
    ${"qerkoPayment"}  | ${true} | ${false} | ${false}
    ${"cashRegister"}  | ${true} | ${true}  | ${true}
    ${"outside"}       | ${true} | ${true}  | ${true}
  `(
    "$method: whole $whole, part $part, tip $tip",
    ({ method, whole, part, tip }) => {
      expect({
        whole: allowed(method, "whole"),
        part: allowed(method, "part"),
        tip: allowed(method, "tip"),
      }).toEqual({ whole, part, tip })
    }
  )

  test("offers a card method only where this device can refund that card", () => {
    const { methods } = deriveRefundOptions({
      ...everything,
      qerkoPaymentRefundable: false,
      qerkoTerminalRefundable: false,
      switchioRefundable: false,
    })
    expect(methods).toEqual({
      whole: ["cashRegister", "outside"],
      part: ["cashRegister", "outside"],
      tip: ["cashRegister", "outside"],
    })
  })

  test("offers the whole payment with its tip, the goods alone, and the tip alone", () => {
    expect(deriveRefundOptions(everything).choices).toEqual([
      { choice: "whole", amount: 25000, tipAmount: 2000 },
      { choice: "part", amount: 23000, tipAmount: 0 },
      { choice: "tip", amount: 2000, tipAmount: 2000 },
    ])
    const withoutTip = deriveRefundOptions({
      ...everything,
      availability: {
        ...availability,
        refundableTipAmount: n(0),
        canRefundTip: false,
      },
    })
    expect(withoutTip.choices).toEqual([
      { choice: "whole", amount: 23000, tipAmount: 0 },
      { choice: "part", amount: 23000, tipAmount: 0 },
    ])
    expect(withoutTip.methods.tip).toEqual([])
  })

  test("offers only the tip once the goods are all back", () => {
    const options = deriveRefundOptions({
      ...everything,
      qerkoPaymentRefundable: false,
      availability: {
        ...availability,
        remainingAmount: n(0),
        canRefund: false,
      },
    })
    expect(options.choices.map(({ choice }) => choice)).toEqual(["tip"])
    expect(options.defaultChoice).toBe("tip")
    expect(options.methods.whole).toEqual([])
  })

  test("offers nothing when nothing is left", () => {
    expect(
      deriveRefundOptions({
        ...everything,
        qerkoPaymentRefundable: false,
        availability: {
          ...availability,
          remainingAmount: n(0),
          canRefund: false,
          canRefundTip: false,
        },
      })
    ).toMatchObject({ choices: [], defaultChoice: null, defaultMethod: null })
  })

  test("offers items only beside an amount, from a bill's only payment (refund/0002)", () => {
    expect(deriveRefundOptions(everything).partModes).toEqual([
      "amount",
      "items",
    ])
    expect(
      deriveRefundOptions({
        ...everything,
        availability: { ...availability, refundableLines: [] },
      }).partModes
    ).toEqual(["amount"])
  })

  test.each`
    kinds                | flags                                | method
    ${["cardSwitchio"]}  | ${{ switchioRefundable: true }}      | ${"cardSwitchio"}
    ${["cardSwitchio"]}  | ${{}}                                | ${"outside"}
    ${["qerkoTerminal"]} | ${{ qerkoTerminalRefundable: true }} | ${"qerkoTerminal"}
    ${["qerkoTerminal"]} | ${{}}                                | ${"outside"}
    ${["qerkoPayment"]}  | ${{ qerkoPaymentRefundable: true }}  | ${"qerkoPayment"}
    ${["cashRegister"]}  | ${{}}                                | ${"cashRegister"}
    ${["iban"]}          | ${{}}                                | ${"outside"}
  `(
    "starts a payment that came by $kinds on $method",
    ({ kinds, flags, method }) => {
      expect(
        deriveRefundOptions({
          paymentMethodKinds: kinds,
          availability,
          qerkoPaymentRefundable: false,
          qerkoTerminalRefundable: false,
          switchioRefundable: false,
          ...flags,
        })
      ).toMatchObject({ defaultChoice: "whole", defaultMethod: method })
    }
  )

  test("keeps the method a new choice allows, else takes its first", () => {
    const options = deriveRefundOptions({
      ...everything,
      paymentMethodKinds: ["qerkoPayment"],
      qerkoTerminalRefundable: false,
      switchioRefundable: false,
    })
    expect(options.defaultMethod).toBe("qerkoPayment")
    expect(
      selectRefundMethod({ options, choice: "part", method: "qerkoPayment" })
    ).toBe("cashRegister")
    expect(
      selectRefundMethod({ options, choice: "tip", method: "outside" })
    ).toBe("outside")
    expect(
      selectRefundMethod({
        options: { methods: { whole: [], part: [], tip: [] } },
        choice: "tip",
        method: "outside",
      })
    ).toBe(null)
  })
})

describe("describeRefundOutcome", () => {
  const outcome = (
    input: Partial<Parameters<typeof describeRefundOutcome>[0]>
  ) =>
    describeRefundOutcome({
      choice: "whole",
      method: "cardSwitchio",
      switchioRefundKind: null,
      amount: "63.80 CZK",
      ...input,
    })

  test("a whole card payment taken back needs no card (refund/0008)", () => {
    expect(outcome({ switchioRefundKind: "reversal" }).key).toBe(
      "refund.outcome.reversal"
    )
  })

  test("any other card refund goes back to the card that paid", () => {
    expect(outcome({ switchioRefundKind: "referralRefund" }).key).toBe(
      "refund.outcome.card"
    )
    expect(outcome({ choice: "tip", switchioRefundKind: "reversal" }).key).toBe(
      "refund.outcome.card"
    )
    expect(outcome({ method: "qerkoTerminal" }).key).toBe("refund.outcome.card")
  })

  test("cash names what to hand over, outside is only recorded", () => {
    expect(outcome({ method: "cashRegister", choice: "part" })).toEqual({
      key: "refund.outcome.cashRegister",
      params: { amount: "63.80 CZK" },
    })
    expect(outcome({ method: "outside" }).key).toBe("refund.outcome.outside")
    expect(outcome({ method: "qerkoPayment" }).key).toBe(
      "refund.outcome.qerkoPayment"
    )
  })
})
