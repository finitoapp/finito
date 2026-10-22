import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import { recordOverpaymentResolution } from "../overpayment-resolution/overpayment-resolution-actions.ts"
import {
  createOverpaymentContext,
  type OverpaymentContext,
} from "../overpayment-resolution/overpayment-resolution-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { PositiveInteger, TimestampMs } from "../shared/schema.ts"
import { formatSelfPayBankMessage } from "../table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  publishSelfPayTestSelection,
  publishSelfPayTestView,
  receiveBankTransfer,
} from "../table-self-pay/table-self-pay-test-fixtures.ts"
import {
  loadBillEditOutcome,
  loadOverpaymentInput,
} from "./bill-overpayment-guards.ts"
import type { BillId } from "./bill-types.ts"

const acknowledgeAsAnOlderVersion = async (
  context: OverpaymentContext,
  paymentId: PaymentId,
  clockBehindMs: number
) => {
  await runMutationWithCompletion((options) =>
    context.evolu.update(
      "payment",
      {
        id: paymentId,
        excessAcknowledgedAt: TimestampMs(Date.now() - clockBehindMs),
      },
      { ...options, owner: context.evolu.appOwner }
    )
  )
}

const linesMoving = async (
  context: OverpaymentContext,
  billId: BillId,
  names: ReadonlyArray<string>,
  targetBillId: BillId | null = null
) => {
  await using run = testCreateRun(context.deps)
  const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
  return summaries
    .filter((summary) => names.includes(summary.name))
    .flatMap((summary) => {
      const line = {
        deviceId: null,
        catalogItemId: summary.catalogItemId,
        itemId: summary.itemId,
        type: summary.type,
        quantity: summary.quantity,
        totalAmount: summary.totalAmount,
      }
      return [
        { ...line, billId, kind: "remove" as const },
        ...(targetBillId === null
          ? []
          : [{ ...line, billId: targetBillId, kind: "add" as const }]),
      ]
    })
}

describe("Ask before the edit", () => {
  test("Removing every line after a guest paid", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Soup", unitAmount: 250, quantity: 2 },
    ])
    const paymentId = await context.createTestPayment({ amount: 250, billId })
    await context.settleWithTransfer(paymentId, 250)
    await using run = testCreateRun(context.deps)

    expect(
      await run.orThrow(
        loadBillEditOutcome(
          billId,
          await linesMoving(context, billId, ["Soup"])
        )
      )
    ).toEqual({ type: "overpaid", unresolved: 250 })
  })

  test("Removal that leaves the bill paid exactly", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Dinner", unitAmount: 5_000, quantity: 1 },
      { name: "Wine", unitAmount: 5_000, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({ amount: 5_000, billId })
    await context.settleInCash(paymentId, 5_000)
    await using run = testCreateRun(context.deps)

    expect(
      await run.orThrow(
        loadBillEditOutcome(
          billId,
          await linesMoving(context, billId, ["Wine"])
        )
      )
    ).toEqual({ type: "paid" })
  })

  test("Split that leaves the bill paid exactly", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Dinner", unitAmount: 5_000, quantity: 1 },
      { name: "Wine", unitAmount: 5_000, quantity: 1 },
    ])
    const targetBillId = await context.createBillOf([])
    const paymentId = await context.createTestPayment({ amount: 5_000, billId })
    await context.settleInCash(paymentId, 5_000)
    await using run = testCreateRun(context.deps)

    expect(
      await run.orThrow(
        loadBillEditOutcome(
          billId,
          await linesMoving(context, billId, ["Wine"], targetBillId)
        )
      )
    ).toEqual({ type: "paid" })
  })

  test("an edit that leaves the bill underpaid, or a bill nobody paid, asks nothing", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Dinner", unitAmount: 5_000, quantity: 1 },
      { name: "Wine", unitAmount: 5_000, quantity: 1 },
    ])
    const unpaidBillId = await context.createBillOf([
      { name: "Soup", unitAmount: 250, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({ amount: 2_000, billId })
    await context.settleInCash(paymentId, 2_000)
    await using run = testCreateRun(context.deps)

    expect(
      await run.orThrow(
        loadBillEditOutcome(
          billId,
          await linesMoving(context, billId, ["Wine"])
        )
      )
    ).toEqual({ type: "staysOpen" })
    expect(
      await run.orThrow(
        loadBillEditOutcome(
          unpaidBillId,
          await linesMoving(context, unpaidBillId, ["Soup"])
        )
      )
    ).toEqual({ type: "staysOpen" })
  })
})

