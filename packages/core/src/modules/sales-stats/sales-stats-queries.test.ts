import {
  sqliteQueryStringToSqliteQuery,
  sqliteTrue,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createTestAppEvolu } from "../../evolu/client.ts"
import { createQuery } from "../../evolu/schema.ts"
import { setupRunWithEvoluDeps } from "../../runtime/node-evolu.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  createAccountTransaction,
  deleteAccountTransaction,
} from "../account-transaction/account-transaction-actions.ts"
import {
  addCatalogItemToBill,
  addManualAmountToBill,
  addTipToBill,
  appendRemoveBillLine,
  cancelBill,
  confirmBillClosedDespiteCancellation,
  createBill,
} from "../bill/bill-actions.ts"
import { loadAnsweredOverpaymentTips } from "../bill/bill-overpayment-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import { calculateTaxRecap } from "../bill-line/bill-line-tax-utils.ts"
import { deriveBillSummaryTotal } from "../bill-line/bill-line-utils.ts"
import { createCatalogCategory } from "../catalog-category/catalog-category-actions.ts"
import type { CatalogCategoryId } from "../catalog-category/catalog-category-types.ts"
import {
  createCatalogItem,
  updateCatalogItem,
} from "../catalog-item/catalog-item-actions.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { registerDevice } from "../device/device-actions.ts"
import type { DeviceId } from "../device/device-types.ts"
import {
  recordOverpaymentResolution,
  withdrawOverpaymentResolution,
} from "../overpayment-resolution/overpayment-resolution-actions.ts"
import {
  cancelPayment,
  confirmPaymentPaidDespiteCancellation,
  createPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
} from "../payment/payment-actions.ts"
import {
  paymentByIdQuery,
  paymentClaimsQuery,
} from "../payment/payment-queries.ts"
import { derivePaymentStatus } from "../payment/payment-status-utils.ts"
import {
  accountTransactionsByPaymentIdQuery,
  createPaymentAccounts,
} from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { claimManualReconciliation } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import { refundPayment, refundPaymentTip } from "../refund/refund-actions.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  type FiatCurrency,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMsSchema,
} from "../shared/schema.ts"
import { createTaxRate } from "../tax-rate/tax-rate-actions.ts"
import { taxRatesQuery } from "../tax-rate/tax-rate-queries.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"
import {
  categorySalesQuery,
  itemSalesQuery,
  keypadSalesQuery,
  overpaymentTipsQuery,
  refundsQuery,
  salesByDeviceQuery,
  salesByHourQuery,
  salesByMethodQuery,
  signalsQuery,
  taxRecapQuery,
} from "./sales-stats-queries.ts"
import type { StatsRange } from "./sales-stats-types.ts"
import {
  expectedCash,
  methodBreakdown,
  salesBuckets,
  salesKpis,
  salesTaxRecap,
  statsPeriodRanges,
} from "./sales-stats-utils.ts"

/** Local calendar days, both inclusive, as the Custom period builds them. */
const days = (from: string, to: string = from): StatsRange =>
  statsPeriodRanges({ kind: "custom", from, to }, new Date(from)).range

const june5 = days("2026-06-05")

/** Every payment written, for the parity test's own status derivation. */
const paymentIdsQuery = createQuery((db) =>
  db.selectFrom("payment").select("id").where("isDeleted", "is not", sqliteTrue)
)

/**
 * A fresh Evolu whose clock and `createdAt` move together: `at` sets the
 * date dep and backdates every following mutation, as the demo data does.
 * Only forward, and never past the real clock: Evolu rejects a timestamp
 * behind the last one or too far ahead of the wall clock.
 */
