import { describe, expect, test } from "vitest"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { OverpaymentResolutionId } from "../overpayment-resolution/overpayment-resolution-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import { NonNegativeInteger } from "../shared/schema.ts"
import {
  answeredBy,
  answeredByResolutions,
  createOverpaymentSimulation,
  createSeededRandom,
  type OverpaymentSimulation,
  type SeededRandom,
  syncClockHex,
} from "./bill-overpayment-test-fixtures.ts"
import {
  type BillOverpayment,
  type BillOverpaymentInput,
  deriveBillHistoryItemSummary,
  deriveBillOverpayment,
  deriveOverpaymentTip,
  deriveRefundOverpaymentAmount,
  deriveReturnableOverpayment,
  type OverpaymentPayment,
  type OverpaymentRefund,
  type OverpaymentTransaction,
} from "./bill-utils.ts"

const payment = (fields: {
  readonly amount: number
  readonly tipAmount?: number
  readonly cashReceivedAmount?: number
}): OverpaymentPayment => ({
  id: "payment" as PaymentId,
  amount: NonNegativeInteger(fields.amount),
  tipAmount: NonNegativeInteger(fields.tipAmount ?? 0),
  currency: "CZK",
  cashReceivedAmount:
    fields.cashReceivedAmount === undefined
      ? null
      : NonNegativeInteger(fields.cashReceivedAmount),
  acknowledgementClock: null,
})

const settlement = (
  id: string,
  amount: number,
  paymentAmount: number,
  clock: number
): OverpaymentTransaction => ({
  accountTransactionId: id as AccountTransactionId,
  paymentId: "payment" as PaymentId,
  amount,
  currency: "CZK",
  paymentAmount: NonNegativeInteger(paymentAmount),
  paymentCurrency: "CZK",
  paymentAmountSats: null,
  claimClock: syncClockHex(clock),
})

const refundOf = (
  input: BillOverpaymentInput,
  fields: {
    readonly id: string
    readonly amount: number
    readonly isTip?: boolean
    readonly kind?: "return" | "goods"
    readonly clock: number
  }
): OverpaymentRefund => ({
  id: fields.id as RefundId,
  paymentId: "payment" as PaymentId,
  amount: NonNegativeInteger(fields.amount),
  isTip: fields.isTip ?? false,
  overpaymentAmount:
    fields.isTip === true
      ? NonNegativeInteger(0)
      : deriveRefundOverpaymentAmount(input, {
          paymentId: "payment" as PaymentId,
          amount: NonNegativeInteger(fields.amount),
          kind: { type: fields.kind ?? "goods" },
        }),
  knownTransactionIds: input.transactions.map(
    (transaction) => transaction.accountTransactionId
  ),
  withoutDeviceAmount: NonNegativeInteger(0),
  recordClock: syncClockHex(fields.clock),
})

const billOf = (
  fields: Omit<Partial<BillOverpaymentInput>, "billTotal"> & {
    readonly billTotal: number
  }
): BillOverpaymentInput => ({
  isCanceled: false,
  payments: [],
  transactions: [],
  refunds: [],
  resolutions: [],
  ...fields,
  billTotal: NonNegativeInteger(fields.billTotal),
})

