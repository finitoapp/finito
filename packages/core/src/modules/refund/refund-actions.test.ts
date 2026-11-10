import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { z } from "zod"
import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createSeededRandom } from "../../testing/seeded-random.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import { AccountTransactionIdsJson } from "../account-transaction/account-transaction-utils.ts"
import {
  addCatalogItemToBill,
  addManualAmountToBill,
  createBill,
} from "../bill/bill-actions.ts"
import { loadBillCoverage, loadBillStatus } from "../bill/bill-guards.ts"
import { loadOverpaymentInput } from "../bill/bill-overpayment-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import {
  deriveBillOverpayment,
  deriveReturnableOverpayment,
} from "../bill/bill-utils.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import {
  configureEet,
  createEetTestContext,
  createTestPayment as createEetTestPayment,
  type EetTestContext,
  reportSaleOf,
  settleByTransfer as settleEetPaymentByTransfer,
  settleInCash as settleEetPaymentInCash,
} from "../eet/eet-test-fixtures.ts"
import { recordOverpaymentResolution } from "../overpayment-resolution/overpayment-resolution-actions.ts"
import {
  createOverpaymentContext,
  type OverpaymentContext,
} from "../overpayment-resolution/overpayment-resolution-test-fixtures.ts"
import {
  cancelPayment,
  createPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
} from "../payment/payment-actions.ts"
import {
  paymentClaimsQuery,
  paymentDetailQuery,
} from "../payment/payment-queries.ts"
import { createPaymentAccounts } from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { activeClaimedTransactionsByPaymentIdQuery } from "../reconciliation-claim/reconciliation-claim-queries.ts"
import { refundsQuery } from "../sales-stats/sales-stats-queries.ts"
import { statsPeriodRanges } from "../sales-stats/sales-stats-utils.ts"
import { calculatePaymentExcess } from "../shared/claimed-amount.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { createRowId } from "../shared/evolu-utils.ts"
import {
  type FiatCurrency,
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
  overpaymentRefundsQuery,
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundSummariesByBillIdQuery,
  refundsByPaymentIdQuery,
} from "./refund-queries.ts"
import type { RefundMethod } from "./refund-types.ts"
import {
  deriveCashRefundHandedAmounts,
  deriveRefundableAmount,
  deriveRefundableLines,
  deriveRefundPrefillAmount,
  sumGoodsRefundAmounts,
  summarizeRefundsByPayment,
  sumReturnedOverpayment,
} from "./refund-utils.ts"

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

