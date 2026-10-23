import { ok, testCreateRun } from "@evolu/common"
import { addDays, startOfDay } from "date-fns"
import { describe, expect, test } from "vitest"

import { createQuery } from "../../evolu/schema.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import {
  createAccount,
  saveCardSwitchioAccount,
} from "../account/account-actions.ts"
import { createCardSwitchioAccountId } from "../account/account-utils.ts"
import type { CreateAccountTransactionInput } from "../account-transaction/account-transaction-actions.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import { cancelBill } from "../bill/bill-actions.ts"
import { loadBillCoverage, loadBillStatus } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import {
  createPayment,
  markPaymentPaidCash,
  payPaymentWithSwitchioCard,
} from "../payment/payment-actions.ts"
import { preparePaymentMethod } from "../payment/payment-preparation-actions.ts"
import { paymentWithDetailsByIdQuery } from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { loadAutomaticReconciliation } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  type TimestampMs,
  TimestampMsSchema,
  VariableSymbol,
} from "../shared/schema.ts"
import { updateTable } from "../table/table-actions.ts"
import {
  loadSelfPayArrival,
  upsertBillSelfPayReferences,
} from "./table-self-pay-actions.ts"
import { selfPayAllocationsByBillIdQuery } from "./table-self-pay-queries.ts"
import { selfPayRateValidUntil } from "./table-self-pay-rate-utils.ts"
import {
  formatSelfPayBankMessage,
  formatSelfPayLightningMemo,
  type SelfPayPointer,
  SelfPayPointerSchema,
} from "./table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  createTestLightningInvoice,
  openSelfPayBill,
  receiveBankTransfer,
  receiveLightningPayment,
  type SelfPayTestContext,
  selectSelfPayTestShare,
  signTestSelfPayRate,
} from "./table-self-pay-test-fixtures.ts"

const unknownPointer = SelfPayPointerSchema.decode("A".repeat(32))

const selfPayRowsQuery = createQuery((db) =>
  db
    .selectFrom("paymentSelfPay")
    .select(["id", "pointer"])
    .where("isDeleted", "is not", 1)
)

const claimsByTransactionQuery = (id: AccountTransactionId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .select(["paymentId", "deviceId", "source", "claimedAt"])
      .where("accountTransactionId", "=", id)
      .where("isDeleted", "is not", 1)
  )

const loadPayment = async (context: SelfPayTestContext, id: PaymentId) => {
  const [payment] = await context.deps.evolu.loadQuery(
    paymentWithDetailsByIdQuery(id)
  )
  return payment
}

const loadCoverage = async (
  context: SelfPayTestContext,
  billId: Parameters<typeof loadBillCoverage>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run.ok(loadBillCoverage(billId))
}

const loadStatus = async (
  context: SelfPayTestContext,
  billId: Parameters<typeof loadBillStatus>[0]
) => {
  await using run = testCreateRun(context.deps)
  return await run.orThrow(loadBillStatus(billId))
}

const payByLightning = async (
  context: SelfPayTestContext,
  {
    reference,
    amount,
    pointer,
    amountSats,
    rate = signTestSelfPayRate(context.clock.date.now()),
    createdAt = rate.validFrom + 60,
    occurredAt,
  }: {
    readonly reference: Parameters<
      typeof formatSelfPayLightningMemo
    >[0]["reference"]
    readonly amount: number
    readonly pointer?: SelfPayPointer
    readonly amountSats: number
    readonly rate?: ReturnType<typeof signTestSelfPayRate>
    readonly createdAt?: number
    readonly occurredAt?: TimestampMs
  }
) =>
  receiveLightningPayment(context, {
    amountSats,
    occurredAt,
    lnInvoice: createTestLightningInvoice({
      amountSats,
      createdAt,
      memo: formatSelfPayLightningMemo({
        reference,
        pointer:
          pointer ??
          (
            await selectSelfPayTestShare(context, reference, {
              kind: "amount",
              amount,
            })
          ).pointer,
        amount,
        rate,
      }),
    }),
  })