describe("The unresolved overpayment of a bill", () => {
  test("Lines removed after a guest paid", () => {
    const bill = createOverpaymentSimulation(500)
    const guest = bill.addPayment("guest", 250)
    bill.pay(guest, 250)
    bill.setTotal(0)

    expect(bill.derive().unresolved).toBe(250)
    expect(
      deriveBillHistoryItemSummary({
        canceledAt: null,
        confirmedClosedAt: null,
        billTotal: NonNegativeInteger(0),
        claimedTransactions: bill.input().transactions.map((transaction) => ({
          ...transaction,
          tipAmount: NonNegativeInteger(0),
        })),
      }).status
    ).toBe("closed")
  })

  test("Two guests pay the same share", () => {
    const bill = createOverpaymentSimulation(10_000)
    for (const [name, ask] of [
      ["first", 4_000],
      ["second", 4_000],
      ["third", 6_000],
    ] as const) {
      bill.pay(bill.addPayment(name, ask), ask)
    }

    expect(bill.derive().unresolved).toBe(4_000)
  })

  test("Extra money on a bill still underpaid", () => {
    const bill = createOverpaymentSimulation(20_000)
    const settled = bill.addPayment("settled", 10_000)
    bill.addPayment("pending", 10_000)
    bill.pay(settled, 15_000)

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Payment without a bill settled twice", () => {
    const keypad = payment({ amount: 25_000 })
    const overpayment = deriveBillOverpayment(
      billOf({
        billTotal: keypad.amount - keypad.tipAmount,
        payments: [keypad],
        transactions: [
          settlement("first", 25_000, 25_000, 1),
          settlement("second", 25_000, 25_000, 2),
        ],
      })
    )

    expect(overpayment.unresolved).toBe(25_000)
  })

  test("Cash paid with less than the charge", () => {
    const overpayment = deriveBillOverpayment(
      billOf({
        billTotal: 4_540,
        payments: [payment({ amount: 4_540, cashReceivedAmount: 4_500 })],
        transactions: [settlement("cash", 4_540, 4_540, 1)],
      })
    )

    expect(overpayment.unresolved).toBe(0)
  })

  test("Change left on a cash payment", () => {
    const overpayment = deriveBillOverpayment(
      billOf({
        billTotal: 4_540,
        payments: [payment({ amount: 4_540, cashReceivedAmount: 5_000 })],
        transactions: [settlement("cash", 4_540, 4_540, 1)],
      })
    )

    expect(overpayment.unresolved).toBe(0)
  })

  test("Self-pay money after the bill closed", () => {
    const bill = createOverpaymentSimulation(10_000)
    bill.pay(bill.addPayment("staff", 10_000), 10_000)
    bill.pay(bill.addPayment("guest", 3_000), 3_000)

    expect(bill.derive().unresolved).toBe(3_000)
  })

  test("Tip refunded on an overpaid bill", () => {
    const card = payment({ amount: 27_000, tipAmount: 2_000 })
    const paid = billOf({
      billTotal: 20_000,
      payments: [card],
      transactions: [settlement("card", 27_000, 27_000, 1)],
    })
    const tipRefunded = {
      ...paid,
      refunds: [
        refundOf(paid, { id: "tip", amount: 2_000, isTip: true, clock: 2 }),
      ],
    }

    expect(deriveBillOverpayment(paid).unresolved).toBe(5_000)
    expect(deriveBillOverpayment(tipRefunded).unresolved).toBe(5_000)
  })

  test("Canceled bill", () => {
    const overpayment = deriveBillOverpayment(
      billOf({
        billTotal: 10_000,
        isCanceled: true,
        payments: [payment({ amount: 15_000 })],
        transactions: [settlement("card", 15_000, 15_000, 1)],
      })
    )

    expect(overpayment.unresolved).toBe(0)
    expect(overpayment.answers).toEqual([])
  })
})