const createStatsContext = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  let now = Date.parse("2025-01-01T06:00:00.000Z")
  const deps = {
    ...evoluTestDeps(evolu),
    date: { now: () => new Date(now) },
  }
  const at = (iso: string) => {
    now = Date.parse(iso)
    evolu.setMutationBackdate(now)
  }
  /**
   * A second on, so a bill's lines keep their order: lines in the same
   * millisecond fold in id order, which can put a remove before its add.
   */
  const tick = () => {
    at(new Date(now + 1000).toISOString())
  }
  at("2025-01-01T06:00:00.000Z")
  const accounts = await createPaymentAccounts(deps)

  const run = () => testCreateRun(deps)

  /**
   * A cancellation that lands after the payment was paid, as a merge from
   * another device would: on one device `cancelPayment` refuses a paid
   * payment and a hand confirmation refuses a canceled one (payment/0004).
   */
  const cancelAfterPaid = (paymentId: PaymentId) =>
    runMutationWithCompletion((options) =>
      evolu.update(
        "payment",
        { id: paymentId, canceledAt: TimestampMsSchema.decode(now) },
        options
      )
    )

  /** `amount` is `payment.amount`, the tip included. */
  const createTestPayment = async ({
    amount,
    tipAmount = 0,
    billId = null,
    deviceId = null,
    currency = "CZK",
    expiresAt = null,
    sats = null,
  }: {
    readonly amount: number
    readonly tipAmount?: number
    readonly billId?: BillId | null
    readonly deviceId?: DeviceId | null
    readonly currency?: FiatCurrency
    readonly expiresAt?: number | null
    /** Makes it a Lightning payment invoiced for this many satoshis. */
    readonly sats?: number | null
  }): Promise<PaymentId> => {
    await using r = run()
    return await r.orThrow(
      createPayment({
        deviceId,
        billId,
        tableId: null,
        amount: NonNegativeInteger(amount),
        currency,
        tipAmount: NonNegativeInteger(tipAmount),
        canceledAt: null,
        expiresAt:
          expiresAt === null ? null : TimestampMsSchema.decode(expiresAt),
        ...(sats === null
          ? {}
          : {
              spark: {
                accountId: accounts.sparkAccountId,
                amountSats: NonNegativeInteger(sats),
                exchangeRate: PositiveNumber(1_550_000),
                exchangeRateSource: "yadio" as const,
                exchangeRateFetchedAt: TimestampMsSchema.decode(now),
                lightning: {
                  lnInvoice: NonEmptyStringSchema.decode("lnbc1test"),
                  lightningReceiveRequestId: null,
                  paymentHash: null,
                  paymentPreimage: null,
                },
              },
            }),
      })
    )
  }

  const settleInCash = async (
    paymentId: PaymentId,
    accountId: AccountId = accounts.cashRegisterAccountId
  ) => {
    await using r = run()
    await r.orThrow(markPaymentPaidCash({ paymentId, accountId }))
  }

  /** A transfer confirmed by hand. */
  const settleByTransfer = async (paymentId: PaymentId) => {
    await using r = run()
    await r.orThrow(
      markPaymentPaidIban({ paymentId, accountId: accounts.ibanAccountId })
    )
  }

  /** A second, independent settlement: a duplicate across devices. */
  const claimExtra = async ({
    paymentId,
    accountId,
    amount,
    currency = "CZK",
  }: {
    readonly paymentId: PaymentId
    readonly accountId: AccountId
    readonly amount: number
    readonly currency?: "CZK" | "BTC"
  }) => {
    await using r = run()
    const accountTransactionId = await r.ok(
      createAccountTransaction({
        accountId,
        amount: NonNegativeInteger(amount),
        currency,
        occurredAt: TimestampMsSchema.decode(now),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "auto" },
        ...(accountId === accounts.sparkAccountId
          ? {
              spark: {
                sparkTransferId: NonEmptyStringSchema.decode(
                  crypto.randomUUID()
                ),
              },
            }
          : { kind: "cashRegister" as const }),
      })
    )
    await r.ok(
      claimManualReconciliation({
        paymentId,
        accountTransactionId,
        deviceId: null,
      })
    )
  }

  const pay = async (input: Parameters<typeof createTestPayment>[0]) => {
    const paymentId = await createTestPayment(input)
    await settleInCash(paymentId)
    return paymentId
  }

  const createCatalogEntry = async ({
    name,
    unitAmount,
    categoryId = null,
    taxRateId = null,
  }: {
    readonly name: string
    readonly unitAmount: number
    readonly categoryId?: CatalogCategoryId | null
    readonly taxRateId?: TaxRateId | null
  }): Promise<CatalogItemId> => {
    await using r = run()
    return await r.ok(
      createCatalogItem({
        deviceId: null,
        categoryId,
        name: NonEmptyString255(name),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(unitAmount),
        sortOrder: NonNegativeInteger(0),
        scanCode: null,
        taxRateId,
      })
    )
  }

  const createTestBill = async (): Promise<BillId> => {
    await using r = run()
    return await r.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
  }

  const add = async (billId: BillId, catalogItemId: CatalogItemId, n = 1) => {
    tick()
    await using r = run()
    await r.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(n),
      })
    )
  }

  const removeOne = async (billId: BillId, catalogItemId: CatalogItemId) => {
    tick()
    await using r = run()
    const summary = (await r.ok(loadCalculatedBillLineSummaries(billId))).find(
      (line) => line.catalogItemId === catalogItemId
    )
    if (summary === undefined) throw new Error("Nothing to remove.")
    await r.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: null,
        quantity: PositiveNumber(1),
        totalAmount: NonNegativeInteger(summary.totalAmount / summary.quantity),
        lineSummary: summary,
      })
    )
  }

  const summariesOf = async (billId: BillId) => {
    await using r = run()
    return await r.ok(loadCalculatedBillLineSummaries(billId))
  }

  /** Pays a bill's whole total in cash, which closes it. */
  const payBill = async (billId: BillId) => {
    const total = deriveBillSummaryTotal(await summariesOf(billId))
    return await pay({ amount: total, billId })
  }

  const load = evolu.loadQuery

  return {
    evolu,
    deps,
    at,
    run,
    ...accounts,
    cancelAfterPaid,
    createTestPayment,
    settleInCash,
    settleByTransfer,
    claimExtra,
    pay,
    createCatalogEntry,
    createTestBill,
    add,
    removeOne,
    summariesOf,
    payBill,
    load,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

describe("a paid payment", () => {
  test("is exactly what derivePaymentStatus calls paid", async () => {
    await using context = await createStatsContext()
    const expired = Date.parse("2026-06-05T07:00:00.000Z")
    context.at("2026-06-05T08:00:00.000Z")

    // Each state has its own power of two, so the sum names the set.
    await context.createTestPayment({ amount: 100 }) // pending
    await context.createTestPayment({ amount: 200, expiresAt: expired })
    await using r = context.run()
    await r.orThrow(
      cancelPayment(await context.createTestPayment({ amount: 400 }))
    )
    await context.pay({ amount: 800 })
    const paidAfterExpiry = await context.createTestPayment({
      amount: 1600,
      expiresAt: expired,
    })
    await context.settleInCash(paidAfterExpiry)
    const collision = await context.createTestPayment({ amount: 3200 })
    await context.settleInCash(collision)
    await context.cancelAfterPaid(collision)
    const confirmed = await context.createTestPayment({ amount: 6400 })
    await context.settleInCash(confirmed)
    await context.cancelAfterPaid(confirmed)
    await r.orThrow(confirmPaymentPaidDespiteCancellation(confirmed))
    const claimOnDeletedTransaction = await context.pay({ amount: 12_800 })
    const [transaction] = await context.load(
      accountTransactionsByPaymentIdQuery(claimOnDeletedTransaction)
    )
    if (transaction === undefined) throw new Error("No transaction.")
    await r.ok(deleteAccountTransaction(transaction.id))

    const paymentIds = await context.load(paymentIdsQuery)
    const expected = { count: 0, gross: 0 }
    for (const { id } of paymentIds) {
      const [payment] = await context.load(paymentByIdQuery(id))
      if (payment === undefined) throw new Error("No payment.")
      const claims = await context.load(paymentClaimsQuery(id))
      const status = derivePaymentStatus({
        ...payment,
        hasActiveClaim: claims.length > 0,
        now: new Date("2026-06-05T09:00:00.000Z"),
      })
      if (status === "paid") {
        expected.count += 1
        expected.gross += payment.amount
      }
    }

    expect(expected).toEqual({ count: 3, gross: 800 + 1600 + 6400 })
    const rows = await context.load(salesByHourQuery(june5))
    expect(rows).toEqual([
      { utcHour: "2026-06-05T08", currency: "CZK", ...expected, tips: 0 },
    ])
  })

  test("counts gross without the tip and the tip apart", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T08:15:00.000Z")
    await context.pay({ amount: 11_000, tipAmount: 1_000 })

    await expect(context.load(salesByHourQuery(june5))).resolves.toEqual([
      {
        utcHour: "2026-06-05T08",
        currency: "CZK",
        count: 1,
        gross: 10_000,
        tips: 1_000,
      },
    ])
  })

  test("belongs to the day it was created, not the day the money arrived", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T20:00:00.000Z")
    const paymentId = await context.createTestPayment({ amount: 500 })
    context.at("2026-06-06T09:00:00.000Z")
    await context.settleByTransfer(paymentId)

    await expect(context.load(salesByHourQuery(june5))).resolves.toMatchObject([
      { count: 1, gross: 500 },
    ])
    await expect(
      context.load(salesByHourQuery(days("2026-06-06")))
    ).resolves.toEqual([])
  })
})