describe("self-pay by bank transfer", () => {
  test("credits the bill the money arrived for, as a settled payment", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)

    const { accountTransactionId, paymentId } = await receiveBankTransfer(
      context,
      {
        amount: 45_000,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
      }
    )

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(await loadPayment(context, paymentId)).toMatchObject({
      billId,
      tableId: context.tableId,
      deviceId: context.deviceId,
      amount: 45_000,
      currency: "CZK",
      tipAmount: 0,
      canceledAt: null,
      expiresAt: null,
      iban: {
        accountId: context.ibanAccountId,
        variableSymbol: reference,
        specificSymbol: null,
      },
    })
    expect(
      await context.deps.evolu.loadQuery(
        claimsByTransactionQuery(accountTransactionId)
      )
    ).toEqual([
      {
        paymentId,
        deviceId: null,
        source: "auto",
        claimedAt: context.clock.date.now().getTime(),
      },
    ])
    expect(await context.deps.evolu.loadQuery(selfPayRowsQuery)).toEqual([
      { id: paymentId, pointer },
    ])
    expect(await loadStatus(context, billId)).toBe("closed")
  })

  test("settles a transfer when it was matched, since the bank books only its date", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)

    const { accountTransactionId } = await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
      occurredAt: TimestampMsSchema.decode(
        startOfDay(context.clock.date.now()).getTime()
      ),
    })

    expect(
      await context.deps.evolu.loadQuery(
        claimsByTransactionQuery(accountTransactionId)
      )
    ).toMatchObject([{ claimedAt: context.clock.date.now().getTime() }])
  })

  test("keeps what arrives above the share out of what the payment covers, as the tip", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference, {
      kind: "amount",
      amount: 20_000,
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 22_000,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(await loadPayment(context, paymentId)).toMatchObject({
      amount: 22_000,
      tipAmount: 2000,
    })
    expect(await loadCoverage(context, billId)).toMatchObject({
      claimedSum: 20_000,
      coverage: "underpaid",
    })
  })

  test("credits less than the share without a tip", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference, {
      kind: "amount",
      amount: 20_000,
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 15_000,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(await loadPayment(context, paymentId)).toMatchObject({
      amount: 15_000,
      tipAmount: 0,
    })
    expect((await loadCoverage(context, billId)).claimedSum).toBe(15_000)
  })

  test("credits a transfer without a message, with no tip", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 10_000,
      variableSymbol: reference,
    })

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(await loadPayment(context, paymentId)).toMatchObject({
      amount: 10_000,
      tipAmount: 0,
    })
    expect(await context.deps.evolu.loadQuery(selfPayRowsQuery)).toEqual([
      { id: paymentId, pointer: null },
    ])
  })

  test("settles an ordinary payment that matches first", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await using run = testCreateRun(context.deps)
    const ordinaryPaymentId = await run.orThrow(
      createPayment({
        deviceId: context.deviceId,
        billId,
        tableId: context.tableId,
        amount: NonNegativeInteger(40_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId: context.ibanAccountId,
          variableSymbol: VariableSymbol(reference),
          specificSymbol: null,
        },
      })
    )

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
    })

    expect(paymentId).toBe(ordinaryPaymentId)
    expect(await context.deps.evolu.loadQuery(selfPayRowsQuery)).toEqual([])
  })

  test("credits a third of a bill published by its totals only, marking no line paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: Array.from({ length: 60 }, (_, index) => ({
        name: `${index} ${"Ř".repeat(250)}`,
        amount: 1000,
      })),
    })
    const { bill, pointer } = await selectSelfPayTestShare(context, reference, {
      kind: "fractionOfBill",
      denominator: 3,
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 21_000,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(bill.lines).toEqual([])
    expect(await loadPayment(context, paymentId)).toMatchObject({
      amount: 21_000,
      tipAmount: 1000,
    })
    expect(
      await context.deps.evolu.loadQuery(
        selfPayAllocationsByBillIdQuery(billId)
      )
    ).toEqual([])
  })

  test("credits a late transfer to the closed bill, not the next one", async () => {
    await using context = await createSelfPayTestContext()
    const first = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: first.reference,
    })
    const next = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 30_000 }],
    })

    await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: first.reference,
    })

    expect(await loadCoverage(context, first.billId)).toMatchObject({
      claimedSum: 80_000,
      coverage: "overpaid",
    })
    expect(await loadCoverage(context, next.billId)).toMatchObject({
      claimedSum: 0,
      coverage: "underpaid",
    })
  })

  test.each([
    { days: 6, outcome: "is credited", claimedSum: 80_000 },
    { days: 8, outcome: "stays unmatched", claimedSum: 40_000 },
  ])(
    "a transfer $days days after close $outcome",
    async ({ days, claimedSum }) => {
      await using context = await createSelfPayTestContext()
      const { billId, reference } = await openSelfPayBill(context, {
        lines: [{ name: "Menu", amount: 40_000 }],
      })
      await receiveBankTransfer(context, {
        amount: 40_000,
        variableSymbol: reference,
      })

      await receiveBankTransfer(context, {
        amount: 40_000,
        variableSymbol: reference,
        occurredAt: addDays(context.clock.date.now(), days).getTime(),
      })

      expect((await loadCoverage(context, billId)).claimedSum).toBe(claimedSum)
    }
  )

  test("a transfer 8 days after a bill was canceled stays unmatched", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await using run = testCreateRun(context.deps)
    await run.orThrow(cancelBill(billId))

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 10_000,
      variableSymbol: reference,
      occurredAt: addDays(context.clock.date.now(), 8).getTime(),
    })

    expect(paymentId).toBe(null)
  })

  test("credits exactly what arrived with another bill's reference", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })

    await receiveBankTransfer(context, {
      amount: 100,
      variableSymbol: reference,
    })

    expect((await loadCoverage(context, billId)).claimedSum).toBe(100)
  })

  test.each([
    ["under one major unit", 99, undefined],
    ["an unknown reference", 10_000, "1000000001"],
    ["a reference that is no bill reference", 10_000, "123"],
  ])(
    "leaves money with %s unmatched",
    async (_name, amount, variableSymbol) => {
      await using context = await createSelfPayTestContext()
      const { billId, reference } = await openSelfPayBill(context, {
        lines: [{ name: "Menu", amount: 40_000 }],
      })

      const { accountTransactionId, paymentId } = await receiveBankTransfer(
        context,
        { amount, variableSymbol: variableSymbol ?? reference }
      )

      expect(paymentId).toBe(null)
      expect(
        await context.deps.evolu.loadQuery(
          claimsByTransactionQuery(accountTransactionId)
        )
      ).toEqual([])
      expect((await loadCoverage(context, billId)).claimedSum).toBe(0)
    }
  )

  test("never credits money sent back to a guest with the bill's reference", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: -10_000,
      variableSymbol: reference,
    })

    expect(paymentId).toBe(null)
    expect((await loadCoverage(context, billId)).claimedSum).toBe(0)
  })

  test("leaves a transfer in another currency than the bill unmatched", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 4000 }],
      currency: "EUR",
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 4000,
      variableSymbol: reference,
    })

    expect(paymentId).toBe(null)
    expect((await loadCoverage(context, billId)).claimedSum).toBe(0)
  })

  test("credits the last 0.40 CZK of a bill, the same way once it is recorded", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_040 }],
    })
    await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
    })

    const { accountTransactionId, paymentId } = await receiveBankTransfer(
      context,
      { amount: 40, variableSymbol: reference }
    )

    expect(paymentId).not.toBe(null)
    expect(await loadStatus(context, billId)).toBe("closed")
    await using run = testCreateRun(context.deps)
    const recordedAgain = await run.ok(
      loadSelfPayArrival({
        id: accountTransactionId,
        kind: "iban",
        accountId: context.ibanAccountId,
        amount: 40,
        currency: "CZK",
        occurredAt: context.clock.date.now().getTime(),
        variableSymbol: reference,
        recipientMessage: null,
        lnInvoice: null,
        paymentHash: null,
        firstSeenAt: context.clock.date.now().getTime(),
      })
    )
    expect(recordedAgain?.rows.payment.id).toBe(paymentId)
  })

  test("leaves 0.40 CZK unmatched once the bill is paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 40,
      variableSymbol: reference,
    })

    expect(paymentId).toBe(null)
    expect((await loadCoverage(context, billId)).claimedSum).toBe(40_000)
  })

  test("credits a transfer that arrives after self-pay was switched off", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await using run = testCreateRun(context.deps)
    await run.ok(updateTable({ id: context.tableId, selfPayEnabled: 0 }))

    await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
    })

    expect(await loadStatus(context, billId)).toBe("closed")
  })

  test("records two guests who each pay the whole remainder, leaving the bill overpaid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)

    for (const bankReference of ["guest-1", "guest-2"]) {
      await receiveBankTransfer(context, {
        amount: 40_000,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
        bankReference,
      })
    }

    expect(await context.deps.evolu.loadQuery(selfPayRowsQuery)).toHaveLength(2)
    expect(await loadCoverage(context, billId)).toMatchObject({
      claimedSum: 80_000,
      coverage: "overpaid",
    })
  })

  test("credits money for a canceled bill to that bill", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await using run = testCreateRun(context.deps)
    await run.orThrow(cancelBill(billId))

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 10_000,
      variableSymbol: reference,
    })

    expect(paymentId).not.toBe(null)
    expect((await loadCoverage(context, billId)).claimedSum).toBe(10_000)
  })

  test("leaves money naming a reference two bills share unmatched", async () => {
    await using context = await createSelfPayTestContext()
    const first = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const second = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    await runMutationWithCompletion((options) =>
      upsertBillSelfPayReferences(
        context.deps.evolu,
        [{ billId: second.billId, reference: first.reference }],
        { ...options, owner: context.deps.evoluOwner }
      )
    )

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: first.reference,
    })

    expect(paymentId).toBe(null)
  })

  test("does not offer a bill whose device is unknown", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
      deviceId: null,
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
    })

    expect(paymentId).toBe(null)
  })
})