/** The cash each refund of a payment handed out of the register (refund/0012). */
const cashHandedQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("refundCashRegister")
      .innerJoin("refund", "refund.id", "refundCashRegister.id")
      .select([
        "refund.amount",
        "refund.isTip",
        "refundCashRegister.accountId",
        "refundCashRegister.handedAmount",
      ])
      .where("refund.paymentId", "=", paymentId)
      .orderBy("refund.isTip")
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
    currency = "CZK",
  }: {
    readonly amount: number
    readonly billId?: BillId | null
    readonly tipAmount?: number
    readonly currency?: FiatCurrency
  }): Promise<PaymentId> => {
    await using run = testCreateRun(deps)
    return await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(amount),
        currency,
        tipAmount: NonNegativeInteger(tipAmount),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: accounts.cashRegisterAccountId },
      })
    )
  }

  const settleInCash = async (
    paymentId: PaymentId,
    receivedAmount: number,
    accountId: AccountId = accounts.cashRegisterAccountId
  ) => {
    await using run = testCreateRun(deps)
    await run.orThrow(
      markPaymentPaidCash({
        paymentId,
        accountId,
        receivedAmount: NonNegativeInteger(receivedAmount),
      })
    )
  }

  const createCashRegister = async (currency: FiatCurrency) => {
    await using run = testCreateRun(deps)
    return await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255(`Cash register ${currency}`),
        cashRegister: { currency },
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
    createCashRegister,
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

  test.each([
    { currency: "CZK", amount: 1_250, handed: 1_300 },
    { currency: "CZK", amount: 1_249, handed: 1_200 },
    { currency: "EUR", amount: 1_249, handed: 1_249 },
  ] as const)(
    "hands out $handed for a part of $amount $currency from the cash register",
    async ({ currency, amount, handed }) => {
      await using context = await createRefundContext()
      const accountId =
        currency === "CZK"
          ? context.cashRegisterAccountId
          : await context.createCashRegister(currency)
      const paymentId = await context.createTestPayment({
        amount: 6_300,
        currency,
      })
      await context.settleInCash(paymentId, 6_300, accountId)

      await expect(
        refundOf(context, {
          paymentId,
          method: "cashRegister",
          deviceId: null,
          amount: NonNegativeInteger(amount),
        })
      ).resolves.toMatchObject({ ok: true })

      await expect(
        context.evolu.loadQuery(cashHandedQuery(paymentId))
      ).resolves.toEqual([
        { amount, isTip: null, accountId, handedAmount: handed },
      ])
      await expect(
        context.evolu.loadQuery(accountTransactionsQuery(accountId))
      ).resolves.toMatchObject([{ amount: 6_300 }, { amount: -handed }])
    }
  )

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

  test("hand out a tip refund from the cash register in whole crowns", async () => {
    await using context = await createRefundContext()
    const paymentId = await context.createTestPayment({
      amount: 6_370,
      tipAmount: 580,
    })
    await context.settleByTransfer(paymentId)

    await expect(
      refundTipOf(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
      })
    ).resolves.toMatchObject({ ok: true })

    // The tip refund records the exact tip and hands out whole crowns.
    await expect(
      context.evolu.loadQuery(cashHandedQuery(paymentId))
    ).resolves.toEqual([
      {
        amount: 580,
        isTip: sqliteTrue,
        accountId: context.cashRegisterAccountId,
        handedAmount: 600,
      },
    ])
    await expect(
      context.evolu.loadQuery(
        accountTransactionsQuery(context.cashRegisterAccountId)
      )
    ).resolves.toMatchObject([{ amount: -600 }])
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

  test.each([
    { currency: "CZK", goods: 5_820, tip: 580 },
    { currency: "EUR", goods: 5_790, tip: 580 },
  ] as const)(
    "hands a whole $currency payment out of the cash register, the sum rounded once",
    async ({ currency, goods, tip }) => {
      await using context = await createRefundContext()
      const accountId =
        currency === "CZK"
          ? context.cashRegisterAccountId
          : await context.createCashRegister(currency)
      const paymentId = await context.createTestPayment({
        amount: 6_370,
        tipAmount: 580,
        currency,
      })
      // EUR has no bank account here; its cash is exact, so it works the same.
      if (currency === "CZK") await context.settleByTransfer(paymentId)
      else await context.settleInCash(paymentId, 6_370, accountId)

      await expect(
        refundWholeOf(context, {
          paymentId,
          method: "cashRegister",
          deviceId: null,
        })
      ).resolves.toMatchObject({ result: { ok: true }, batches: 1 })

      // The records keep the exact goods and tip, so the whole payment is
      // refunded; the customer is handed the sum rounded once.
      await expect(
        context.evolu.loadQuery(cashHandedQuery(paymentId))
      ).resolves.toEqual([
        { amount: 5_790, isTip: null, accountId, handedAmount: goods },
        { amount: 580, isTip: sqliteTrue, accountId, handedAmount: tip },
      ])
      const refundTransactions = (
        await context.evolu.loadQuery(accountTransactionsQuery(accountId))
      ).filter(({ amount }) => amount !== null && amount < 0)
      expect(refundTransactions.map(({ amount }) => amount)).toEqual(
        expect.arrayContaining([-goods, -tip])
      )
      expect(refundTransactions).toHaveLength(2)
    }
  )

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
const refundOfferOf = async (
  context: OverpaymentContext,
  paymentId: PaymentId,
  method: RefundMethod
) => {
  await using run = testCreateRun(context.deps)
  const [payment] = await context.evolu.loadQuery(paymentDetailQuery(paymentId))
  if (payment === undefined) throw new Error("No payment")
  const refunds = await context.evolu.loadQuery(
    refundsByPaymentIdQuery(paymentId)
  )
  const excess = calculatePaymentExcess({
    claims: await context.evolu.loadQuery(
      activeClaimedTransactionsByPaymentIdQuery(paymentId)
    ),
    amount: payment.amount,
  })
  const remainingAmount = NonNegativeInteger(
    Math.max(
      0,
      deriveRefundableAmount({ ...payment, excess }) -
        sumGoodsRefundAmounts(refunds)
    )
  )
  const input = await run.orThrow(
    loadOverpaymentInput(
      payment.billId === null ? { paymentId } : { billId: payment.billId }
    )
  )
  const returnableOverpayment = deriveReturnableOverpayment(input, paymentId)
  return {
    remainingAmount,
    amount: deriveRefundPrefillAmount({
      remainingAmount,
      returnableOverpayment,
      method,
      currency: payment.currency,
    }),
    purpose: returnableOverpayment > 0 ? "overpayment" : "goods",
    unresolvedOverpayment: deriveBillOverpayment(input).unresolved,
  }
}

const refundIn = async (
  context: OverpaymentContext,
  input: Parameters<typeof refundPayment>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run(refundPayment(input))
}

describe("Staff can refund a paid payment", () => {
  test("Full refund of a rounded cash payment", async () => {
    await using context = await createOverpaymentContext()
    const paymentId = await context.createTestPayment({ amount: 7_890 })
    await context.settleInCash(paymentId, 7_900)
    const offer = await refundOfferOf(context, paymentId, "cashRegister")

    expect(offer.amount).toBe(7_900)
    await expect(
      refundIn(context, {
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: offer.amount,
      })
    ).resolves.toMatchObject({ ok: true })
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([{ amount: 7_900, method: "cashRegister" }])
    expect(
      (await refundOfferOf(context, paymentId, "cashRegister")).remainingAmount
    ).toBe(0)
  })

  test("Partial refunds", async () => {
    await using context = await createOverpaymentContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleByTransfer(paymentId)
    await refundIn(context, {
      paymentId,
      method: "outside",
      deviceId: null,
      amount: NonNegativeInteger(5_000),
    })

    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([{ amount: 5_000, method: "outside" }])
    expect((await refundOfferOf(context, paymentId, "outside")).amount).toBe(
      20_000
    )
  })

  test("Amount above what remains", async () => {
    await using context = await createOverpaymentContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleByTransfer(paymentId)

    await expect(
      refundIn(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(30_000),
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid" },
    })
    await expect(
      context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
    ).resolves.toEqual([])
  })

  test("Payment not paid", async () => {
    await using context = await createOverpaymentContext()
    const pending = await context.createTestPayment({ amount: 25_000 })
    const canceled = await context.createTestPayment({ amount: 25_000 })
    {
      await using run = testCreateRun(context.deps)
      await run.orThrow(cancelPayment(canceled))
    }

    for (const paymentId of [pending, canceled]) {
      await expect(
        refundIn(context, {
          paymentId,
          method: "outside",
          deviceId: null,
          amount: NonNegativeInteger(1_000),
        })
      ).resolves.toMatchObject({
        ok: false,
        error: { type: "RefundPaymentNotPaid" },
      })
    }
  })

  test("Payment settled twice", async () => {
    await using context = await createOverpaymentContext()
    const paymentId = await context.createTestPayment({ amount: 25_000 })
    await context.settleInCash(paymentId, 25_000)
    await context.settleByTransfer(paymentId)

    expect((await refundOfferOf(context, paymentId, "outside")).amount).toBe(
      25_000
    )
    await expect(
      refundIn(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(50_001),
      })
    ).resolves.toMatchObject({ ok: false })
    await expect(
      refundIn(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(50_000),
      })
    ).resolves.toMatchObject({ ok: true })
  })

  test("Payment with a tip", async () => {
    await using context = await createOverpaymentContext()
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      tipAmount: 2_000,
    })
    await context.settleByTransfer(paymentId)

    expect((await refundOfferOf(context, paymentId, "outside")).amount).toBe(
      23_000
    )
    await expect(
      refundIn(context, {
        paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(24_000),
      })
    ).resolves.toMatchObject({ ok: false })
  })

  test("Payment of a bill lowered after it was paid", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Steak", unitAmount: 8_000, quantity: 1 },
      { name: "Fries", unitAmount: 2_000, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({
      amount: 10_000,
      billId,
    })
    await context.settleByTransfer(paymentId)
    await context.removeLineOnAnotherDevice(billId, "Fries")

    await expect(
      refundOfferOf(context, paymentId, "outside")
    ).resolves.toMatchObject({
      amount: 2_000,
      purpose: "overpayment",
      unresolvedOverpayment: 2_000,
    })
  })

  test("Extra money on a bill still underpaid", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Dinner", unitAmount: 20_000, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({
      amount: 10_000,
      billId,
    })
    await context.createTestPayment({ amount: 10_000, billId })
    await context.settleWithTransfer(paymentId, 15_000)

    await expect(
      refundOfferOf(context, paymentId, "outside")
    ).resolves.toMatchObject({
      amount: 5_000,
      purpose: "overpayment",
      unresolvedOverpayment: 0,
    })
  })

  test("Refund with nothing above the goods", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Dinner", unitAmount: 25_000, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({
      amount: 25_000,
      billId,
    })
    await context.settleByTransfer(paymentId)
    const offer = await refundOfferOf(context, paymentId, "outside")

    expect(offer).toMatchObject({ amount: 25_000, purpose: "goods" })
    await refundIn(context, {
      paymentId,
      method: "outside",
      deviceId: null,
      amount: offer.amount,
    })
    await expect(
      context.evolu.loadQuery(
        overpaymentRefundsQuery({ billIds: [billId], paymentIds: [] })
      )
    ).resolves.toMatchObject([{ purpose: "goods", overpaymentAmount: 0 }])
  })
})