describe("What each resolution answers", () => {
  test("Overpayment returned", () => {
    const bill = createOverpaymentSimulation(500)
    const guest = bill.addPayment("guest", 250)
    bill.pay(guest, 250)
    bill.setTotal(0)
    bill.recordRefund(guest, 250, { type: "return" })

    expect(bill.derive().unresolved).toBe(0)
    expect(
      deriveBillHistoryItemSummary({
        canceledAt: null,
        confirmedClosedAt: null,
        billTotal: NonNegativeInteger(0),
        claimedTransactions: bill.input().transactions.map((transaction) => ({
          ...transaction,
          tipAmount: NonNegativeInteger(0),
        })),
      })
    ).toMatchObject({ status: "closed", coverage: "overpaid" })
  })

  test("Refund recorded before the change", () => {
    const bill = createOverpaymentSimulation(500)
    const guest = bill.addPayment("guest", 250)
    bill.pay(guest, 250)
    bill.setTotal(0)
    bill.recordLegacyRefund(guest, 250)

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Item returned from an overpaid bill", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 10_000)
    bill.pay(card, 10_000)
    bill.recordRefund(card, 5_000, {
      type: "items",
      removedLinesAmount: NonNegativeInteger(0),
    })

    expect(bill.derive().unresolved).toBe(10_000)
  })

  test("Item refunded that the bill no longer holds", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 10_000)
    bill.setTotal(5_000)
    bill.recordRefund(card, 5_000, {
      type: "items",
      removedLinesAmount: NonNegativeInteger(5_000),
    })

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Tip confirmed", () => {
    const bill = createOverpaymentSimulation(50_000)
    const guest = bill.addPayment("guest", 50_000)
    const other = bill.addPayment("other", 0)
    bill.pay(guest, 52_500)
    const tip = bill.recordResolution("tip", guest, 2_000)
    bill.recordResolution("kept", guest, 500)

    expect(deriveOverpaymentTip(bill.derive(), guest)).toBe(2_000)
    expect(deriveOverpaymentTip(bill.derive(), other)).toBe(0)
    if (tip !== null) bill.withdraw(tip)
    expect(deriveOverpaymentTip(bill.derive(), guest)).toBe(0)
  })

  test("Goodwill refund on an overpaid bill", () => {
    const bill = createOverpaymentSimulation(25_000)
    const card = bill.addPayment("card", 25_000)
    bill.pay(card, 30_000)
    bill.recordRefund(card, 3_000, { type: "goods" })
    const tip = bill.recordResolution("tip", card, 5_000)

    expect(tip).not.toBeNull()
    expect(tip === null ? 0 : answeredBy(bill.derive(), tip)).toBe(5_000)
    expect(bill.derive().unresolved).toBe(0)
  })

  test("Goodwill refund before a duplicate payment", () => {
    const bill = createOverpaymentSimulation(25_000)
    const card = bill.addPayment("card", 25_000)
    bill.pay(card, 25_000)
    bill.recordRefund(card, 3_000, { type: "goods" })
    bill.pay(bill.addPayment("duplicate", 5_000), 5_000)

    expect(bill.derive().unresolved).toBe(5_000)
  })

  test("Extra money returned before the bill was paid", () => {
    const bill = createOverpaymentSimulation(20_000)
    const first = bill.addPayment("first", 10_000)
    const second = bill.addPayment("second", 10_000)
    bill.pay(first, 15_000)
    bill.recordRefund(first, 5_000, { type: "return" })
    bill.pay(second, 10_000)

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Goodwill refund, then the extra money returned before the bill was paid", () => {
    const bill = createOverpaymentSimulation(20_000)
    const first = bill.addPayment("first", 10_000)
    const second = bill.addPayment("second", 10_000)
    bill.pay(first, 15_000)
    bill.recordRefund(first, 3_000, { type: "goods" })
    bill.recordRefund(first, 5_000, { type: "return" })
    bill.pay(second, 10_000)

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Tip, then a returned duplicate", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 15_000)
    const tip = bill.recordResolution("tip", card, 5_000)
    bill.pay(card, 5_000)
    bill.recordRefund(card, 5_000, { type: "return" })

    expect(tip === null ? 0 : answeredBy(bill.derive(), tip)).toBe(5_000)
    expect(bill.derive().unresolved).toBe(0)
  })

  test("Return and keep on two devices at once", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 10_000)
    bill.pay(card, 10_000)
    const known = bill.presentTransactionIds()
    const returned = bill.recordRefund(card, 10_000, { type: "return" }, known)
    const kept = bill.forceResolution("kept", card, 10_000, {
      known,
      clockBefore: returned,
    })

    expect(answeredBy(bill.derive(), returned)).toBe(10_000)
    expect(answeredBy(bill.derive(), kept)).toBe(0)
  })

  describe("two devices keep the same overpayment", () => {
    const keepTwice = () => {
      const bill = createOverpaymentSimulation(10_000)
      const card = bill.addPayment("card", 10_000)
      bill.pay(card, 10_000)
      bill.pay(card, 10_000)
      const known = bill.presentTransactionIds()
      const earlier = bill.recordResolution("kept", card, 10_000, known)
      const later = bill.forceResolution("kept", card, 10_000, { known })
      return { bill, earlier, later }
    }

    test("Two devices keep at once", () => {
      const { bill, earlier, later } = keepTwice()

      expect(earlier === null ? 0 : answeredBy(bill.derive(), earlier)).toBe(
        10_000
      )
      expect(answeredBy(bill.derive(), later)).toBe(0)
    })

    test("More money after a resolution", () => {
      const { bill, later } = keepTwice()
      bill.pay(bill.addPayment("guest", 8_000), 8_000)

      expect(bill.derive().unresolved).toBe(8_000)
      expect(answeredBy(bill.derive(), later)).toBe(0)
    })
  })

  test("Return larger than the overpayment", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 10_000)
    bill.pay(card, 10_000)
    const returned = bill.recordRefund(card, 15_000, { type: "return" })
    bill.pay(bill.addPayment("guest", 8_000), 8_000)
    const overpayment = bill.derive()

    expect(answeredBy(overpayment, returned)).toBe(10_000)
    expect(
      overpayment.answers.find(
        (answer) =>
          answer.source.type === "return" && answer.source.id === returned
      )?.amount
    ).toBe(10_000)
    expect(overpayment.unresolved).toBe(8_000)
  })

  test("Money removed under a resolution, then new money", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 10_000)
    const extra = bill.pay(card, 10_000)
    const kept = bill.recordResolution("kept", card, 10_000)
    bill.remove(extra)
    bill.pay(bill.addPayment("guest", 10_000), 10_000)

    expect(kept === null ? -1 : answeredBy(bill.derive(), kept)).toBe(0)
    expect(bill.derive().unresolved).toBe(10_000)
  })

  test("Tip whose payment is refunded in full", () => {
    const bill = createOverpaymentSimulation(25_000)
    const card = bill.addPayment("card", 25_000)
    bill.pay(card, 30_000)
    const tip = bill.recordResolution("tip", card, 5_000)
    bill.recordRefund(card, 30_000, { type: "goods" })

    expect(tip === null ? -1 : answeredBy(bill.derive(), tip)).toBe(0)
    expect(bill.derive().unresolved).toBe(0)
  })

  test("Tip on a duplicate share refunded", () => {
    const bill = createOverpaymentSimulation(10_000)
    bill.pay(bill.addPayment("first", 5_000), 5_000)
    bill.pay(bill.addPayment("second", 5_000), 5_000)
    const duplicate = bill.addPayment("duplicate", 5_000)
    bill.pay(duplicate, 5_000)
    const tip = bill.recordResolution("tip", duplicate, 5_000)
    bill.recordRefund(duplicate, 5_000, { type: "goods" })

    expect(tip === null ? -1 : answeredBy(bill.derive(), tip)).toBe(0)
    expect(bill.derive().unresolved).toBe(0)
  })

  test("Cash returned in part", () => {
    const cash = payment({ amount: 4_540, cashReceivedAmount: 4_500 })
    const lineLost = billOf({
      billTotal: 2_000,
      payments: [cash],
      transactions: [settlement("cash", 4_540, 4_540, 1)],
    })
    const offered = deriveReturnableOverpayment(lineLost, cash.id)
    const returned = {
      ...lineLost,
      refunds: [
        refundOf(lineLost, {
          id: "return",
          amount: offered,
          kind: "return",
          clock: 2,
        }),
      ],
    }

    expect(offered).toBe(2_500)
    expect(deriveBillOverpayment(returned).unresolved).toBe(0)
  })

  test("Recording device's clock runs behind", () => {
    const card = payment({ amount: 10_000 })
    const overpayment = deriveBillOverpayment(
      billOf({
        billTotal: 10_000,
        payments: [card],
        transactions: [
          settlement("paid", 10_000, 10_000, 5),
          settlement("extra", 10_000, 10_000, 9),
        ],
        resolutions: [
          {
            id: "kept" as OverpaymentResolutionId,
            paymentId: card.id,
            kind: "kept",
            amount: NonNegativeInteger(10_000),
            knownTransactionIds: [
              "paid" as AccountTransactionId,
              "extra" as AccountTransactionId,
            ],
            withdrawnId: null,
            recordClock: syncClockHex(3),
          },
        ],
      })
    )

    expect(overpayment.answers[0]?.answered).toBe(10_000)
    expect(overpayment.unresolved).toBe(0)
  })

  test("All money refunded after a return", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 20_000)
    bill.recordRefund(card, 5_000, { type: "return" })
    bill.recordRefund(card, 15_000, { type: "goods" })

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Checkout tip refunded after a kept amount", () => {
    const card = payment({ amount: 7_000, tipAmount: 2_000 })
    const kept = {
      id: "kept" as OverpaymentResolutionId,
      paymentId: card.id,
      kind: "kept" as const,
      amount: NonNegativeInteger(5_000),
      knownTransactionIds: ["card" as AccountTransactionId],
      withdrawnId: null,
      recordClock: syncClockHex(2),
    }
    const linesRemoved = billOf({
      billTotal: 0,
      payments: [card],
      transactions: [settlement("card", 7_000, 7_000, 1)],
      resolutions: [kept],
    })
    const tipRefunded = {
      ...linesRemoved,
      refunds: [
        refundOf(linesRemoved, {
          id: "tip",
          amount: 2_000,
          isTip: true,
          clock: 3,
        }),
      ],
    }
    const overpayment = deriveBillOverpayment(tipRefunded)

    expect(overpayment.answers[0]?.answered).toBe(5_000)
    expect(overpayment.unresolved).toBe(0)
  })

  test("Older app version refunds a kept payment in full", () => {
    const bill = createOverpaymentSimulation(25_000)
    const card = bill.addPayment("card", 25_000)
    bill.pay(card, 30_000)
    const kept = bill.recordResolution("kept", card, 5_000)
    bill.recordLegacyRefund(card, 30_000)

    expect(kept === null ? -1 : answeredBy(bill.derive(), kept)).toBe(0)
    expect(bill.derive().unresolved).toBe(0)
  })

  test("Total lowered after a refund", () => {
    const bill = createOverpaymentSimulation(10_000)
    const card = bill.addPayment("card", 10_000)
    bill.pay(card, 10_000)
    bill.recordRefund(card, 5_000, { type: "goods" })
    bill.setTotal(0)

    expect(bill.derive().unresolved).toBe(5_000)

    bill.recordRefund(card, 5_000, { type: "return" })

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Extra money returned by an older app version", () => {
    const bill = createOverpaymentSimulation(20_000)
    const first = bill.addPayment("first", 10_000)
    const second = bill.addPayment("second", 10_000)
    bill.pay(first, 15_000)
    bill.recordLegacyRefund(first, 5_000)
    bill.pay(second, 10_000)

    expect(bill.derive().unresolved).toBe(0)
  })
})