describe("loadOverpaymentInput", () => {
  test("times claims and resolutions by the sync clock of their first write", async () => {
    await using context = await createOverpaymentContext()
    const { billId, paymentId } = await context.createOverpaidBill(10_000)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      recordOverpaymentResolution({
        paymentId,
        kind: "kept",
        amount: PositiveInteger(10_000),
        deviceId: null,
      })
    )

    const input = await run.orThrow(loadOverpaymentInput({ billId }))
    const claims = input.transactions.map(({ claimClock }) => claimClock)
    const kept = input.resolutions[0]?.recordClock ?? ""

    expect(input.billTotal).toBe(10_000)
    expect(claims).toHaveLength(2)
    expect(claims.every((clock) => /^[0-9A-F]{32}$/u.test(clock))).toBe(true)
    expect(new Set(claims).size).toBe(2)
    expect(claims.every((clock) => clock < kept)).toBe(true)
  })

  test("times an acknowledgement by the first write of its column", async () => {
    await using context = await createOverpaymentContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleInCash(paymentId, 25_000)
    await context.settleByTransfer(paymentId)
    await using run = testCreateRun(context.deps)
    await acknowledgeAsAnOlderVersion(context, paymentId, 0)

    const input = await run.orThrow(loadOverpaymentInput({ paymentId }))
    const acknowledged = input.payments[0]?.acknowledgementClock ?? ""

    expect(input.billTotal).toBe(25_000)
    expect(
      input.transactions.every(({ claimClock }) => claimClock < acknowledged)
    ).toBe(true)
  })
})

describe("Acknowledged extra money counts as kept", () => {
  const clocksBehind = [0, 10 * 60_000]

  test("Acknowledged before the change", async () => {
    for (const clockBehindMs of clocksBehind) {
      await using context = await createOverpaymentContext()
      const paymentId = await context.createTestPayment({ amount: 25_000 })
      await context.settleInCash(paymentId, 25_000)
      await context.settleByTransfer(paymentId)

      await acknowledgeAsAnOlderVersion(context, paymentId, clockBehindMs)

      expect((await context.deriveOverpayment({ paymentId })).unresolved).toBe(
        0
      )
    }
  })

  test("Money after the acknowledgement", async () => {
    for (const clockBehindMs of clocksBehind) {
      await using context = await createOverpaymentContext()
      const billId = await context.createBillOf([
        { name: "Dinner", unitAmount: 50_000, quantity: 1 },
      ])
      const acknowledged = await context.createTestPayment({
        amount: 25_000,
        billId,
      })
      const later = await context.createTestPayment({ amount: 25_000, billId })
      await context.settleInCash(acknowledged, 25_000)
      await context.settleByTransfer(acknowledged)

      await acknowledgeAsAnOlderVersion(context, acknowledged, clockBehindMs)
      await context.settleByTransfer(later)

      expect((await context.deriveOverpayment({ billId })).unresolved).toBe(
        25_000
      )
    }
  })
})

describe("an edit that removes what guests paid for", () => {
  const guestPaidBeer = async () => {
    const context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [
        { name: "Pizza", amount: 10_100 },
        { name: "Beer", amount: 4500 },
      ],
    })
    const { view } = await publishSelfPayTestView(context)
    const bill = view.bills.find((shown) => shown.reference === reference)
    const beer = bill?.lines.find(({ name }) => name === "Beer")
    if (bill === undefined || beer === undefined) {
      throw new Error("Expected the beer in the view.")
    }
    const pointer = await publishSelfPayTestSelection(context, bill, {
      kind: "lines",
      fractions: [{ key: beer.key, numerator: 1, denominator: 1 }],
    })
    await receiveBankTransfer(context, {
      amount: 4500,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })
    return { context, billId }
  }

  const removing = async (
    context: Awaited<ReturnType<typeof guestPaidBeer>>["context"],
    billId: BillId,
    name: string
  ) => {
    await using run = testCreateRun(context.deps)
    const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
    return summaries
      .filter((summary) => summary.name === name)
      .map((summary) => ({
        billId,
        deviceId: null,
        catalogItemId: summary.catalogItemId,
        itemId: summary.itemId,
        type: summary.type,
        kind: "remove" as const,
        quantity: summary.quantity,
        totalAmount: summary.totalAmount,
      }))
  }

  test("names the line and what guests paid for it", async () => {
    const { context, billId } = await guestPaidBeer()
    await using _context = context
    await using run = testCreateRun(context.deps)

    expect(
      await run.orThrow(
        loadBillEditOutcome(billId, await removing(context, billId, "Beer"))
      )
    ).toEqual({
      type: "removesGuestPaid",
      lineNames: ["Beer"],
      guestPaid: 4500,
      after: { type: "staysOpen" },
    })
  })

  test("asks nothing about a line nobody paid for", async () => {
    const { context, billId } = await guestPaidBeer()
    await using _context = context
    await using run = testCreateRun(context.deps)

    expect(
      await run.orThrow(
        loadBillEditOutcome(billId, await removing(context, billId, "Pizza"))
      )
    ).toEqual({ type: "paid" })
  })
})