describe("refunds", () => {
  test("count on the day they were paid out and reduce tips only when isTip", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    const paymentId = await context.pay({ amount: 11_000, tipAmount: 1_000 })
    context.at("2026-06-06T10:00:00.000Z")
    await using r = context.run()
    await r.orThrow(
      refundPayment({
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(3_000),
      })
    )
    await r.orThrow(
      refundPaymentTip({ paymentId, method: "outside", deviceId: null })
    )

    const kpisOf = async (range: StatsRange) =>
      salesKpis({
        hourRows: await context.load(salesByHourQuery(range)),
        refundRows: await context.load(refundsQuery(range)),
        overpaymentTips: [],
        accountCurrency: "CZK",
      })

    await expect(context.load(refundsQuery(june5))).resolves.toEqual([])
    await expect(kpisOf(june5)).resolves.toEqual([
      {
        currency: "CZK",
        netRevenue: 10_000,
        gross: 10_000,
        salesCount: 1,
        averageSale: 10_000,
        tips: 1_000,
        tipsReceived: 1_000,
        refundCount: 0,
        refundAmount: 0,
        saleRefundAmount: 0,
        tipRefundAmount: 0,
      },
    ])
    const june6 = days("2026-06-06")
    await expect(context.load(refundsQuery(june6))).resolves.toEqual(
      expect.arrayContaining([
        {
          currency: "CZK",
          method: "cashRegister",
          isTip: 0,
          count: 1,
          amount: 3_000,
        },
        {
          currency: "CZK",
          method: "outside",
          isTip: 1,
          count: 1,
          amount: 1_000,
        },
      ])
    )
    await expect(kpisOf(june6)).resolves.toEqual([
      {
        currency: "CZK",
        netRevenue: -3_000,
        gross: 0,
        salesCount: 0,
        averageSale: 0,
        tips: -1_000,
        tipsReceived: 0,
        refundCount: 2,
        refundAmount: 4_000,
        saleRefundAmount: 3_000,
        tipRefundAmount: 1_000,
      },
    ])
  })
})