describe("Acknowledged extra money counts as kept", () => {
  test("Acknowledged before the change", () => {
    const bill = createOverpaymentSimulation(25_000)
    const card = bill.addPayment("card", 25_000)
    bill.pay(card, 25_000)
    bill.pay(card, 25_000)
    bill.acknowledge(card)

    expect(bill.derive().unresolved).toBe(0)
  })

  test("Money after the acknowledgement", () => {
    const bill = createOverpaymentSimulation(50_000)
    const first = bill.addPayment("first", 25_000)
    const second = bill.addPayment("second", 25_000)
    bill.pay(first, 25_000)
    bill.pay(first, 25_000)
    bill.acknowledge(first)
    bill.pay(second, 25_000)

    expect(bill.derive().unresolved).toBe(25_000)
  })
})

const heldAboveGoods = (
  bill: OverpaymentSimulation,
  overpayment: BillOverpayment
) => bill.held() - Math.max(0, bill.total() - bill.refundedGoods(overpayment))

const returnedBy = (overpayment: BillOverpayment) =>
  overpayment.answers
    .filter((answer) => answer.source.type === "return")
    .reduce((sum, answer) => sum + answer.answered, 0)

const sortedAnswers = (overpayment: BillOverpayment) =>
  [...overpayment.answers]
    .map((answer) => ({ ...answer, drawnFrom: [...answer.drawnFrom].sort() }))
    .sort((a, b) =>
      `${a.recordClock}${a.paymentId}`.localeCompare(
        `${b.recordClock}${b.paymentId}`
      )
    )

