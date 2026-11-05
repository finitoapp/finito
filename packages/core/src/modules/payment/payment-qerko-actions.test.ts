import { testCreateRun } from "@evolu/common"
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
import { saveQerkoPlugin } from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { cancelPayment, createPayment, loadPayment } from "./payment-actions.ts"
import { preparePaymentMethod } from "./payment-preparation-actions.ts"
import {
  cancelQerkoTerminalPayment,
  qerkoUnknownAttemptGraceMs,
  startQerkoTerminalPayment,
  syncQerkoTerminalPayment,
} from "./payment-qerko-actions.ts"
import { paymentQerkoTerminalByIdQuery } from "./payment-queries.ts"
import {
  accountTransactionsByPaymentIdQuery,
  reconciliationClaimsByPaymentIdQuery,
} from "./payment-test-fixtures.ts"
import type { PaymentId } from "./payment-types.ts"

const terminalId = NonEmptyString255("terminal-1")
const accountId = createQerkoTerminalAccountId("CZK")

const rowQuery = (id: PaymentId) =>
  createQuery((db) =>
    db.selectFrom("paymentQerkoTerminal").selectAll().where("id", "=", id)
  )

const approved = (transactionId: string, chargedAmount = "129") => ({
  status: "approved",
  transactionId,
  currency: "CZK",
  amount: "129",
  chargedAmount,
  chargedTipAmount: "10",
  authorizationCode: "A1B2C3",
  card: { brand: "VISA", maskedPan: "************8902", entryMode: "chip" },
  receipt: {
    merchantId: "M1",
    terminalId: "ACQUIRER-TID",
    sequenceNumber: "42",
    terminalDateTime: "2026-06-05T14:00:00",
    refundId: "refund-1",
  },
})

type Handler = (body: Record<string, unknown>) => unknown