describe("a refund records what it returns of the overpayment", () => {
  test("records the return, its overpayment part and the transactions it knew", async () => {
    await using context = await createOverpaymentContext()
    const { billId, paymentId } = await context.createOverpaidBill(10_000)

    await refundIn(context, {
      paymentId,
      method: "outside",
      deviceId: null,
      amount: NonNegativeInteger(10_000),
      purpose: "overpayment",
    })
    const [refund] = await context.evolu.loadQuery(
      overpaymentRefundsQuery({ billIds: [billId], paymentIds: [] })
    )
    const claimed = await context.evolu.loadQuery(
      activeClaimedTransactionsByPaymentIdQuery(paymentId)
    )

    expect(refund).toMatchObject({
      purpose: "overpayment",
      overpaymentAmount: 10_000,
    })
    expect(
      z.decode(AccountTransactionIdsJson, refund?.knownTransactionIdsJson ?? "")
    ).toEqual(
      expect.arrayContaining(
        claimed.map(({ accountTransactionId }) => accountTransactionId)
      )
    )
    expect((await context.deriveOverpayment({ billId })).unresolved).toBe(0)
  })

  test("returns the value of refunded lines the bill no longer holds", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Beer", unitAmount: 5_000, quantity: 1 },
      { name: "Goulash", unitAmount: 5_000, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({
      amount: 10_000,
      billId,
    })
    await context.settleByTransfer(paymentId)
    await context.removeLineOnAnotherDevice(billId, "Goulash")
    const lines = await context.evolu.loadQuery(
      refundablePaymentLinesQuery(paymentId)
    )
    const goulash = lines.find(({ name }) => name === "Goulash")
    if (goulash === undefined) throw new Error("No goulash")

    await refundIn(context, {
      paymentId,
      method: "outside",
      deviceId: null,
      lines: [{ paymentLineId: goulash.id, quantity: PositiveNumber(1) }],
    })

    expect((await context.deriveOverpayment({ billId })).unresolved).toBe(0)
  })

  test("reads a refund by items of a coffee the bill no longer holds as a returned overpayment", async () => {
    await using context = await createOverpaymentContext()
    const billId = await context.createBillOf([
      { name: "Coffee", unitAmount: 500, quantity: 1 },
    ])
    const paymentId = await context.createTestPayment({ amount: 500, billId })
    await context.settleInCash(paymentId, 500)
    await context.removeLineOnAnotherDevice(billId, "Coffee")
    const [coffee] = await context.evolu.loadQuery(
      refundablePaymentLinesQuery(paymentId)
    )
    if (coffee === undefined) throw new Error("No coffee")

    await refundIn(context, {
      paymentId,
      method: "outside",
      deviceId: null,
      lines: [{ paymentLineId: coffee.id, quantity: PositiveNumber(1) }],
    })

    await expect(
      context.evolu.loadQuery(
        overpaymentRefundsQuery({ billIds: [billId], paymentIds: [] })
      )
    ).resolves.toMatchObject([{ purpose: "goods", overpaymentAmount: 500 }])
    expect(
      sumReturnedOverpayment(
        await context.evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
      )
    ).toBe(500)
    expect(
      summarizeRefundsByPayment(
        await context.evolu.loadQuery(refundSummariesByBillIdQuery(billId))
      ).get(paymentId)
    ).toMatchObject({ refundedAmount: 500, returnedOverpaymentAmount: 500 })
  })
})

const refundRowsQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("refund")
      .select([
        "id",
        "deviceId",
        "amount",
        "method",
        "refundedAt",
        "mainRefundId",
      ])
      .where("paymentId", "=", paymentId)
      .orderBy("mainRefundId")
  )

const billOfTotal = async (context: EetTestContext, total: number) => {
  await using run = testCreateRun(context.deps)
  const billId = await run.ok(
    createBill({
      deviceId: context.deviceId,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId: null,
      currency: "CZK",
    })
  )
  await run.orThrow(
    addManualAmountToBill({
      billId,
      deviceId: context.deviceId,
      totalAmount: NonNegativeInteger(total),
      name: NonEmptyString255("Dinner"),
      currency: "CZK",
    })
  )
  return billId
}

const reportedBillWithUnreportedDuplicate = async (context: EetTestContext) => {
  await configureEet(context)
  const billId = await billOfTotal(context, 25_000)
  const first = await createEetTestPayment(context, { billId })
  const duplicate = await createEetTestPayment(context, {
    billId,
    amount: 5_000,
  })
  await settleEetPaymentInCash(context, first)
  await reportSaleOf(context, { paymentId: first, billId, amount: 25_000 })
  await settleEetPaymentInCash(context, duplicate)
  return { billId, first, duplicate }
}