describe("self-pay by Lightning", () => {
  test("credits a share at the rate the merchant published", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })

    const { paymentId } = await payByLightning(context, {
      reference,
      amount: 45_000,
      amountSats: 18_000,
    })

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(await loadPayment(context, paymentId)).toMatchObject({
      billId,
      deviceId: context.deviceId,
      amount: 45_000,
      tipAmount: 0,
      spark: {
        accountId: context.sparkAccountId,
        amountSats: 18_000,
        exchangeRate: 2_500_000,
        exchangeRateSource: "yadio",
      },
    })
    expect(await loadStatus(context, billId)).toBe("closed")
  })

  test("keeps what arrives above the share as the tip", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)

    const { paymentId } = await payByLightning(context, {
      reference,
      amount: 50_000,
      pointer,
      amountSats: 20_000,
    })

    if (paymentId === null) throw new Error("Expected a self-pay payment.")
    expect(await loadPayment(context, paymentId)).toMatchObject({
      amount: 50_000,
      tipAmount: 5000,
    })
    expect(await loadCoverage(context, billId)).toMatchObject({
      claimedSum: 45_000,
      coverage: "paid",
    })
  })

  test("settles Lightning money when Spark received it", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const rate = signTestSelfPayRate(context.clock.date.now())
    const receivedAt = TimestampMsSchema.decode((rate.validFrom + 120) * 1000)
    context.clock.advance(20 * 60_000)

    const { accountTransactionId } = await payByLightning(context, {
      reference,
      amount: 45_000,
      amountSats: 18_000,
      rate,
      occurredAt: receivedAt,
    })

    expect(
      await context.deps.evolu.loadQuery(
        claimsByTransactionQuery(accountTransactionId)
      )
    ).toMatchObject([{ claimedAt: receivedAt }])
  })

  test("credits a payment made 50 minutes after the last rate was published", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const rate = signTestSelfPayRate(context.clock.date.now())

    await payByLightning(context, {
      reference,
      amount: 45_000,
      amountSats: 18_000,
      rate,
      createdAt: rate.validFrom + 50 * 60,
    })

    expect((await loadCoverage(context, billId)).claimedSum).toBe(45_000)
  })

  test("credits no more than the money is worth", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 50_000 }],
    })

    await payByLightning(context, {
      reference,
      amount: 50_000,
      amountSats: 2000,
    })

    expect((await loadCoverage(context, billId)).claimedSum).toBe(5000)
  })

  test("credits the chosen amount, not the dust a sat adds on top", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_001 }],
    })

    await payByLightning(context, {
      reference,
      amount: 45_001,
      amountSats: 18_001,
    })

    expect(await loadCoverage(context, billId)).toMatchObject({
      claimedSum: 45_001,
      coverage: "paid",
    })
  })

  test.each([
    [
      "a forged rate",
      (rate: ReturnType<typeof signTestSelfPayRate>) => ({
        rate: { ...rate, msatPerMajor: rate.msatPerMajor / 2 },
      }),
    ],
    [
      "a rate whose window had ended",
      (rate: ReturnType<typeof signTestSelfPayRate>) => ({
        rate,
        createdAt: selfPayRateValidUntil(rate.validFrom) + 1,
      }),
    ],
    [
      "a rate not yet valid",
      (rate: ReturnType<typeof signTestSelfPayRate>) => ({
        rate,
        createdAt: rate.validFrom - 1,
      }),
    ],
    [
      "a rate signed for another currency",
      (rate: ReturnType<typeof signTestSelfPayRate>) => ({
        rate: signTestSelfPayRate(new Date(rate.validFrom * 1000), "EUR"),
      }),
    ],
  ])("leaves a payment naming %s unmatched", async (_name, forge) => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })

    const { paymentId } = await payByLightning(context, {
      reference,
      amount: 45_000,
      amountSats: 18_000,
      ...forge(signTestSelfPayRate(context.clock.date.now())),
    })

    expect(paymentId).toBe(null)
    expect((await loadCoverage(context, billId)).claimedSum).toBe(0)
  })

  test.each([
    [
      "credits",
      "paid within the invoice's ten minutes after the hour",
      69 * 60,
      true,
    ],
    [
      "leaves unmatched",
      "paid once those ten minutes are over",
      70 * 60 + 1,
      false,
    ],
  ])(
    "%s an invoice made in the rate's last minute and %s",
    async (_verb, _when, paidAfterSeconds, isCredited) => {
      await using context = await createSelfPayTestContext()
      const { reference } = await openSelfPayBill(context, {
        lines: [{ name: "Pizza", amount: 45_000 }],
      })
      const rate = signTestSelfPayRate(context.clock.date.now())
      context.clock.advance(paidAfterSeconds * 1000)

      const { paymentId } = await payByLightning(context, {
        reference,
        amount: 45_000,
        amountSats: 18_000,
        rate,
        createdAt: rate.validFrom + 59 * 60,
      })

      expect(paymentId !== null).toBe(isCredited)
    }
  )

  test("ignores a flood of one-satoshi payments", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })

    for (let payment = 0; payment < 20; payment++) {
      const { paymentId } = await payByLightning(context, {
        reference,
        amount: 45_000,
        amountSats: 1,
      })
      expect(paymentId).toBe(null)
    }
    expect((await loadCoverage(context, billId)).claimedSum).toBe(0)
  })

  test("credits the last 0.40 CZK of a bill by Lightning", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_040 }],
    })
    await receiveBankTransfer(context, {
      amount: 45_000,
      variableSymbol: reference,
    })

    const { paymentId } = await payByLightning(context, {
      reference,
      amount: 40,
      amountSats: 16,
    })

    expect(paymentId).not.toBe(null)
    expect(await loadStatus(context, billId)).toBe("closed")
  })

  test("credits 0.50 EUR on a euro bill, above the euro minimum", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 2000 }],
      currency: "EUR",
    })

    const { paymentId } = await payByLightning(context, {
      reference,
      amount: 50,
      amountSats: 20,
      rate: signTestSelfPayRate(context.clock.date.now(), "EUR"),
    })

    expect(paymentId).not.toBe(null)
    expect((await loadCoverage(context, billId)).claimedSum).toBe(50)
  })

  test("leaves Lightning to devices that hold the self-pay key", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { tableSelfPayRoot: _root, ...withoutRoot } = context.deps
    await using run = testCreateRun(withoutRoot)
    const rate = signTestSelfPayRate(context.clock.date.now())

    const reconciliation = await run.ok(
      loadAutomaticReconciliation(
        {
          accountId: context.sparkAccountId,
          amount: Integer(18_000),
          currency: "BTC",
          occurredAt: context.clock.date.now().getTime(),
          note: null,
          internalTransferGroupId: null,
          source: { deviceId: null, source: "auto" },
          spark: {
            sparkTransferId: NonEmptyStringSchema.decode("transfer"),
            lightning: {
              lnInvoice: NonEmptyStringSchema.decode(
                createTestLightningInvoice({
                  amountSats: 18_000,
                  createdAt: rate.validFrom,
                  memo: formatSelfPayLightningMemo({
                    reference,
                    pointer: unknownPointer,
                    amount: 45_000,
                    rate,
                  }),
                })
              ),
              preImage: null,
              paymentHash: null,
            },
          },
        },
        { id: "transaction" as AccountTransactionId, kind: "spark" }
      )
    )

    expect(reconciliation).toBe(null)
  })
})