const startRandomBill = (random: SeededRandom) => {
  const bill = createOverpaymentSimulation(
    random.pick([0, 5_000, 10_000, 25_000])
  )
  const paymentCount = random.integer(1, 3)
  for (let index = 0; index < paymentCount; index++) {
    bill.addPayment(`P${index}`, random.pick([2_500, 5_000, 10_000, 25_000]))
  }
  return bill
}

const outOfSyncFailures = (
  seed: number,
  runs: number
): ReadonlyArray<string> => {
  const random = createSeededRandom(seed)
  const failures: string[] = []
  for (let run = 0; run < runs; run++) {
    const bill = startRandomBill(random)
    const steps = random.integer(2, 9)
    for (let step = 0; step < steps; step++) {
      const action = random.next()
      const paymentId = random.pick(bill.paymentIds())
      const present = [...bill.presentTransactionIds()]
      const stale = new Set(present.filter(() => random.next() < 0.8))
      const knownBy = () => (random.next() < 0.4 ? stale : undefined)
      if (action < 0.35 || present.length === 0) {
        bill.pay(paymentId, random.pick([2_500, 5_000, 10_000]), {
          reported: random.next() < 0.8,
        })
      } else if (action < 0.55) {
        const amount = random.pick([1_000, 2_500, 5_000])
        const kind = random.pick(["return", "goods"] as const)
        if (amount <= bill.holds(paymentId)) {
          bill.recordRefund(paymentId, amount, { type: kind }, knownBy())
        }
      } else if (action < 0.8) {
        bill.recordResolution(
          random.pick(["tip", "kept"] as const),
          paymentId,
          random.pick([1_000, 2_500, 5_000]),
          knownBy()
        )
      } else if (action < 0.9) {
        const active = bill.activeResolutionIds()
        if (active.length > 0) bill.withdraw(random.pick(active))
      } else {
        bill.remove(random.pick(present))
      }

      const overpayment = bill.derive()
      const { unresolved } = overpayment
      if (unresolved < 0 || unresolved > overpayment.overpayment) {
        failures.push(`bound ${unresolved} ${overpayment.overpayment}`)
      }

      const newMoney = "tNEW" as AccountTransactionId
      const current = bill.input()
      const withNewMoney: BillOverpaymentInput = {
        ...current,
        payments: [
          ...current.payments,
          { ...payment({ amount: 0 }), id: "NEW" as PaymentId },
        ],
        transactions: [
          ...current.transactions,
          {
            ...settlement("tNEW", 3_000, 0, 1_000_000),
            paymentId: "NEW" as PaymentId,
          },
        ],
      }
      const probe = deriveBillOverpayment(withNewMoney)
      if (probe.answers.some((answer) => answer.drawnFrom.includes(newMoney))) {
        failures.push("new money drawn")
      }
      const answered = overpayment.answers.reduce(
        (sum, answer) => sum + answer.answered,
        0
      )
      if (
        probe.unresolved - unresolved !== 3_000 &&
        bill.money() >= bill.total() &&
        overpayment.overpayment >= answered &&
        heldAboveGoods(bill, overpayment) >=
          overpayment.overpayment - returnedBy(overpayment)
      ) {
        failures.push(`new money hidden ${unresolved} ${probe.unresolved}`)
      }

      const shuffled = deriveBillOverpayment({
        ...current,
        payments: random.shuffle(current.payments),
        transactions: random.shuffle(current.transactions),
        refunds: random.shuffle(current.refunds),
        resolutions: random.shuffle(current.resolutions),
      })
      if (
        JSON.stringify(sortedAnswers(shuffled)) !==
        JSON.stringify(sortedAnswers(overpayment))
      ) {
        failures.push("order dependent")
      }

      const neverReportedLeft = bill.unreportedMoney()
      if (
        !bill.hasRemovals() &&
        bill.eetHolds() <
          Math.min(bill.reportedGoods(), bill.held() - neverReportedLeft)
      ) {
        failures.push(`eet below ${bill.eetHolds()}`)
      }
    }
  }
  return failures
}