describe("tips from an overpayment", () => {
  test("Tips of the day", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    await context.pay({ amount: 14_000, tipAmount: 4_000 })
    const overpaid = await context.pay({ amount: 10_000 })
    await context.claimExtra({
      paymentId: overpaid,
      accountId: context.ibanAccountId,
      amount: 3_000,
    })
    await using r = context.run()
    await r.orThrow(
      recordOverpaymentResolution({
        paymentId: overpaid,
        kind: "tip",
        amount: PositiveInteger(2_000),
        deviceId: null,
      })
    )
    context.at("2026-06-06T10:00:00.000Z")
    const withdrawn = await r.orThrow(
      recordOverpaymentResolution({
        paymentId: overpaid,
        kind: "tip",
        amount: PositiveInteger(1_000),
        deviceId: null,
      })
    )
    await r.orThrow(
      withdrawOverpaymentResolution({ resolutionId: withdrawn, deviceId: null })
    )

    const tipsOf = async (range: StatsRange) =>
      salesKpis({
        hourRows: await context.load(salesByHourQuery(range)),
        refundRows: await context.load(refundsQuery(range)),
        overpaymentTips: await r.ok(
          loadAnsweredOverpaymentTips(
            await context.load(overpaymentTipsQuery(range))
          )
        ),
        accountCurrency: "CZK",
      }).map(({ currency, tips }) => ({ currency, tips }))

    await expect(tipsOf(june5)).resolves.toEqual([
      { currency: "CZK", tips: 6_000 },
    ])
    await expect(tipsOf(days("2026-06-06"))).resolves.toEqual([
      { currency: "CZK", tips: 0 },
    ])
  })
})