const recordOnDevice = async (
  context: SelfPayTestContext,
  transfer: CreateAccountTransactionInput,
  minutesLater: number
) => {
  await using run = testCreateRun({
    ...context.deps,
    date: { now: () => new Date(Date.now() + minutesLater * 60_000) },
  })
  const reconciliation = await run.ok(
    loadAutomaticReconciliation(transfer, {
      id: "arrival-1" as AccountTransactionId,
      kind: transfer.iban === undefined ? "spark" : "iban",
    })
  )
  return {
    claim: reconciliation?.claim,
    selfPayPayment: reconciliation?.selfPayPayment,
    selfPayAllocations: reconciliation?.selfPayAllocations,
  }
}

describe("two devices recording one arrival", () => {
  test("write the same payment and settlement", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    const transfer = {
      accountId: context.ibanAccountId,
      amount: Integer(40_000),
      currency: "CZK" as const,
      occurredAt: context.clock.date.now().getTime(),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" as const },
      iban: {
        variableSymbol: VariableSymbol(reference),
        constantSymbol: null,
        specificSymbol: null,
        bankReference: NonEmptyString255("bank-1"),
        recipientMessage: NonEmptyStringSchema.decode(
          formatSelfPayBankMessage({ pointer })
        ),
      },
    }

    const first = await recordOnDevice(context, transfer, 0)
    const second = await recordOnDevice(context, transfer, 7)

    expect(first.selfPayPayment).not.toBe(null)
    expect(first.selfPayAllocations).toHaveLength(1)
    expect(second).toEqual({
      ...first,
      claim: { ...first.claim, claimedAt: expect.any(Number) },
    })
  })

  test("write the same Lightning payment and settlement", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    const rate = signTestSelfPayRate(context.clock.date.now())
    const transfer = {
      accountId: context.sparkAccountId,
      amount: Integer(18_000),
      currency: "BTC" as const,
      occurredAt: context.clock.date.now().getTime(),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" as const },
      spark: {
        sparkTransferId: NonEmptyStringSchema.decode("spark-1"),
        lightning: {
          lnInvoice: NonEmptyStringSchema.decode(
            createTestLightningInvoice({
              amountSats: 18_000,
              createdAt: rate.validFrom + 60,
              memo: formatSelfPayLightningMemo({
                reference,
                pointer,
                amount: 45_000,
                rate,
              }),
            })
          ),
          preImage: null,
          paymentHash: null,
        },
      },
    }

    const first = await recordOnDevice(context, transfer, 0)
    const second = await recordOnDevice(context, transfer, 7)

    expect(first.selfPayPayment).not.toBe(null)
    expect(second).toEqual(first)
  })
})

