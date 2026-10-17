import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { cancelPayment } from "../payment/payment-actions.ts"
import { refundPayment } from "../refund/refund-actions.ts"
import { NonNegativeInteger, PositiveInteger } from "../shared/schema.ts"
import {
  recordOverpaymentResolution,
  withdrawOverpaymentResolution,
} from "./overpayment-resolution-actions.ts"
import { overpaymentResolutionsQuery } from "./overpayment-resolution-queries.ts"
import {
  createOverpaymentContext,
  type OverpaymentContext,
} from "./overpayment-resolution-test-fixtures.ts"
import type { OverpaymentResolutionId } from "./overpayment-resolution-types.ts"

const record = async (
  context: OverpaymentContext,
  input: Parameters<typeof recordOverpaymentResolution>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run(recordOverpaymentResolution(input))
}

const withdraw = async (
  context: OverpaymentContext,
  resolutionId: OverpaymentResolutionId
) => {
  await using run = testCreateRun(context.deps)
  return await run(
    withdrawOverpaymentResolution({ resolutionId, deviceId: null })
  )
}

describe("Staff resolves an overpayment", () => {
  test("Split resolution", async () => {
    await using context = await createOverpaymentContext()
    const { billId, paymentId } = await context.createOverpaidBill(10_000)
    {
      await using run = testCreateRun(context.deps)
      await run.orThrow(
        refundPayment({
          paymentId,
          method: "outside",
          deviceId: null,
          amount: NonNegativeInteger(6_000),
          purpose: "overpayment",
        })
      )
    }
    const kept = await record(context, {
      paymentId,
      kind: "kept",
      amount: PositiveInteger(4_000),
      deviceId: null,
    })
    if (!kept.ok) throw new Error(kept.error.type)
    const overpayment = await context.deriveOverpayment({ billId })

    expect(overpayment.unresolved).toBe(0)
    expect(overpayment.answers).toMatchObject([
      { source: { type: "return" }, amount: 6_000, answered: 6_000 },
      { source: { type: "kept", id: kept.value }, answered: 4_000 },
    ])
  })

  test("Resolution larger than the overpayment", async () => {
    await using context = await createOverpaymentContext()
    const { billId, paymentId } = await context.createOverpaidBill(10_000)

    await expect(
      record(context, {
        paymentId,
        kind: "tip",
        amount: PositiveInteger(15_000),
        deviceId: null,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "OverpaymentResolutionAboveUnresolved",
        unresolved: 10_000,
      },
    })
    await expect(
      context.evolu.loadQuery(
        overpaymentResolutionsQuery({ billIds: [billId], paymentIds: [] })
      )
    ).resolves.toEqual([])
  })

  test("refuses more than the payment still holds", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Dinner", unitAmount: 10_000, quantity: 1 },
    ])
    const paidTwice = await context.createTestPayment({
      amount: 10_000,
      billId,
    })
    const small = await context.createTestPayment({ amount: 2_000, billId })
    await context.settleByTransfer(small)
    await context.settleInCash(paidTwice, 10_000)
    await context.settleByTransfer(paidTwice)

    await expect(
      record(context, {
        paymentId: small,
        kind: "kept",
        amount: PositiveInteger(5_000),
        deviceId: null,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "OverpaymentResolutionAbovePayment",
        paymentRoom: 2_000,
      },
    })
  })

  test("refuses a canceled payment", async () => {
    await using context = await createOverpaymentContext()
    const { paymentId } = await context.createOverpaidBill(10_000)
    const canceled = await context.createTestPayment({ amount: 1_000 })
    {
      await using run = testCreateRun(context.deps)
      await run.orThrow(cancelPayment(canceled))
    }

    await expect(
      record(context, {
        paymentId: canceled,
        kind: "kept",
        amount: PositiveInteger(1_000),
        deviceId: null,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "PaymentCanceled" },
    })
    await expect(
      record(context, {
        paymentId,
        kind: "kept",
        amount: PositiveInteger(1_000),
        deviceId: null,
      })
    ).resolves.toMatchObject({ ok: true })
  })
})

describe("A mistaken tip or kept amount is withdrawn, never edited", () => {
  test("Tip recorded by mistake", async () => {
    await using context = await createOverpaymentContext()
    const { billId, paymentId } = await context.createOverpaidBill(50_000)
    const tip = await record(context, {
      paymentId,
      kind: "tip",
      amount: PositiveInteger(50_000),
      deviceId: null,
    })
    if (!tip.ok) throw new Error(tip.error.type)

    expect((await context.deriveOverpayment({ billId })).unresolved).toBe(0)

    await expect(withdraw(context, tip.value)).resolves.toMatchObject({
      ok: true,
    })
    const overpayment = await context.deriveOverpayment({ billId })

    expect(overpayment.unresolved).toBe(50_000)
    expect(overpayment.answers).toMatchObject([
      {
        source: { type: "tip", id: tip.value },
        amount: 50_000,
        answered: 0,
        isWithdrawn: true,
      },
    ])
  })

  test("a withdrawal is final", async () => {
    await using context = await createOverpaymentContext()
    const { paymentId } = await context.createOverpaidBill(10_000)
    const kept = await record(context, {
      paymentId,
      kind: "kept",
      amount: PositiveInteger(10_000),
      deviceId: null,
    })
    if (!kept.ok) throw new Error(kept.error.type)
    const withdrawal = await withdraw(context, kept.value)
    if (!withdrawal.ok) throw new Error(withdrawal.error.type)

    await expect(withdraw(context, kept.value)).resolves.toMatchObject({
      ok: false,
      error: { type: "OverpaymentResolutionNotWithdrawable" },
    })
    await expect(withdraw(context, withdrawal.value)).resolves.toMatchObject({
      ok: false,
      error: { type: "OverpaymentResolutionNotWithdrawable" },
    })
  })
})