const inSyncFailures = (seed: number, runs: number): ReadonlyArray<string> => {
  const random = createSeededRandom(seed)
  const failures: string[] = []
  for (let run = 0; run < runs; run++) {
    const bill = startRandomBill(random)
    let unreportedPool = 0
    let reportedReturned = 0
    let exactAccounting = true
    const steps = random.integer(2, 10)
    for (let step = 0; step < steps; step++) {
      const paymentId = random.pick(bill.paymentIds())
      const before = bill.derive()
      const resolvedBefore = answeredByResolutions(before)
      const action = random.next()
      if (action < 0.35 || bill.presentTransactionIds().size === 0) {
        const money = random.pick([2_500, 5_000, 10_000])
        const reported = random.next() < 0.75
        bill.pay(paymentId, money, { reported })
        if (!reported) unreportedPool += money
      } else if (action < 0.6) {
        const amount = random.pick([1_000, 2_500, 5_000, 10_000])
        if (amount <= bill.holds(paymentId)) {
          const kind = random.pick(["return", "goods"] as const)
          const refundId = bill.recordRefund(paymentId, amount, { type: kind })
          const fromPool = Math.min(amount, unreportedPool)
          unreportedPool -= fromPool
          reportedReturned += amount - fromPool
          const after = bill.derive()
          const recorded =
            after.answers.find(
              (answer) =>
                answer.source.type === "return" && answer.source.id === refundId
            )?.amount ?? 0
          if (
            exactAccounting &&
            bill.money() >= bill.total() &&
            before.unresolved -
              after.unresolved +
              (resolvedBefore - answeredByResolutions(after)) !==
              Math.min(recorded, before.unresolved + resolvedBefore)
          ) {
            failures.push(
              `refund not accounted ${recorded} ${before.unresolved} ${after.unresolved}`
            )
          }
        }
      } else if (action < 0.68) {
        const amount = random.pick([1_000, 2_500, 5_000, 10_000])
        if (amount <= bill.holds(paymentId)) {
          bill.recordLegacyRefund(paymentId, amount)
          exactAccounting = false
        }
      } else if (action < 0.73) {
        bill.setTotal(
          Math.max(0, bill.total() + random.pick([-5_000, -2_500, 2_500]))
        )
        exactAccounting = false
      } else if (action < 0.75) {
        bill.acknowledge(paymentId)
      } else if (action < 0.85) {
        const amount = random.pick([1_000, 2_500, 5_000])
        const recorded = bill.recordResolution(
          random.pick(["tip", "kept"] as const),
          paymentId,
          amount
        )
        if (
          exactAccounting &&
          recorded !== null &&
          before.unresolved - bill.derive().unresolved !== amount
        ) {
          failures.push(
            `resolution not accounted ${before.unresolved} ${bill.derive().unresolved} ${amount}`
          )
        }
      } else if (action < 0.93) {
        const active = bill.activeResolutionIds()
        if (active.length > 0) bill.withdraw(random.pick(active))
      } else {
        const present = [...bill.presentTransactionIds()]
        if (present.length > 0) {
          bill.remove(random.pick(present))
          exactAccounting = false
          unreportedPool = Math.min(unreportedPool, bill.unreportedMoney())
        }
      }

      const overpayment = bill.derive()
      if (overpayment.unresolved > Math.max(0, bill.held())) {
        failures.push(`unresolved above what is held ${overpayment.unresolved}`)
      }
      const resolved = answeredByResolutions(overpayment)
      if (resolved > Math.max(0, heldAboveGoods(bill, overpayment))) {
        failures.push(`resolutions above money held over goods ${resolved}`)
      }
      for (const id of bill.paymentIds()) {
        const onPayment = overpayment.answers
          .filter(
            (answer) =>
              answer.source.type !== "return" && answer.paymentId === id
          )
          .reduce((sum, answer) => sum + answer.answered, 0)
        if (onPayment > Math.max(0, bill.holds(id))) {
          failures.push(`resolutions above what their payment holds ${id}`)
        }
      }
      if (
        overpayment.unresolved > 0 &&
        ![...overpayment.roomByPayment.values()].some((room) => room > 0)
      ) {
        failures.push(`dead end ${overpayment.unresolved}`)
      }
      if (
        exactAccounting &&
        bill.eetHolds() < bill.reportedGoods() - reportedReturned
      ) {
        failures.push(
          `eet below ${bill.eetHolds()} ${bill.reportedGoods()} ${reportedReturned}`
        )
      }
    }
  }
  return failures
}

describe("the overpayment model's randomized checks", () => {
  const seeds = [1, 2, 3, 4, 5]
  const runsPerSeed = 4_000

  test.each(seeds)(
    "out of sync, seed %i: bounded, no draw from an unknown transaction, later money shown, order free, EET floor",
    (seed) => {
      expect(outOfSyncFailures(seed, runsPerSeed)).toEqual([])
    }
  )

  test.each(seeds)(
    "in sync, seed %i: exact accounting, both caps, no dead end, EET floor",
    (seed) => {
      expect(inSyncFailures(seed + 100, runsPerSeed)).toEqual([])
    }
  )
})