describe("payment method", () => {
  test("is the claimed transaction's kind, split per claim on a duplicate settlement", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    // One claim: the whole gross to its kind.
    await context.pay({ amount: 5_500, tipAmount: 500 })
    // Settled twice across devices: by transfer and in cash.
    const duplicate = await context.createTestPayment({ amount: 10_000 })
    await context.settleByTransfer(duplicate)
    await context.claimExtra({
      paymentId: duplicate,
      accountId: context.cashRegisterAccountId,
      amount: 10_000,
    })
    // Satoshis count in the payment's fiat, at its own rate: half of the
    // invoice is half of the amount.
    const lightning = await context.createTestPayment({
      amount: 12_900,
      sats: 20_000,
    })
    await context.claimExtra({
      paymentId: lightning,
      accountId: context.sparkAccountId,
      amount: 10_000,
      currency: "BTC",
    })
    await context.claimExtra({
      paymentId: lightning,
      accountId: context.cashRegisterAccountId,
      amount: 6_450,
    })
    // Confirmed paid without any claim — impossible through the Tasks,
    // counted rather than dropped if a merge ever produces it.
    const unknown = await context.createTestPayment({ amount: 700 })
    await runMutationWithCompletion((options) =>
      context.evolu.update(
        "payment",
        { id: unknown, confirmedPaidAt: TimestampMsSchema.decode(Date.now()) },
        { ...options, owner: context.deps.evoluOwner }
      )
    )

    const methodRows = await context.load(salesByMethodQuery(june5))
    expect(methodRows).toEqual(
      expect.arrayContaining([
        {
          method: "cashRegister",
          currency: "CZK",
          count: 3,
          amount: 5_000 + 10_000 + 6_450,
          claimedAmount: 5_500 + 10_000 + 6_450,
          tips: 500,
        },
        {
          method: "iban",
          currency: "CZK",
          count: 1,
          amount: 10_000,
          claimedAmount: 10_000,
          tips: 0,
        },
        {
          method: "spark",
          currency: "CZK",
          count: 1,
          amount: 6_450,
          claimedAmount: 6_450,
          tips: 0,
        },
        {
          method: "unknown",
          currency: "CZK",
          count: 1,
          amount: 700,
          claimedAmount: 0,
          tips: 0,
        },
      ])
    )
    expect(methodRows).toHaveLength(4)

    const hourRows = await context.load(salesByHourQuery(june5))
    // Revenue is each payment's gross once: 5 000 + 10 000 + 12 900 + 700.
    expect(
      methodBreakdown({ methodRows, hourRows, accountCurrency: "CZK" })
    ).toMatchObject([
      {
        currency: "CZK",
        // Tips count in both: the methods' amounts and the takings.
        total: 21_450 + 500 + 10_000 + 6_450 + 700,
        excess: 39_100 - 29_100,
      },
    ])
  })
})

describe("expected cash", () => {
  test("is cash taken minus cash refunds, its tips shown apart", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    const paymentId = await context.pay({ amount: 11_000, tipAmount: 1_000 })
    const byTransfer = await context.createTestPayment({ amount: 4_000 })
    await context.settleByTransfer(byTransfer)
    await using r = context.run()
    await r.orThrow(
      refundPayment({
        paymentId,
        method: "cashRegister",
        deviceId: null,
        amount: NonNegativeInteger(2_000),
      })
    )
    await r.orThrow(
      refundPayment({
        paymentId: byTransfer,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(500),
      })
    )

    expect(
      expectedCash({
        methodRows: await context.load(salesByMethodQuery(june5)),
        refundRows: await context.load(refundsQuery(june5)),
        accountCurrency: "CZK",
      })
    ).toEqual([
      {
        currency: "CZK",
        cashIn: 11_000,
        cashTips: 1_000,
        cashRefunds: 2_000,
        expected: 9_000,
      },
    ])
  })
})

