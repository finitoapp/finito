import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { recordOverpaymentResolution } from "../overpayment-resolution/overpayment-resolution-actions.ts"
import {
  createOverpaymentContext,
  type OverpaymentContext,
} from "../overpayment-resolution/overpayment-resolution-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { PositiveInteger, TimestampMs } from "../shared/schema.ts"
import { loadOverpaymentInput } from "./bill-overpayment-guards.ts"

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