const refundWithEet = async (
  context: EetTestContext,
  input: Parameters<typeof refundPayment>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run.orThrow(refundPayment(input))
}

describe("EET follows only the money", () => {
  test("Duplicate payment that EET never received", async () => {
    await using context = await createEetTestContext()
    const { first } = await reportedBillWithUnreportedDuplicate(context)

    await refundWithEet(context, {
      paymentId: first,
      method: "cashRegister",
      deviceId: context.deviceId,
      amount: NonNegativeInteger(5_000),
      purpose: "overpayment",
    })

    await expect(
      context.deps.evolu.loadQuery(refundRowsQuery(first))
    ).resolves.toMatchObject([
      { deviceId: null, amount: 5_000, mainRefundId: null },
    ])
  })

  test("Unreported extra money inside one payment", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const paymentId = await createEetTestPayment(context)
    await settleEetPaymentInCash(context, paymentId)
    await reportSaleOf(context, { paymentId, amount: 25_000 })
    await settleEetPaymentByTransfer(context, paymentId)

    await refundWithEet(context, {
      paymentId,
      method: "outside",
      deviceId: context.deviceId,
      amount: NonNegativeInteger(25_000),
      purpose: "overpayment",
    })

    await expect(
      context.deps.evolu.loadQuery(refundRowsQuery(paymentId))
    ).resolves.toMatchObject([
      { deviceId: null, amount: 25_000, mainRefundId: null },
    ])
  })

  test("Kept, then returned after all", async () => {
    await using context = await createEetTestContext()
    const { first, duplicate } =
      await reportedBillWithUnreportedDuplicate(context)
    {
      await using run = testCreateRun(context.deps)
      await run.orThrow(
        recordOverpaymentResolution({
          paymentId: duplicate,
          kind: "kept",
          amount: PositiveInteger(5_000),
          deviceId: context.deviceId,
        })
      )
    }

    await refundWithEet(context, {
      paymentId: first,
      method: "outside",
      deviceId: context.deviceId,
      amount: NonNegativeInteger(5_000),
    })

    await expect(
      context.deps.evolu.loadQuery(refundRowsQuery(first))
    ).resolves.toMatchObject([{ deviceId: null, amount: 5_000 }])
  })

  test("writes the part EET never received as a second row and counts both as one refund", async () => {
    await using context = await createEetTestContext()
    const { first } = await reportedBillWithUnreportedDuplicate(context)

    const refundId = await refundWithEet(context, {
      paymentId: first,
      method: "cashRegister",
      deviceId: context.deviceId,
      amount: NonNegativeInteger(10_000),
      purpose: "overpayment",
    })
    const [main, withoutDevice] = await context.deps.evolu.loadQuery(
      refundRowsQuery(first)
    )

    expect(main).toMatchObject({
      id: refundId,
      deviceId: context.deviceId,
      amount: 5_000,
      mainRefundId: null,
    })
    expect(withoutDevice).toMatchObject({
      deviceId: null,
      amount: 5_000,
      method: main?.method,
      refundedAt: main?.refundedAt,
      mainRefundId: refundId,
    })
    await expect(
      context.deps.evolu.loadQuery(refundsByPaymentIdQuery(first))
    ).resolves.toMatchObject([{ id: refundId, amount: 10_000 }])
    await expect(
      context.deps.evolu.loadQuery(
        accountTransactionsQuery(context.cashRegisterAccountId)
      )
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ amount: -10_000 })])
    )
    await expect(
      context.deps.evolu.loadQuery(
        refundsQuery(
          statsPeriodRanges(
            { kind: "custom", from: "2026-06-05", to: "2026-06-05" },
            new Date("2026-06-05")
          ).range
        )
      )
    ).resolves.toMatchObject([{ count: 1, amount: 10_000 }])
  })
})

