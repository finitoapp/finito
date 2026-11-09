import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  addCatalogItemToBill,
  addManualAmountToBill,
  createBill,
} from "../bill/bill-actions.ts"
import { loadBillCoverage, loadBillStatus } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import {
  createPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
} from "../payment/payment-actions.ts"
import { paymentClaimsQuery } from "../payment/payment-queries.ts"
import { createPaymentAccounts } from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import {
  refundPayment,
  refundPaymentTip,
  refundWholePayment,
  tipRefundId,
} from "./refund-actions.ts"
import {
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "./refund-queries.ts"
import { deriveRefundableLines } from "./refund-utils.ts"

const accountTransactionsQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .leftJoin(
        "reconciliationClaim",
        "reconciliationClaim.accountTransactionId",
        "accountTransaction.id"
      )
      .select([
        "accountTransaction.amount",
        "accountTransaction.occurredAt",
        "reconciliationClaim.paymentId",
      ])
      .where("accountTransaction.accountId", "=", accountId)
      .orderBy("accountTransaction.createdAt")
  )

const createRefundContext = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const clock = createTestDateDep()
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
  } satisfies EvoluDep & EvoluOwnerDep & DateDep
  const accounts = await createPaymentAccounts(deps)

  const createTestPayment = async ({
    amount,
    billId = null,
    tipAmount = 0,
  }: {
    readonly amount: number
    readonly billId?: BillId | null
    readonly tipAmount?: number
  }): Promise<PaymentId> => {
    await using run = testCreateRun(deps)
    return await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(amount),
        currency: "CZK",
        tipAmount: NonNegativeInteger(tipAmount),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: accounts.cashRegisterAccountId },
      })
    )
  }

  const settleInCash = async (paymentId: PaymentId, receivedAmount: number) => {
    await using run = testCreateRun(deps)
    await run.orThrow(
      markPaymentPaidCash({
        paymentId,
        accountId: accounts.cashRegisterAccountId,
        receivedAmount: NonNegativeInteger(receivedAmount),
      })
    )
  }

  const settleByTransfer = async (paymentId: PaymentId) => {
    await using run = testCreateRun(deps)
    await run.orThrow(
      markPaymentPaidIban({ paymentId, accountId: accounts.ibanAccountId })
    )
  }

  const createBillOf = async (
    lines: ReadonlyArray<{
      readonly name: string
      readonly unitAmount: number
      readonly quantity: number
    }>
  ): Promise<BillId> => {
    await using run = testCreateRun(deps)
    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    for (const [index, line] of lines.entries()) {
      const catalogItemId = await run.ok(
        createCatalogItem({
          deviceId: null,
          categoryId: null,
          name: NonEmptyString255(line.name),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(line.unitAmount),
          sortOrder: NonNegativeInteger(index),
          scanCode: null,
        })
      )
      await run.orThrow(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId,
          quantity: PositiveNumber(line.quantity),
        })
      )
    }
    return billId
  }

  return {
    evolu,
    deps,
    clock,
    ...accounts,
    createTestPayment,
    settleInCash,
    settleByTransfer,
    createBillOf,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

type RefundContext = Awaited<ReturnType<typeof createRefundContext>>

const refundOf = async (
  context: RefundContext,
  input: Parameters<typeof refundPayment>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run(refundPayment(input))
}

const refundTipOf = async (
  context: RefundContext,
  input: Parameters<typeof refundPaymentTip>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run(refundPaymentTip(input))
}

/**
 * Runs `refundWholePayment` on an Evolu that notes the batch of every write:
 * each `runMutationWithCompletion` hands its writes its own `onComplete`.
 */
const refundWholeOf = async (
  context: RefundContext,
  input: Parameters<typeof refundWholePayment>[0]
) => {
  const batches = new Set<unknown>()
  const { evolu } = context.deps
  const noteBatch =
    <TArgs extends ReadonlyArray<unknown>, TResult>(
      write: (...args: TArgs) => TResult
    ) =>
    (...args: TArgs): TResult => {
      const options = args[2] as { readonly onComplete?: unknown } | undefined
      batches.add(options?.onComplete)
      return write(...args)
    }
  const counted: typeof evolu = Object.assign(Object.create(evolu), {
    upsert: noteBatch(evolu.upsert.bind(evolu)),
    update: noteBatch(evolu.update.bind(evolu)),
    insert: noteBatch(evolu.insert.bind(evolu)),
  })
  await using run = testCreateRun({ ...context.deps, evolu: counted })
  const result = await run(refundWholePayment(input))
  return { result, batches: batches.size }
}

const billWithBeersAndGoulash = [
  { name: "Beer", unitAmount: 5_000, quantity: 2 },
  { name: "Goulash", unitAmount: 15_000, quantity: 1 },
] as const

describe("refundPayment", () => {
  test("returns a rounded cash payment in full from the cash register", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({ amount: 7_890 })
    await context.settleInCash(paymentId, 7_900)
    context.clock.advance(60_000)
    const refundedAt = context.clock.date.now().getTime()

    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(7_900),
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([
      { amount: 7_900, method: "cashRegister", refundedAt },
    ])
    await expect(
      context.evolu.loadQuery(
        accountTransactionsQuery(context.cashRegisterAccountId)
      )
    ).resolves.toMatchObject([
      { amount: 7_890, paymentId },
      { amount: -7_900, occurredAt: refundedAt, paymentId: null },
    ])
    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(100),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "RefundAmountInvalid", amount: 100, remainingAmount: 0 },
    })
  })

  test("returns a payment in parts outside Payky without moving any account", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleByTransfer(paymentId)

    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(5_000),
      })
    ).resolves.toMatchObject({ ok: true })
    context.clock.advance(60_000)
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(20_001),
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid", remainingAmount: 20_000 },
    })
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(20_000),
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([
      { amount: 5_000, method: "outside" },
      { amount: 20_000, method: "outside" },
    ])
    await expect(
      context.evolu.loadQuery(
        accountTransactionsQuery(context.cashRegisterAccountId)
      )
    ).resolves.toEqual([])
  })

  test("refuses nothing and more than the payment", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleByTransfer(paymentId)

    for (const amount of [0, 30_000]) {
      await expect(
        refundOf(context, {
          paymentId,
          method: "outside",
          deviceId: null,
          amount: NonNegativeInteger(amount),
        })
      ).resolves.toMatchObject({
        ok: false,
        error: { type: "RefundAmountInvalid", remainingAmount: 25_000 },
      })
    }
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toEqual([])
  })

  test("returns the excess of a payment settled twice as well", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleInCash(paymentId, 25_000)
    await context.settleByTransfer(paymentId)

    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(50_001),
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid", remainingAmount: 50_000 },
    })
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(50_000),
      })
    ).resolves.toMatchObject({ ok: true })
  })

  test("refuses a payment that is not paid", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })

    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(1_000),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "RefundPaymentNotPaid", paymentId, status: "pending" },
    })
  })

  test("returns one of two beers and offers the rest", async () => {
    await using context = await createRefundContext()
    const billId = await context.createBillOf(billWithBeersAndGoulash)
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      billId,
    })
    await context.settleInCash(paymentId, 25_000)
    const lines = await context.evolu.loadQuery(
      refundablePaymentLinesQuery(paymentId)
    )
    const beer = lines.find(({ name }) => name === "Beer")
    if (beer === undefined) throw new Error("Expected the beer line.")

    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        lines: [{ paymentLineId: beer.id, quantity: PositiveNumber(1) }],
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([{ amount: 5_000 }])
    const refundLines = await context.evolu.loadQuery(
      refundLinesByPaymentIdQuery(paymentId)
    )
    expect(refundLines).toMatchObject([
      { name: "Beer", quantity: 1, amount: 5_000 },
    ])
    expect(
      deriveRefundableLines(lines, refundLines).map(
        ({ line, remainingQuantity }) => [line.name, remainingQuantity]
      )
    ).toEqual([
      ["Beer", 1],
      ["Goulash", 1],
    ])
    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        lines: [{ paymentLineId: beer.id, quantity: PositiveNumber(2) }],
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "RefundLineUnavailable", paymentLineId: beer.id },
    })
  })

  test("offers only an amount for a bill paid by two payments", async () => {
    await using context = await createRefundContext()
    const billId = await context.createBillOf([
      { name: "Pizza", unitAmount: 10_000, quantity: 2 },
    ])
    const first = await context.createTestPayment({ amount: 10_000, billId })
    await context.settleInCash(first, 10_000)
    const second = await context.createTestPayment({ amount: 10_000, billId })
    await context.settleInCash(second, 10_000)
    const [pizza] = await context.evolu.loadQuery(
      refundablePaymentLinesQuery(second)
    )
    if (pizza === undefined) throw new Error("Expected the pizza line.")

    await expect(
      refundOf(context, {
        paymentId: second,
        method: "cashRegister",
        deviceId: null,
        lines: [{ paymentLineId: pizza.id, quantity: PositiveNumber(1) }],
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "RefundItemsUnavailable", paymentId: second },
    })
    await expect(
      refundOf(context, {
        paymentId: second,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(10_000),
      })
    ).resolves.toMatchObject({ ok: true })
  })

  test("keeps a fully refunded payment paid and its bill closed and covered", async () => {
    await using context = await createRefundContext()
    await using run = testCreateRun(context.deps)
    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(25_000),
      })
    )
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      billId,
    })
    await context.settleInCash(paymentId, 25_000)

    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(25_000),
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      context.evolu.loadQuery(paymentClaimsQuery(paymentId))
    ).resolves.toHaveLength(1)
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      coverage: "paid",
    })
  })
})