describe("items and categories", () => {
  test("net a bill's lines as calculateBillLineSummaries does", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    const coffee = await context.createCatalogEntry({
      name: "Coffee",
      unitAmount: 6_000,
    })
    const cake = await context.createCatalogEntry({
      name: "Cake",
      unitAmount: 9_000,
    })
    const juice = await context.createCatalogEntry({
      name: "Juice",
      unitAmount: 5_000,
    })
    const billId = await context.createTestBill()
    await context.add(billId, coffee, 2) // add
    await context.add(billId, cake) // add, remove
    await context.removeOne(billId, cake)
    await context.add(billId, juice) // add, remove, add
    await context.removeOne(billId, juice)
    await context.add(billId, juice, 3)
    await using r = context.run()
    await r.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        totalAmount: NonNegativeInteger(700),
        name: NonEmptyString255("Corkage"),
        currency: "CZK",
      })
    )
    await r.orThrow(
      addTipToBill({
        billId,
        deviceId: null,
        totalAmount: NonNegativeInteger(1_000),
        name: NonEmptyString255("Tip"),
        currency: "CZK",
      })
    )
    const summaries = await context.summariesOf(billId)
    context.at("2026-06-05T11:00:00.000Z")
    await context.payBill(billId)

    const rows = await context.load(itemSalesQuery(june5))
    expect(
      rows.map(({ itemId, quantity, amount }) => ({ itemId, quantity, amount }))
    ).toEqual(
      expect.arrayContaining(
        summaries
          .filter((summary) => summary.type !== "tip")
          .map(({ itemId, quantity, totalAmount }) => ({
            itemId,
            quantity,
            amount: totalAmount,
          }))
      )
    )
    expect(rows.map((row) => row.name).sort()).toEqual([
      "Coffee",
      "Corkage",
      "Juice",
    ])
  })

  test("group a product across price changes under its newest name", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    const coffee = await context.createCatalogEntry({
      name: "Coffee",
      unitAmount: 6_000,
    })
    const billId = await context.createTestBill()
    await context.add(billId, coffee)
    context.at("2026-06-05T10:05:00.000Z")
    await using r = context.run()
    await r.ok(
      updateCatalogItem({
        id: coffee,
        name: NonEmptyString255("Espresso"),
        unitAmount: NonNegativeInteger(6_500),
      })
    )
    await context.add(billId, coffee)
    await context.payBill(billId)

    await expect(context.load(itemSalesQuery(june5))).resolves.toMatchObject([
      {
        catalogItemId: coffee,
        name: "Espresso",
        currency: "CZK",
        quantity: 2,
        amount: 12_500,
      },
    ])
  })

  test("count only bills closed in the period and not canceled", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    const coffee = await context.createCatalogEntry({
      name: "Coffee",
      unitAmount: 1_000,
    })
    await using r = context.run()

    const open = await context.createTestBill()
    await context.add(open, coffee, 1)
    const canceled = await context.createTestBill()
    await context.add(canceled, coffee, 2)
    await r.orThrow(cancelBill(canceled))
    const closed = await context.createTestBill()
    await context.add(closed, coffee, 4)
    await context.payBill(closed)
    // Canceled while its payment was still out, paid anyway, confirmed.
    const confirmed = await context.createTestBill()
    await context.add(confirmed, coffee, 8)
    const payment = await context.createTestPayment({
      amount: 8_000,
      billId: confirmed,
    })
    await r.orThrow(cancelBill(confirmed))
    await context.settleInCash(payment)
    await r.orThrow(confirmBillClosedDespiteCancellation(confirmed))
    // Closed the next day.
    const tomorrow = await context.createTestBill()
    await context.add(tomorrow, coffee, 16)
    context.at("2026-06-06T10:00:00.000Z")
    await context.payBill(tomorrow)

    await expect(context.load(itemSalesQuery(june5))).resolves.toMatchObject([
      { name: "Coffee", quantity: 12, amount: 12_000 },
    ])
  })

  test("fall back to Uncategorized, and keypad sales stand apart", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    await using r = context.run()
    const drinks = await r.ok(
      createCatalogCategory({
        deviceId: null,
        name: NonEmptyString255("Drinks"),
        sortOrder: NonNegativeInteger(0),
      })
    )
    const coffee = await context.createCatalogEntry({
      name: "Coffee",
      unitAmount: 1_000,
      categoryId: drinks,
    })
    const bread = await context.createCatalogEntry({
      name: "Bread",
      unitAmount: 300,
    })
    const billId = await context.createTestBill()
    await context.add(billId, coffee, 2)
    await context.add(billId, bread)
    await r.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        totalAmount: NonNegativeInteger(700),
        name: NonEmptyString255("Corkage"),
        currency: "CZK",
      })
    )
    await context.payBill(billId)
    await context.pay({ amount: 2_500, tipAmount: 500 })

    await expect(context.load(categorySalesQuery(june5))).resolves.toEqual([
      {
        categoryId: drinks,
        categoryName: "Drinks",
        currency: "CZK",
        quantity: 2,
        amount: 2_000,
      },
      {
        categoryId: null,
        categoryName: null,
        currency: "CZK",
        quantity: 2,
        amount: 1_000,
      },
    ])
    await expect(context.load(keypadSalesQuery(june5))).resolves.toEqual([
      { currency: "CZK", count: 1, gross: 2_000 },
    ])
  })

  test("recap VAT as calculateTaxRecap does on the bill", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    await using r = context.run()
    const standard = await r.ok(
      createTaxRate({
        name: NonEmptyString255("Standard"),
        rate: TaxRatePercentage(21),
        isDefault: true,
      })
    )
    const reduced = await r.ok(
      createTaxRate({
        name: NonEmptyString255("Reduced"),
        rate: TaxRatePercentage(12),
        isDefault: false,
      })
    )
    const beer = await context.createCatalogEntry({
      name: "Beer",
      unitAmount: 5_900,
      taxRateId: standard,
    })
    const soup = await context.createCatalogEntry({
      name: "Soup",
      unitAmount: 8_900,
      taxRateId: reduced,
    })
    const stamp = await context.createCatalogEntry({
      name: "Stamp",
      unitAmount: 2_300,
    })
    const summaries = []
    for (const lines of [
      [beer, beer, soup],
      [beer, soup, stamp],
    ]) {
      const billId = await context.createTestBill()
      for (const item of lines) await context.add(billId, item)
      summaries.push(...(await context.summariesOf(billId)))
      await context.payBill(billId)
    }
    const rates = await context.load(taxRatesQuery)

    expect(
      salesTaxRecap({
        rows: await context.load(taxRecapQuery(june5)),
        currency: "CZK",
        rates,
      })
    ).toEqual(calculateTaxRecap(summaries, rates))
  })
})