const splitModelRun = async (seed: number) => {
  const random = createSeededRandom(seed)
  await using context = await createEetTestContext()
  await configureEet(context)
  const asks = Array.from(
    { length: 1 + random(3) },
    () => [2_500, 5_000, 10_000, 25_000][random(4)] ?? 2_500
  )
  const billId = await billOfTotal(
    context,
    asks.reduce((sum, ask) => sum + ask, 0)
  )
  const payments: Array<{
    readonly id: PaymentId
    readonly ask: number
    readonly room: number
  }> = []
  for (const ask of asks) {
    payments.push({
      id: await createEetTestPayment(context, { billId, amount: ask }),
      ask,
      room: [0, Math.floor(ask / 2), ask][random(3)] ?? 0,
    })
  }
  for (const payment of payments) {
    await settleEetPaymentInCash(context, payment.id)
    if (payment.room > 0) {
      await reportSaleOf(context, {
        paymentId: payment.id,
        billId,
        amount: payment.room,
      })
    }
  }

  const devices = [context.deviceId, createRowId<"Device">()]
  const confirmed: Array<{
    readonly paymentId: PaymentId
    readonly amount: number
    readonly method: RefundMethod
  }> = []
  for (let index = 0; index < 1 + random(6); index++) {
    const payment = payments[random(payments.length)]
    if (payment === undefined) continue
    const left =
      payment.ask -
      confirmed
        .filter(({ paymentId }) => paymentId === payment.id)
        .reduce((sum, { amount }) => sum + amount, 0)
    if (left <= 0) continue
    const amount = 1 + random(left)
    const method: RefundMethod = random(2) === 0 ? "cashRegister" : "outside"
    await refundWithEet(context, {
      paymentId: payment.id,
      method,
      deviceId: devices[random(2)] ?? null,
      amount: NonNegativeInteger(amount),
    })
    confirmed.push({ paymentId: payment.id, amount, method })
  }

  const problems: string[] = []
  for (const payment of payments) {
    const listed = await context.deps.evolu.loadQuery(
      refundsByPaymentIdQuery(payment.id)
    )
    const own = confirmed.filter(({ paymentId }) => paymentId === payment.id)
    if (
      listed.reduce((sum, { amount }) => sum + amount, 0) !==
        own.reduce((sum, { amount }) => sum + amount, 0) ||
      listed.length !== own.length
    ) {
      problems.push("refunded amount")
    }
  }
  const stats = await context.deps.evolu.loadQuery(
    refundsQuery(
      statsPeriodRanges(
        { kind: "custom", from: "2026-06-05", to: "2026-06-05" },
        new Date("2026-06-05")
      ).range
    )
  )
  if (stats.reduce((sum, { count }) => sum + count, 0) !== confirmed.length) {
    problems.push("refund count")
  }
  for (const method of ["cashRegister", "outside"] as const) {
    const counted = stats
      .filter((row) => row.method === method)
      .reduce((sum, { amount }) => sum + amount, 0)
    const wanted = confirmed
      .filter((refund) => refund.method === method)
      .reduce((sum, { amount }) => sum + amount, 0)
    if (counted !== wanted) problems.push("expected cash by method")
  }
  const movements = (
    await context.deps.evolu.loadQuery(
      accountTransactionsQuery(context.cashRegisterAccountId)
    )
  )
    .flatMap(({ amount }) => (amount !== null && amount < 0 ? [-amount] : []))
    .sort((a, b) => a - b)
  const cashRefunds = confirmed
    .filter(({ method }) => method === "cashRegister")
    .map(
      ({ amount }) =>
        deriveCashRefundHandedAmounts({
          goodsAmount: NonNegativeInteger(amount),
          tipAmount: NonNegativeInteger(0),
          currency: "CZK",
        }).goods
    )
    .filter((handed) => handed > 0)
    .sort((a, b) => a - b)
  if (JSON.stringify(movements) !== JSON.stringify(cashRefunds)) {
    problems.push("cash movements")
  }

  const rows = await context.deps.evolu.loadQuery(
    createQuery((db) =>
      db
        .selectFrom("refund")
        .select(["id", "paymentId", "deviceId", "amount", "mainRefundId"])
        .orderBy("createdAt")
    )
  )
  const room = new Map(payments.map(({ id, room }) => [id, room]))
  let reversed = 0
  for (const row of rows) {
    if (row.deviceId === null || row.paymentId === null) continue
    const reversal = Math.min(row.amount ?? 0, room.get(row.paymentId) ?? 0)
    room.set(row.paymentId, (room.get(row.paymentId) ?? 0) - reversal)
    reversed += reversal
  }
  const reported = payments.reduce((sum, payment) => sum + payment.room, 0)
  const neverReceived = payments.reduce(
    (sum, payment) => sum + payment.ask - payment.room,
    0
  )
  const returnedReported = Math.max(
    0,
    confirmed.reduce((sum, { amount }) => sum + amount, 0) - neverReceived
  )
  if (reported - reversed < reported - returnedReported) {
    problems.push("EET below the reported money kept")
  }
  const ids = new Set(rows.map(({ id }) => id))
  if (
    rows.some(
      ({ mainRefundId }) => mainRefundId !== null && !ids.has(mainRefundId)
    )
  ) {
    problems.push("orphan row")
  }
  return problems
}

describe("a refund in two rows reads as one, as refund_split_model.py checks", () => {
  test.each(Array.from({ length: 16 }, (_, index) => index + 1))(
    "seed %i: refunded amount, refund count, cash by method, cash movements and the EET floor",
    async (seed) => {
      expect(await splitModelRun(seed)).toEqual([])
    }
  )
})
