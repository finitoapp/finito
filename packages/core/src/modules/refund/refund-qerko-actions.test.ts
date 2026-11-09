import { sqliteFalse, sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep, FetchDep, UuidDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import {
  createQerkoApiDep,
  type QerkoApiDep,
} from "../../integrations/qerko/qerko-client.ts"
import {
  createYadioApiDep,
  type YadioApiDep,
} from "../../integrations/yadio/yadio-client.ts"
import type { SparkWalletDep } from "../../spark/spark-wallet.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveQerkoTerminalAccount } from "../account/account-actions.ts"
import { createQerkoTerminalAccountId } from "../account/account-utils.ts"
import { addCatalogItemToBill, createBill } from "../bill/bill-actions.ts"
import type { BillId } from "../bill/bill-types.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import {
  createPayment,
  markPaymentPaidCash,
} from "../payment/payment-actions.ts"
import { preparePaymentMethod } from "../payment/payment-preparation-actions.ts"
import {
  startQerkoTerminalPayment,
  syncQerkoTerminalPayment,
} from "../payment/payment-qerko-actions.ts"
import {
  accountTransactionsByPaymentIdQuery,
  createPaymentAccounts,
} from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { saveQerkoPlugin } from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import { refundPayment, tipRefundId } from "./refund-actions.ts"
import {
  dismissQerkoTerminalRefundAttempt,
  repairQerkoTerminalTipRefunds,
  startQerkoTerminalRefund,
  syncQerkoTerminalRefund,
} from "./refund-qerko-actions.ts"
import {
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "./refund-queries.ts"

const accountId = createQerkoTerminalAccountId("CZK")
const terminalId = NonEmptyString255("terminal-1")

type Handler = (body: Record<string, unknown>) => unknown

const approvedPayment = (transactionId: string, charged: string) => ({
  status: "approved",
  transactionId,
  currency: "CZK",
  amount: charged,
  chargedAmount: charged,
  chargedTipAmount: "0",
  authorizationCode: "A1",
  card: { brand: "VISA", maskedPan: "****1234", entryMode: "chip" },
  receipt: {
    merchantId: "M1",
    terminalId: "T1",
    sequenceNumber: "1",
    terminalDateTime: null,
    refundId: "refund-1",
  },
})

const refundResponse = (status: string, transactionId: unknown) => ({
  status,
  transactionId,
  ...(status === "pending" ? { step: "waitingForCard" } : {}),
  ...(status === "failed" ? { reason: "declined" } : {}),
})

/** A paid Qerko payment of `amount`, with a Qerko that answers refunds from `handlers`. */
const setup = async ({
  amount = 25_000,
  tipAmount = 0,
  withBill = false,
  handlers,
}: {
  readonly amount?: number
  readonly tipAmount?: number
  readonly withBill?: boolean
  readonly handlers: Record<string, Handler>
}) => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  const clock = createTestDateDep()
  let uuid = 0
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
    ...createQerkoApiDep({ posId: "pos" }),
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    uuid: {
      create: () =>
        `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).split("/pos/")[1] ?? ""
      const body = JSON.parse(String(init?.body))
      requests.push({ path, body })
      if (path === "create-terminal-payment") {
        return Response.json({
          type: "started",
          payment: {
            status: "pending",
            transactionId: body.transactionId,
            step: "waitingForCard",
          },
        })
      }
      if (path === "get-terminal-payment-status") {
        return Response.json({
          type: "found",
          payment: approvedPayment(
            String(body.transactionId),
            String(amount / 100 + tipAmount / 100 - tipAmount / 100)
          ),
        })
      }
      const handler = handlers[path]
      if (handler === undefined) throw new Error(`unexpected ${path}`)
      return Response.json(handler(body))
    },
  } satisfies EvoluDep &
    EvoluOwnerDep &
    DateDep &
    QerkoApiDep &
    FetchDep &
    UuidDep &
    SparkWalletDep &
    YadioApiDep
  const run = testCreateRun(deps)

  await run.ok(
    saveQerkoPlugin({
      role: "terminalPayments",
      environment: "sandbox",
      apiKey: NonEmptyStringSchema.decode("secret"),
      apiKeyName: NonEmptyString255("Payky"),
      legalEntityName: NonEmptyString255("Cafe"),
      identificationNumber: NonEmptyString255("12345678"),
      country: "CZ",
    })
  )
  await run.ok(saveQerkoTerminalAccount({ enabled: true, currency: "CZK" }))

  let billId: BillId | null = null
  if (withBill) {
    billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const catalogItemId = await run.ok(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Beer"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(12_500),
        sortOrder: NonNegativeInteger(0),
        scanCode: null,
      })
    )
    await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(2),
      })
    )
  }

  const paymentId = await run.orThrow(
    createPayment({
      deviceId: null,
      billId,
      tableId: null,
      amount: NonNegativeInteger(amount),
      currency: "CZK",
      tipAmount: NonNegativeInteger(tipAmount),
      canceledAt: null,
      expiresAt: null,
    })
  )
  await run.orThrow(
    preparePaymentMethod({ paymentId, qerkoTerminal: { accountId } })
  )
  await run(startQerkoTerminalPayment({ paymentId, accountId, terminalId }))
  await run(syncQerkoTerminalPayment({ paymentId }))
  await expect
    .poll(() => evolu.loadQuery(accountTransactionsByPaymentIdQuery(paymentId)))
    .toHaveLength(1)

  return {
    evolu,
    run,
    deps,
    clock,
    requests,
    paymentId,
    refundRequests: () =>
      requests.filter(({ path }) => path === "create-terminal-refund"),
    startAmount: (amount: number) =>
      run(
        startQerkoTerminalRefund({
          paymentId,
          deviceId: null,
          amount: NonNegativeInteger(amount),
        })
      ),
    attempts: () =>
      evolu.loadQuery(qerkoTerminalRefundAttemptsByPaymentIdQuery(paymentId)),
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

const refundTransactionsQuery = (accountId: unknown) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .select(["amount", "kind"])
      .where("accountId", "=", accountId as never)
  )

describe("refund to the card through Qerko", () => {
  test("records the refund and the money going out once the terminal approves", async () => {
    await using test = await setup({
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("pending", body.transactionId),
        }),
        "get-terminal-refund-status": (body) => ({
          type: "found",
          refund: refundResponse("approved", body.transactionId),
        }),
      },
    })

    await expect(test.startAmount(10_000)).resolves.toEqual({
      ok: true,
      value: { status: "pending", step: "waitingForCard" },
    })
    // The refund id Qerko wants is the one the payment's receipt handed out.
    expect(test.refundRequests()[0]?.body).toMatchObject({
      terminalId: "terminal-1",
      refundId: "refund-1",
      amount: "100",
      currency: "CZK",
    })
    // Nothing is a refund until the terminal approved.
    await expect(
      test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])
    const [attempt] = await test.attempts()
    if (attempt === undefined) throw new Error("Expected an attempt.")

    await expect(
      test.run(syncQerkoTerminalRefund(attempt.id))
    ).resolves.toEqual({
      ok: true,
      value: { status: "refunded" },
    })

    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toMatchObject([
        { id: attempt.id, amount: 10_000, method: "qerkoTerminal" },
      ])
    await expect
      .poll(async () =>
        (await test.evolu.loadQuery(refundTransactionsQuery(accountId))).filter(
          ({ amount }) => amount !== null && amount < 0
        )
      )
      .toMatchObject([{ amount: -10_000, kind: "qerkoTerminal" }])
    await expect.poll(() => test.attempts()).toEqual([])
  }, 20_000)

  test("what was refunded is no longer refundable", async () => {
    await using test = await setup({
      amount: 10_000,
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("approved", body.transactionId),
        }),
      },
    })
    await expect(test.startAmount(10_000)).resolves.toEqual({
      ok: true,
      value: { status: "refunded" },
    })
    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toHaveLength(1)

    await expect(test.startAmount(100)).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid", remainingAmount: 0 },
    })
  }, 20_000)

  test("refunds goods lines and records them beside the refund", async () => {
    await using test = await setup({
      withBill: true,
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("approved", body.transactionId),
        }),
      },
    })
    const [beer] = await test.evolu.loadQuery(
      refundablePaymentLinesQuery(test.paymentId)
    )
    if (beer === undefined) throw new Error("Expected the beer line.")

    await expect(
      test.run(
        startQerkoTerminalRefund({
          paymentId: test.paymentId,
          deviceId: null,
          lines: [{ paymentLineId: beer.id, quantity: PositiveNumber(1) }],
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "refunded" } })

    await expect
      .poll(() =>
        test.evolu.loadQuery(refundLinesByPaymentIdQuery(test.paymentId))
      )
      .toMatchObject([{ name: "Beer", quantity: 1, amount: 12_500 }])
    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toMatchObject([{ amount: 12_500, method: "qerkoTerminal" }])
  }, 20_000)

  test("a declined refund is kept to be shown and does not block another try", async () => {
    await using test = await setup({
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("pending", body.transactionId),
        }),
        "get-terminal-refund-status": (body) => ({
          type: "found",
          refund: refundResponse("failed", body.transactionId),
        }),
      },
    })
    await test.startAmount(5_000)
    const [attempt] = await test.attempts()
    if (attempt === undefined) throw new Error("Expected an attempt.")

    await expect(
      test.run(syncQerkoTerminalRefund(attempt.id))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoTerminalRefundFailed", reason: "declined" },
    })
    await expect
      .poll(() => test.attempts())
      .toMatchObject([{ status: "failed", failureReason: "declined" }])
    await expect(
      test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])

    await expect(test.startAmount(5_000)).resolves.toMatchObject({ ok: true })
    // The old no is gone; only the new attempt is left.
    await expect.poll(() => test.attempts()).toHaveLength(1)
  }, 20_000)

  test("an unknown result blocks another refund until staff dismiss it", async () => {
    await using test = await setup({
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("pending", body.transactionId),
        }),
        "get-terminal-refund-status": (body) => ({
          type: "found",
          refund: refundResponse("unknown", body.transactionId),
        }),
      },
    })
    await test.startAmount(5_000)
    const [attempt] = await test.attempts()
    if (attempt === undefined) throw new Error("Expected an attempt.")
    await expect(
      test.run(syncQerkoTerminalRefund(attempt.id))
    ).resolves.toEqual({
      ok: true,
      value: { status: "unresolved" },
    })

    await expect
      .poll(() => test.startAmount(5_000))
      .toMatchObject({
        ok: false,
        error: { type: "QerkoRefundAttemptRunning", refundId: attempt.id },
      })
    expect(test.refundRequests()).toHaveLength(1)

    await test.run.ok(dismissQerkoTerminalRefundAttempt(attempt.id))
    await expect.poll(() => test.startAmount(5_000)).toMatchObject({ ok: true })
  }, 20_000)

  test("a refusal to start leaves nothing behind", async () => {
    await using test = await setup({
      handlers: { "create-terminal-refund": () => ({ type: "terminalBusy" }) },
    })

    await expect(test.startAmount(5_000)).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoTerminalRefundNotStarted", reason: "terminalBusy" },
    })

    await expect.poll(() => test.attempts()).toEqual([])
  }, 20_000)

  test("the refund goes to the terminal that took the payment and needs one on record", async () => {
    await using test = await setup({
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("pending", body.transactionId),
        }),
      },
    })

    // Nothing the device chose since the payment takes part: the action is
    // given no terminal, so the one on the payment's row is the only source.
    await test.startAmount(1_000)
    expect(test.refundRequests()[0]?.body).toMatchObject({
      terminalId: "terminal-1",
    })

    await using without = await setup({ handlers: {} })
    without.evolu.update("paymentQerkoTerminal", {
      id: without.paymentId,
      terminalId: null,
    })
    await expect(without.startAmount(1_000)).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoRefundNotAvailable" },
    })
    expect(without.refundRequests()).toHaveLength(0)
  }, 20_000)

  test("a payment that was not taken through Qerko cannot be refunded to the card", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      ...createQerkoApiDep({ posId: "pos" }),
      uuid: { create: () => "00000000-0000-4000-8000-000000000001" },
      fetch: async () => {
        throw new Error("Qerko must not be asked")
      },
    }
    await using run = testCreateRun(deps)
    const accounts = await createPaymentAccounts(deps)
    await run.ok(
      saveQerkoPlugin({
        role: "terminalPayments",
        environment: "sandbox",
        apiKey: NonEmptyStringSchema.decode("secret"),
        apiKeyName: NonEmptyString255("Payky"),
        legalEntityName: NonEmptyString255("Cafe"),
        identificationNumber: NonEmptyString255("12345678"),
        country: "CZ",
      })
    )
    const paymentId: PaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(5_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: accounts.cashRegisterAccountId },
      })
    )
    await run.orThrow(
      markPaymentPaidCash({
        paymentId,
        accountId: accounts.cashRegisterAccountId,
        receivedAmount: NonNegativeInteger(5_000),
      })
    )

    await expect(
      run(
        startQerkoTerminalRefund({
          paymentId,
          deviceId: null,
          amount: NonNegativeInteger(1_000),
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoRefundNotAvailable" },
    })
    // The same refund by hand is still possible, and records no card movement.
    await expect(
      run(
        refundPayment({
          paymentId,
          method: "cashRegister",
          deviceId: null,
          amount: NonNegativeInteger(1_000),
        })
      )
    ).resolves.toMatchObject({ ok: true })
  }, 20_000)
})

describe("refund of the whole payment to the card through Qerko", () => {
  const pendingThenApproved = {
    "create-terminal-refund": (body: Record<string, unknown>) => ({
      type: "started",
      refund: refundResponse("pending", body.transactionId),
    }),
    "get-terminal-refund-status": (body: Record<string, unknown>) => ({
      type: "found",
      refund: refundResponse("approved", body.transactionId),
    }),
  }
  const startWhole = (test: Awaited<ReturnType<typeof setup>>) =>
    test.run(
      startQerkoTerminalRefund({
        paymentId: test.paymentId,
        deviceId: null,
        whole: true,
      })
    )
  const negativeTransactions = async (
    test: Awaited<ReturnType<typeof setup>>
  ) =>
    (await test.evolu.loadQuery(refundTransactionsQuery(accountId))).filter(
      ({ amount }) => amount !== null && amount < 0
    )

  test("asks the terminal once for the goods and the tip and records them as two refunds", async () => {
    await using test = await setup({
      amount: 25_000,
      tipAmount: 2_000,
      handlers: pendingThenApproved,
    })

    await expect(startWhole(test)).resolves.toMatchObject({
      ok: true,
      value: { status: "pending" },
    })
    expect(test.refundRequests()).toHaveLength(1)
    expect(test.refundRequests()[0]?.body).toMatchObject({ amount: "250" })
    const [attempt] = await test.attempts()
    expect(attempt).toMatchObject({
      amount: 23_000,
      tipAmount: 2_000,
      isTip: null,
    })
    if (attempt === undefined) throw new Error("Expected an attempt.")

    await expect(
      test.run(syncQerkoTerminalRefund(attempt.id))
    ).resolves.toEqual({ ok: true, value: { status: "refunded" } })

    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toHaveLength(2)
    await expect(
      test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: attempt.id,
          amount: 23_000,
          method: "qerkoTerminal",
          isTip: null,
        }),
        expect.objectContaining({
          id: tipRefundId(test.paymentId),
          amount: 2_000,
          method: "qerkoTerminal",
          isTip: sqliteTrue,
        }),
      ])
    )
    await expect(negativeTransactions(test)).resolves.toEqual(
      expect.arrayContaining([
        { amount: -23_000, kind: "qerkoTerminal" },
        { amount: -2_000, kind: "qerkoTerminal" },
      ])
    )
    // The tip is written: nothing to repair.
    await expect(test.run(repairQerkoTerminalTipRefunds())).resolves.toEqual({
      ok: true,
      value: 0,
    })
    await expect(startWhole(test)).resolves.toMatchObject({
      ok: false,
      error: { type: "RefundAmountInvalid", remainingAmount: 0 },
    })
    expect(test.refundRequests()).toHaveLength(1)
  }, 20_000)

  test("a payment without a tip refunds only its goods", async () => {
    await using test = await setup({
      amount: 10_000,
      handlers: pendingThenApproved,
    })

    await startWhole(test)
    const [attempt] = await test.attempts()
    expect(attempt).toMatchObject({ amount: 10_000, tipAmount: null })
    if (attempt === undefined) throw new Error("Expected an attempt.")
    await test.run(syncQerkoTerminalRefund(attempt.id))

    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toMatchObject([{ id: attempt.id, amount: 10_000, isTip: null }])
  }, 20_000)

  test("with only the tip left, refunds the tip as the tip", async () => {
    await using test = await setup({
      amount: 25_000,
      tipAmount: 2_000,
      handlers: pendingThenApproved,
    })
    await test.run.orThrow(
      refundPayment({
        paymentId: test.paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(23_000),
      })
    )

    await startWhole(test)
    expect(test.refundRequests()[0]?.body).toMatchObject({ amount: "20" })
    const [attempt] = await test.attempts()
    expect(attempt).toMatchObject({
      id: tipRefundId(test.paymentId),
      amount: 2_000,
      tipAmount: null,
      isTip: sqliteTrue,
    })
    if (attempt === undefined) throw new Error("Expected an attempt.")
    await test.run(syncQerkoTerminalRefund(attempt.id))

    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toMatchObject([
        { amount: 23_000, method: "outside" },
        { id: attempt.id, amount: 2_000, isTip: sqliteTrue },
      ])
  }, 20_000)

  test("the tip an older version left out when it settled the attempt is written once", async () => {
    await using test = await setup({
      amount: 25_000,
      tipAmount: 2_000,
      handlers: pendingThenApproved,
    })
    await startWhole(test)
    const [attempt] = await test.attempts()
    if (attempt === undefined) throw new Error("Expected an attempt.")

    // What a version that knows no `tipAmount` writes on approval: the
    // goods' refund and money, and the attempt taken away.
    await runMutationWithCompletion((options) => {
      test.evolu.upsert(
        "refund",
        {
          id: attempt.id,
          paymentId: test.paymentId,
          deviceId: null,
          amount: attempt.amount,
          currency: "CZK",
          method: "qerkoTerminal",
          refundedAt: attempt.startedAt,
          isDeleted: sqliteFalse,
        },
        options
      )
      test.evolu.update(
        "qerkoTerminalRefundAttempt",
        { id: attempt.id, isDeleted: sqliteTrue },
        options
      )
    })
    await expect(
      test.run(syncQerkoTerminalRefund(attempt.id))
    ).resolves.toEqual({ ok: true, value: { status: "idle" } })

    await expect(test.run(repairQerkoTerminalTipRefunds())).resolves.toEqual({
      ok: true,
      value: 1,
    })
    await expect(test.run(repairQerkoTerminalTipRefunds())).resolves.toEqual({
      ok: true,
      value: 0,
    })

    await expect(
      test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId))
    ).resolves.toMatchObject([
      { id: attempt.id, amount: 23_000, isTip: null },
      {
        id: tipRefundId(test.paymentId),
        amount: 2_000,
        method: "qerkoTerminal",
        refundedAt: attempt.startedAt,
        isTip: sqliteTrue,
      },
    ])
    await expect(negativeTransactions(test)).resolves.toEqual([
      { amount: -2_000, kind: "qerkoTerminal" },
    ])
  }, 20_000)

  test("a dismissed attempt was never approved and needs no repair", async () => {
    await using test = await setup({
      amount: 25_000,
      tipAmount: 2_000,
      handlers: {
        "create-terminal-refund": (body) => ({
          type: "started",
          refund: refundResponse("pending", body.transactionId),
        }),
        "get-terminal-refund-status": (body) => ({
          type: "found",
          refund: refundResponse("unknown", body.transactionId),
        }),
      },
    })
    await startWhole(test)
    const [attempt] = await test.attempts()
    if (attempt === undefined) throw new Error("Expected an attempt.")
    await test.run(syncQerkoTerminalRefund(attempt.id))
    await test.run.ok(dismissQerkoTerminalRefundAttempt(attempt.id))

    await expect(test.run(repairQerkoTerminalTipRefunds())).resolves.toEqual({
      ok: true,
      value: 0,
    })
    await expect(
      test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])
  }, 20_000)
})