/** A Qerko that answers each endpoint from `handlers`; a throw is a dropped connection. */
const setup = async (handlers: Record<string, Handler>) => {
  const testEvolu = await createEvoluTest()
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  let uuidCounter = 0
  const deps = {
    ...evoluTestDeps(testEvolu.evolu),
    ...createTestDateDep(),
    ...createQerkoApiDep({ posId: "pos" }),
    // `preparePaymentMethod` declares the Spark and rate deps of its other
    // branches; the Qerko branch never reaches them.
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    uuid: {
      create: () =>
        `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`,
    },
    fetch: async (input, init) => {
      const path = String(input).split("/pos/")[1] ?? ""
      const body = JSON.parse(String(init?.body))
      requests.push({ path, body })
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
  const paymentId = await run.orThrow(
    createPayment({
      deviceId: null,
      billId: null,
      tableId: null,
      amount: NonNegativeInteger(12_900),
      currency: "CZK",
      tipAmount: NonNegativeInteger(1_000),
      canceledAt: null,
      expiresAt: null,
    })
  )
  await run.orThrow(
    preparePaymentMethod({ paymentId, qerkoTerminal: { accountId } })
  )

  return {
    evolu: testEvolu.evolu,
    run,
    requests,
    paymentId,
    advance: deps.advance,
    start: (input: { retryUnresolved?: boolean } = {}) =>
      run(
        startQerkoTerminalPayment({
          paymentId,
          accountId,
          terminalId,
          terminalTid: NonEmptyString255("TID-0001"),
          ...input,
        })
      ),
    sync: () => run(syncQerkoTerminalPayment({ paymentId })),
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

const started = (payment: unknown) => ({ type: "started", payment })
const pending = (transactionId: string) => ({
  status: "pending",
  transactionId,
  step: "waitingForCard",
})

describe("qerko terminal payment", () => {
  test("an approved payment settles what the card was charged, a terminal tip included", async () => {
    await using test = await setup({
      "create-terminal-payment": (body) =>
        started(pending(String(body.transactionId))),
      "get-terminal-payment-status": (body) => ({
        type: "found",
        payment: approved(String(body.transactionId), "139"),
      }),
    })

    await expect(test.start()).resolves.toEqual({
      ok: true,
      value: { status: "pending", step: "waitingForCard" },
    })
    // The payment keeps which terminal took it, and its TID for staff to read.
    await expect(
      test.evolu.loadQuery(paymentQerkoTerminalByIdQuery(test.paymentId))
    ).resolves.toMatchObject([
      { terminalId: "terminal-1", terminalTid: "TID-0001" },
    ])
    // Qerko takes the total with the tip in it, and the tip on its own.
    expect(test.requests[0]).toEqual({
      path: "create-terminal-payment",
      body: {
        terminalId: "terminal-1",
        transactionId: "00000000-0000-4000-8000-000000000001",
        amount: "129",
        currency: "CZK",
        tipAmount: "10",
        // The payment's number as a variable symbol.
        referenceId: "1",
      },
    })

    await expect(test.sync()).resolves.toEqual({
      ok: true,
      value: { status: "paid" },
    })

    await expect
      .poll(() =>
        test.evolu.loadQuery(
          accountTransactionsByPaymentIdQuery(test.paymentId)
        )
      )
      .toMatchObject([
        { accountId, kind: "qerkoTerminal", amount: 13_900, currency: "CZK" },
      ])
    await expect
      .poll(() =>
        test.evolu.loadQuery(
          reconciliationClaimsByPaymentIdQuery(test.paymentId)
        )
      )
      .toHaveLength(1)
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([
        {
          terminalId: "terminal-1",
          pendingTransactionId: null,
          unresolvedTransactionId: null,
          qerkoRefundId: "refund-1",
          authorizationCode: "A1B2C3",
          cardBrand: "VISA",
          maskedPan: "************8902",
          entryMode: "chip",
          sequenceNumber: "42",
          merchantId: "M1",
          chargedTipAmount: 1_000,
        },
      ])
  }, 15_000)

  test("a declined card settles nothing and frees the payment for another try", async () => {
    await using test = await setup({
      "create-terminal-payment": (body) =>
        started(pending(String(body.transactionId))),
      "get-terminal-payment-status": (body) => ({
        type: "found",
        payment: {
          status: "failed",
          transactionId: body.transactionId,
          reason: "declined",
        },
      }),
    })
    await test.start()

    await expect(test.sync()).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoTerminalPaymentFailed", reason: "declined" },
    })

    await expect(
      test.evolu.loadQuery(accountTransactionsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])
    // The reason stays on the row, so any device can say why.
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([
        {
          pendingTransactionId: null,
          unresolvedTransactionId: null,
          failureReason: "declined",
        },
      ])
    await expect(test.start()).resolves.toMatchObject({ ok: true })
    // A new attempt starts without the old reason.
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([{ failureReason: null }])
  }, 15_000)

  test("an unknown result is unresolved and needs a confirmed retry", async () => {
    await using test = await setup({
      "create-terminal-payment": (body) =>
        started(pending(String(body.transactionId))),
      "get-terminal-payment-status": (body) => ({
        type: "found",
        payment: { status: "unknown", transactionId: body.transactionId },
      }),
    })
    await test.start()

    await expect(test.sync()).resolves.toEqual({
      ok: true,
      value: { status: "unresolved" },
    })
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([
        {
          pendingTransactionId: null,
          unresolvedTransactionId: "00000000-0000-4000-8000-000000000001",
        },
      ])

    await expect(test.start()).resolves.toMatchObject({
      ok: false,
      error: {
        type: "QerkoAttemptUnresolved",
        transactionId: "00000000-0000-4000-8000-000000000001",
      },
    })
    // Refused before Qerko was asked again.
    expect(
      test.requests.filter((r) => r.path === "create-terminal-payment")
    ).toHaveLength(1)

    await expect(test.start({ retryUnresolved: true })).resolves.toMatchObject({
      ok: true,
    })
    expect(
      test.requests.filter((r) => r.path === "create-terminal-payment")
    ).toHaveLength(2)
  }, 15_000)

  test("a dropped connection leaves the attempt pending, and a poll that finds nothing ends it without money", async () => {
    let reachable = false
    await using test = await setup({
      "create-terminal-payment": () => {
        throw new Error("offline")
      },
      "get-terminal-payment-status": () =>
        reachable ? { type: "unknownTransaction" } : {},
    })

    await expect(test.start()).resolves.toMatchObject({
      ok: false,
      error: { type: "FetchError" },
    })
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([
        { pendingTransactionId: "00000000-0000-4000-8000-000000000001" },
      ])
    // Another attempt is refused while that one may still be on the terminal.
    await expect(test.start()).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoAttemptUnresolved" },
    })

    reachable = true
    // Within the grace period the starting request may still be on its way,
    // so a device that polls first leaves the attempt alone.
    await expect(test.sync()).resolves.toEqual({
      ok: true,
      value: { status: "pending", step: "connecting" },
    })
    await expect(
      test.evolu.loadQuery(rowQuery(test.paymentId))
    ).resolves.toMatchObject([
      { pendingTransactionId: "00000000-0000-4000-8000-000000000001" },
    ])

    test.advance(qerkoUnknownAttemptGraceMs)
    await expect(test.sync()).resolves.toEqual({
      ok: true,
      value: { status: "idle" },
    })
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([{ pendingTransactionId: null }])
    await expect(
      test.evolu.loadQuery(accountTransactionsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])
  }, 15_000)

  test.each([
    ["terminalBusy", null],
    ["upstreamTimeout", "00000000-0000-4000-8000-000000000001"],
  ])(
    "a refusal to start (%s) clears the attempt, unless it may have reached the terminal",
    async (reason, unresolved) => {
      await using test = await setup({
        "create-terminal-payment": () => ({ type: reason }),
      })

      await expect(test.start()).resolves.toMatchObject({
        ok: false,
        error: { type: "QerkoTerminalNotStarted", reason },
      })

      await expect
        .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
        .toMatchObject([
          { pendingTransactionId: null, unresolvedTransactionId: unresolved },
        ])
    },
    15_000
  )

  test("an approval that arrives after the payment was canceled still records the money", async () => {
    await using test = await setup({
      "create-terminal-payment": (body) =>
        started(pending(String(body.transactionId))),
      "get-terminal-payment-status": (body) => ({
        type: "found",
        payment: approved(String(body.transactionId)),
      }),
    })
    await test.start()
    await test.run.orThrow(cancelPayment(test.paymentId))
    await expect
      .poll(
        async () =>
          (await test.run.orThrow(loadPayment(test.paymentId))).canceledAt
      )
      .not.toBeNull()

    await expect(test.sync()).resolves.toEqual({
      ok: true,
      value: { status: "paid" },
    })

    await expect
      .poll(() =>
        test.evolu.loadQuery(
          accountTransactionsByPaymentIdQuery(test.paymentId)
        )
      )
      .toMatchObject([{ accountId, kind: "qerkoTerminal", amount: 12_900 }])
  }, 15_000)

  test("asks Qerko to cancel the pending attempt", async () => {
    await using test = await setup({
      "create-terminal-payment": (body) =>
        started(pending(String(body.transactionId))),
      "cancel-terminal-payment": () => ({ type: "cancelling" }),
    })
    await test.start()

    await expect(
      test.run(cancelQerkoTerminalPayment(test.paymentId))
    ).resolves.toEqual({ ok: true, value: "cancelling" })
    expect(test.requests.at(-1)).toEqual({
      path: "cancel-terminal-payment",
      body: { transactionId: "00000000-0000-4000-8000-000000000001" },
    })
  }, 15_000)

  test("refuses to start without a pairing", async () => {
    await using test = await setup({})
    await test.run.ok(
      (
        await import("../qerko-plugin/qerko-plugin-actions.ts")
      ).deleteQerkoPlugin("terminalPayments")
    )
    await expect
      .poll(() =>
        test.run(
          startQerkoTerminalPayment({
            paymentId: test.paymentId,
            accountId,
            terminalId,
          })
        )
      )
      .toMatchObject({ ok: false, error: { type: "QerkoPluginNotPaired" } })
  }, 15_000)
})