const staffPaymentMethods = ["cash", "card", "bank", "lightning"] as const

const takeStaffPayment = async (
  context: SelfPayTestContext,
  {
    billId,
    method,
    amount,
  }: {
    readonly billId: BillId
    readonly method: (typeof staffPaymentMethods)[number]
    readonly amount: number
  }
) => {
  await using run = testCreateRun({
    ...context.deps,
    ...createYadioApiDep(),
    fetch: async () =>
      new Response(
        JSON.stringify({
          BTC: 2_500_000,
          timestamp: context.clock.date.now().getTime(),
        })
      ),
    sparkWallet: {
      create: async () =>
        createFakeSparkWallet({
          createLightningInvoice: async ({ amountSats, memo }) => ({
            id: "lightning-request-1",
            invoice: {
              encodedInvoice: createTestLightningInvoice({
                amountSats,
                memo: memo ?? "",
                createdAt: Math.floor(
                  context.clock.date.now().getTime() / 1000
                ),
              }),
              paymentHash: "payment-hash-1",
            },
            paymentPreimage: "payment-preimage-1",
          }),
        }),
    },
    switchioTerminal: {
      pay: async () =>
        ok({
          responseCode: "OK",
          authCode: "114546",
          sequenceNumber: "001001614",
          maskedPan: "970348******3910",
          cardLabel: "Test Bank",
          terminalId: "TERMINAL1",
          terminalDateTime: "Jun 5, 2026 14:00:00",
          refundId: "123456789012345678",
        }),
    },
  })
  const paymentId = await run.orThrow(
    createPayment({
      deviceId: context.deviceId,
      billId,
      tableId: context.tableId,
      amount: NonNegativeInteger(amount),
      currency: "CZK",
      tipAmount: NonNegativeInteger(0),
      canceledAt: null,
      expiresAt: null,
    })
  )

  if (method === "cash") {
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Till"),
        cashRegister: { currency: "CZK" },
      })
    )
    await run.orThrow(
      preparePaymentMethod({ paymentId, cashRegister: { accountId } })
    )
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
  }
  if (method === "card") {
    await run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))
    const accountId = createCardSwitchioAccountId("CZK")
    await run.orThrow(preparePaymentMethod({ paymentId, card: { accountId } }))
    await run.orThrow(payPaymentWithSwitchioCard({ paymentId, accountId }))
  }
  if (method === "bank") {
    await run.orThrow(
      preparePaymentMethod({
        paymentId,
        bank: { accountId: context.ibanAccountId },
      })
    )
    const iban = (await loadPayment(context, paymentId))?.iban ?? null
    if (iban === null || iban.variableSymbol === null) {
      throw new Error("Expected a bank payment.")
    }
    await receiveBankTransfer(context, {
      amount,
      variableSymbol: iban.variableSymbol,
      specificSymbol: iban.specificSymbol,
    })
  }
  if (method === "lightning") {
    await run.orThrow(
      preparePaymentMethod({
        paymentId,
        spark: { accountId: context.sparkAccountId },
      })
    )
    const spark = (await loadPayment(context, paymentId))?.spark ?? null
    if (
      spark === null ||
      spark.amountSats === null ||
      spark.lnInvoice === null
    ) {
      throw new Error("Expected a Lightning payment.")
    }
    await receiveLightningPayment(context, {
      amountSats: spark.amountSats,
      lnInvoice: spark.lnInvoice,
    })
  }
  return paymentId
}