describe("refunds of a payment with a tip", () => {
  test("split cash into the goods in whole crowns and the tip", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 5_828,
      tipAmount: 278,
    })
    await context.settleInCash(paymentId, 5_800)

    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(5_700),
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid", remainingAmount: 5_600 },
    })
    await expect(
      refundTipOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
      })
    ).resolves.toMatchObject({ ok: true })
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([{ amount: 200, isTip: sqliteTrue }])
  })

  test("leave the tip out of a refund by amount", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleByTransfer(paymentId)

    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(24_000),
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        type: "RefundAmountInvalid",
        amount: 24_000,
        remainingAmount: 23_000,
      },
    })
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(23_000),
      })
    ).resolves.toMatchObject({ ok: true })
  })

  test("leave the tip out of the cash received", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleInCash(paymentId, 26_000)

    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(23_100),
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid", remainingAmount: 23_000 },
    })
    await expect(
      refundOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(23_000),
      })
    ).resolves.toMatchObject({ ok: true })
  })

  test("return the whole tip once, in cash from the cash register", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleInCash(paymentId, 25_000)
    context.clock.advance(60_000)
    const refundedAt = context.clock.date.now().getTime()

    await expect(
      refundTipOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
      })
    ).resolves.toMatchObject({ ok: true })
    await expect(
      refundTipOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toEqual({
      ok: false,
      error: { type: "RefundTipUnavailable", paymentId },
    })

    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([
      { amount: 2_000, method: "cashRegister", refundedAt, isTip: sqliteTrue },
    ])
    await expect(
      context.evolu.loadQuery(
        accountTransactionsQuery(context.cashRegisterAccountId)
      )
    ).resolves.toMatchObject([
      { amount: 25_000, paymentId },
      { amount: -2_000, occurredAt: refundedAt, paymentId: null },
    ])
  })

  test("return the tip after all the goods", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleByTransfer(paymentId)
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(23_000),
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      refundTipOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({ ok: true })
  })

  test("refuse a tip refund without a tip or before the payment is paid", async () => {
    await using context = await createRefundContext()
    const withoutTip = await context.createTestPayment({ amount: 25_000 })
    await context.settleByTransfer(withoutTip)
    const unpaid = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })

    await expect(
      refundTipOf(context, {
        paymentId: withoutTip,
        method: "outside",
        deviceId: null,
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "RefundTipUnavailable", paymentId: withoutTip },
    })
    await expect(
      refundTipOf(context, {
        paymentId: unpaid,
        method: "outside",
        deviceId: null,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundPaymentNotPaid", paymentId: unpaid },
    })
  })
})