describe("per device", () => {
  test("sums paid sales per payment.deviceId with the device's name", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    const bar = createRowId<"Device">()
    await using r = context.run()
    await r.ok(
      registerDevice({
        id: bar,
        name: NonEmptyString255("Bar"),
        deviceType: null,
        browserName: null,
        osName: null,
      })
    )
    await context.pay({ amount: 3_000, deviceId: bar })
    await context.pay({ amount: 2_000, tipAmount: 500, deviceId: bar })
    await context.pay({ amount: 1_000 })

    await expect(context.load(salesByDeviceQuery(june5))).resolves.toEqual([
      {
        deviceId: bar,
        deviceName: "Bar",
        currency: "CZK",
        count: 2,
        gross: 4_500,
        tips: 500,
      },
      {
        deviceId: null,
        deviceName: null,
        currency: "CZK",
        count: 1,
        gross: 1_000,
        tips: 0,
      },
    ])
  })
})

describe("signals", () => {
  test("count canceled payments, canceled bills and transfers confirmed by hand", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    await using r = context.run()
    await r.orThrow(
      cancelPayment(await context.createTestPayment({ amount: 300 }))
    )
    await r.orThrow(
      cancelPayment(await context.createTestPayment({ amount: 200 }))
    )
    // Canceled, then paid and confirmed: not a signal any more.
    const confirmed = await context.createTestPayment({ amount: 900 })
    await context.settleInCash(confirmed)
    await context.cancelAfterPaid(confirmed)
    await r.orThrow(confirmPaymentPaidDespiteCancellation(confirmed))

    const coffee = await context.createCatalogEntry({
      name: "Coffee",
      unitAmount: 1_000,
    })
    const canceledBill = await context.createTestBill()
    await context.add(canceledBill, coffee, 3)
    await context.removeOne(canceledBill, coffee)
    await r.orThrow(cancelBill(canceledBill))
    await r.orThrow(cancelBill(await context.createTestBill())) // empty

    await context.settleByTransfer(
      await context.createTestPayment({ amount: 4_000 })
    )
    await context.pay({ amount: 5_000 }) // cash by hand is normal
    context.at("2026-06-06T10:00:00.000Z")
    await r.orThrow(
      cancelPayment(await context.createTestPayment({ amount: 50 }))
    )

    expect(await context.load(signalsQuery(june5))).toEqual(
      expect.arrayContaining([
        { signal: "canceledPayment", currency: "CZK", count: 2, amount: 500 },
        { signal: "canceledBill", currency: "CZK", count: 1, amount: 2_000 },
        { signal: "manualIban", currency: "CZK", count: 1, amount: 4_000 },
      ])
    )
    expect(await context.load(signalsQuery(june5))).toHaveLength(3)
  })
})