describe("several payments on one bill", () => {
  test.each(
    staffPaymentMethods.flatMap((staff) =>
      (["bank", "lightning"] as const).map((guest) => ({ staff, guest }))
    )
  )(
    "a guest pays by $guest what staff left after taking $staff",
    async ({ staff, guest }) => {
      await using context = await createSelfPayTestContext()
      const { billId, reference } = await openSelfPayBill(context, {
        lines: [{ name: "Menu", amount: 90_000 }],
      })

      const staffPaymentId = await takeStaffPayment(context, {
        billId,
        method: staff,
        amount: 40_000,
      })
      const { bill, pointer } = await selectSelfPayTestShare(context, reference)
      const { paymentId } =
        guest === "bank"
          ? await receiveBankTransfer(context, {
              amount: 50_000,
              variableSymbol: reference,
              recipientMessage: formatSelfPayBankMessage({ pointer }),
            })
          : await payByLightning(context, {
              reference,
              amount: 50_000,
              pointer,
              amountSats: 20_000,
            })

      expect(bill).toMatchObject({ covered: 40_000, remainder: 50_000 })
      expect(paymentId).not.toBe(staffPaymentId)
      expect(await context.deps.evolu.loadQuery(selfPayRowsQuery)).toEqual([
        { id: paymentId, pointer },
      ])
      expect(await loadCoverage(context, billId)).toMatchObject({
        claimedSum: 90_000,
        coverage: "paid",
      })
      expect(await loadStatus(context, billId)).toBe("closed")
    }
  )

  test.each(staffPaymentMethods)(
    "staff take by %s what a guest left",
    async (staff) => {
      await using context = await createSelfPayTestContext()
      const { billId, reference } = await openSelfPayBill(context, {
        lines: [{ name: "Menu", amount: 90_000 }],
      })
      const { pointer } = await selectSelfPayTestShare(context, reference, {
        kind: "amount",
        amount: 50_000,
      })
      await receiveBankTransfer(context, {
        amount: 50_000,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
      })

      await takeStaffPayment(context, { billId, method: staff, amount: 40_000 })

      expect(await loadCoverage(context, billId)).toMatchObject({
        claimedSum: 90_000,
        coverage: "paid",
      })
      expect(await loadStatus(context, billId)).toBe("closed")
    }
  )

  test("credits one guest by bank and another by Lightning with the lines each picked", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [
        { name: "Pizza", amount: 10_100 },
        { name: "Beer", amount: 4500 },
      ],
    })
    const [pizza, beer] = (await selectSelfPayTestShare(context, reference))
      .bill.lines
    if (pizza === undefined || beer === undefined) {
      throw new Error("Expected both lines.")
    }
    const pointerFor = async (key: string) =>
      (
        await selectSelfPayTestShare(context, reference, {
          kind: "lines",
          fractions: [{ key, numerator: 1, denominator: 1 }],
        })
      ).pointer

    await receiveBankTransfer(context, {
      amount: 10_100,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: await pointerFor(pizza.key),
      }),
    })
    await payByLightning(context, {
      reference,
      amount: 4500,
      pointer: await pointerFor(beer.key),
      amountSats: 1800,
    })

    expect(
      (
        await context.deps.evolu.loadQuery(
          selfPayAllocationsByBillIdQuery(billId)
        )
      ).map(({ lineKey, amount }) => ({ lineKey, amount }))
    ).toEqual(
      expect.arrayContaining([
        { lineKey: pizza.key, amount: 10_100 },
        { lineKey: beer.key, amount: 4500 },
      ])
    )
    expect(await loadStatus(context, billId)).toBe("closed")
  })

  test("settles a staff QR paid after a guest paid the whole bill, leaving it overpaid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 40_000 }],
    })
    const staffSymbol = "2026000001"
    await using run = testCreateRun(context.deps)
    const staffPaymentId = await run.orThrow(
      createPayment({
        deviceId: context.deviceId,
        billId,
        tableId: context.tableId,
        amount: NonNegativeInteger(40_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId: context.ibanAccountId,
          variableSymbol: VariableSymbol(staffSymbol),
          specificSymbol: null,
        },
      })
    )
    await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: reference,
    })

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 40_000,
      variableSymbol: staffSymbol,
    })

    expect(paymentId).toBe(staffPaymentId)
    expect(await loadCoverage(context, billId)).toMatchObject({
      claimedSum: 80_000,
      coverage: "overpaid",
    })
  })
})