describe("refundWholePayment", () => {
  test("records the goods and the tip as two refunds in one batch", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleInCash(paymentId, 25_000)
    context.clock.advance(60_000)
    const refundedAt = context.clock.date.now().getTime()

    const { result, batches } = await refundWholeOf(context, {
      paymentId,
      method: "cashRegister",
      deviceId: null,
    })
    expect(result).toMatchObject({
      ok: true,
      value: { tipRefundId: tipRefundId(paymentId) },
    })
    expect(batches).toBe(1)

    const refunds = await context.evolu.loadQuery(
      refundsByPaymentIdQuery(paymentId)
    )
    expect(refunds).toHaveLength(2)
    // Exact goods and tip, as the two separate refunds would record them.
    expect(refunds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 23_000,
          method: "cashRegister",
          refundedAt,
          isTip: null,
        }),
        expect.objectContaining({
          id: tipRefundId(paymentId),
          amount: 2_000,
          method: "cashRegister",
          refundedAt,
          isTip: sqliteTrue,
        }),
      ])
    )
    const transactions = await context.evolu.loadQuery(
      accountTransactionsQuery(context.cashRegisterAccountId)
    )
    expect(transactions.map(({ amount }) => amount)).toEqual(
      expect.arrayContaining([25_000, -23_000, -2_000])
    )
    expect(transactions).toHaveLength(3)
  })

  test("a second run records nothing twice", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleByTransfer(paymentId)

    await expect(
      refundWholeOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({ result: { ok: true } })
    await expect(
      refundWholeOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({
      result: {
        ok: false,
        error: { type: "RefundAmountInvalid", amount: 0, remainingAmount: 0 },
      },
      batches: 0,
    })
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toHaveLength(2)
  })

  test("writes only the goods of a payment without a tip", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({ amount: 7_890 })
    await context.settleInCash(paymentId, 7_900)

    await expect(
      refundWholeOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
      })
    ).resolves.toMatchObject({
      result: { ok: true, value: { tipRefundId: null } },
      batches: 1,
    })
    // What the cash received for goods, rounding included (refund/0003).
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([{ amount: 7_900, isTip: null }])
  })

  test("writes only the tip once the goods are all back", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleByTransfer(paymentId)
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(23_000),
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      refundWholeOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({
      result: {
        ok: true,
        value: { goodsRefundId: null, tipRefundId: tipRefundId(paymentId) },
      },
      batches: 1,
    })
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([
      { amount: 23_000, isTip: null },
      { id: tipRefundId(paymentId), amount: 2_000, isTip: sqliteTrue },
    ])
  })

  test("writes only the goods left once the tip is back", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleByTransfer(paymentId)
    await expect(
      refundTipOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({ ok: true })
    await expect(
      refundOf(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(3_000),
      })
    ).resolves.toMatchObject({ ok: true })

    await expect(
      refundWholeOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({
      result: { ok: true, value: { tipRefundId: null } },
    })
    const refunds = await context.evolu.loadQuery(
      refundsByPaymentIdQuery(paymentId)
    )
    expect(refunds).toHaveLength(3)
    expect(refunds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 20_000, isTip: null }),
      ])
    )
  })

  test("refuses a payment that is not paid", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })

    await expect(
      refundWholeOf(context, { paymentId, method: "outside", deviceId: null })
    ).resolves.toMatchObject({
      result: { ok: false, error: { type: "RefundPaymentNotPaid" } },
      batches: 0,
    })
  })
})