describe("currencies", () => {
  test("are never summed together; the account currency comes first", async () => {
    await using context = await createStatsContext()
    context.at("2026-06-05T10:00:00.000Z")
    await using r = context.run()
    const euroDrawer = await r.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Euro drawer"),
        cashRegister: { currency: "EUR" },
      })
    )
    const euroPayment = await context.createTestPayment({
      amount: 1_200,
      tipAmount: 200,
      currency: "EUR",
    })
    await context.settleInCash(euroPayment, euroDrawer)
    await context.pay({ amount: 30_000 })

    const hourRows = await context.load(salesByHourQuery(june5))
    const refundRows = await context.load(refundsQuery(june5))
    expect(
      salesKpis({
        hourRows,
        refundRows,
        overpaymentTips: [],
        accountCurrency: "EUR",
      }).map(({ currency, netRevenue, tips }) => ({
        currency,
        netRevenue,
        tips,
      }))
    ).toEqual([
      { currency: "EUR", netRevenue: 1_000, tips: 200 },
      { currency: "CZK", netRevenue: 30_000, tips: 0 },
    ])
    expect(
      expectedCash({
        methodRows: await context.load(salesByMethodQuery(june5)),
        refundRows,
        accountCurrency: "CZK",
      }).map(({ currency, expected }) => ({ currency, expected }))
    ).toEqual([
      { currency: "CZK", expected: 30_000 },
      { currency: "EUR", expected: 1_200 },
    ])
  })
})

describe("time buckets", () => {
  test("map UTC hours onto local days across midnight and both DST days", async () => {
    await using context = await createStatsContext()
    // 2025's autumn change, not 2026's: a backdated write may not lie in
    // the future (sales-stats-utils.test.ts covers 25 October 2026 itself).
    for (const iso of [
      "2025-10-26T00:30:00.000Z", // the first 02:30, CEST
      "2025-10-26T01:30:00.000Z", // the second 02:30, CET
      "2026-03-29T00:30:00.000Z", // 01:30 CET, before the spring gap
      "2026-03-29T01:30:00.000Z", // 03:30 CEST, right after it
      "2026-06-05T21:30:00.000Z", // 23:30 CEST, still 5 June
      "2026-06-05T22:30:00.000Z", // 00:30 CEST on 6 June, UTC still 5 June
    ]) {
      context.at(iso)
      await context.pay({ amount: 100 })
    }

    const hourly = async (day: string) => {
      const range = days(day)
      return salesBuckets({
        rows: await context.load(salesByHourQuery(range)),
        currency: "CZK",
        range,
        unit: "hour",
      })
    }
    const spring = await hourly("2026-03-29")
    expect(spring).toHaveLength(23)
    expect(
      spring.filter((bucket) => bucket.count > 0).map((b) => b.start.getHours())
    ).toEqual([1, 3])
    const autumn = await hourly("2025-10-26")
    expect(autumn).toHaveLength(25)
    expect(
      autumn.flatMap((bucket, index) => (bucket.count > 0 ? [index] : []))
    ).toEqual([2, 3])

    const june = days("2026-06-05", "2026-06-06")
    expect(
      salesBuckets({
        rows: await context.load(salesByHourQuery(june)),
        currency: "CZK",
        range: june,
        unit: "day",
      }).map(({ start, count }) => ({ day: start.getDate(), count }))
    ).toEqual([
      { day: 5, count: 1 },
      { day: 6, count: 1 },
    ])
  })
})

test("every query reads its range through an index", async () => {
  await using setup = await setupRunWithEvoluDeps("memory")
  await using evolu = await setup.run.ok(createTestAppEvolu())
  await evolu.loadQuery(taxRatesQuery) // creates the schema
  const month = days("2026-10-01", "2026-10-31")

  for (const [name, factory] of Object.entries({
    salesByHourQuery,
    salesByMethodQuery,
    refundsQuery,
    salesByDeviceQuery,
    keypadSalesQuery,
    itemSalesQuery,
    categorySalesQuery,
    taxRecapQuery,
    signalsQuery,
  })) {
    const query = sqliteQueryStringToSqliteQuery(factory(month))
    const plan = setup.sqlite
      .exec({ ...query, sql: `explain query plan ${query.sql}` as never })
      .rows.map((row) => String(row.detail))
    // A scan is fine only over this query's own small derived tables;
    // `AUTOMATIC` means SQLite indexes a whole table on every run.
    const offending = plan.filter(
      (detail) =>
        detail.includes("AUTOMATIC") ||
        (detail.startsWith("SCAN") &&
          !/^SCAN (line|settlement|\(subquery-\d+\))$/.test(detail))
    )
    expect({ name, offending }).toEqual({ name, offending: [] })
  }
})
