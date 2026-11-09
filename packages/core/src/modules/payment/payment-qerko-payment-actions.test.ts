import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import {
  createQerkoApiDep,
  type QerkoApiDep,
} from "../../integrations/qerko/qerko-client.ts"
import type { QerkoWirePayment } from "../../integrations/qerko/qerko-rpc.ts"
import {
  createYadioApiDep,
  type YadioApiDep,
} from "../../integrations/yadio/yadio-client.ts"
import type { SparkWalletDep } from "../../spark/spark-wallet.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveQerkoPaymentAccount } from "../account/account-actions.ts"
import { createQerkoPaymentAccountId } from "../account/account-utils.ts"
import { saveQerkoPlugin } from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { cancelPayment, createPayment } from "./payment-actions.ts"
import { preparePaymentMethod } from "./payment-preparation-actions.ts"
import {
  processQerkoPayment,
  resolveQerkoBill,
  settleQerkoPayment,
  startQerkoPayment,
} from "./payment-qerko-payment-actions.ts"
import { qerkoPaymentAttemptsByPaymentIdQuery } from "./payment-queries.ts"
import {
  accountTransactionsByPaymentIdQuery,
  reconciliationClaimsByPaymentIdQuery,
} from "./payment-test-fixtures.ts"
import type { PaymentId } from "./payment-types.ts"

const accountId = createQerkoPaymentAccountId("CZK")

const setup = async ({
  getPayment,
}: {
  readonly getPayment?: (body: Record<string, unknown>) => unknown
} = {}) => {
  const testEvolu = await createEvoluTest()
  const requests: string[] = []
  const deps = {
    ...evoluTestDeps(testEvolu.evolu),
    ...createTestDateDep(),
    ...createQerkoApiDep({ posId: "pos" }),
    // `preparePaymentMethod` declares the Spark and rate deps of its other
    // branches; the Qerko branch never reaches them.
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    fetch: async (input, init) => {
      const path = String(input).split("/pos/")[1] ?? ""
      requests.push(path)
      if (path !== "get-payment" || getPayment === undefined) {
        throw new Error(`unexpected ${path}`)
      }
      return Response.json(getPayment(JSON.parse(String(init?.body))))
    },
  } satisfies EvoluDep &
    EvoluOwnerDep &
    DateDep &
    QerkoApiDep &
    FetchDep &
    SparkWalletDep &
    YadioApiDep
  const run = testCreateRun(deps)

  await run.ok(
    saveQerkoPlugin({
      role: "standard",
      environment: "sandbox",
      apiKey: NonEmptyStringSchema.decode("secret"),
      apiKeyName: NonEmptyString255("Payky"),
      legalEntityName: NonEmptyString255("Cafe"),
      identificationNumber: NonEmptyString255("12345678"),
      country: "CZ",
      restaurantId: NonEmptyString255("restaurant-1"),
    })
  )
  await run.ok(saveQerkoPaymentAccount({ enabled: true, currency: "CZK" }))

  const createQerkoPayment = async ({ prepare = true } = {}) => {
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )
    if (prepare) {
      await run.orThrow(
        preparePaymentMethod({ paymentId, qerkoPayment: { accountId } })
      )
    }
    return paymentId
  }

  const paymentId = await createQerkoPayment()

  const attempts = (id: PaymentId = paymentId) =>
    testEvolu.evolu.loadQuery(qerkoPaymentAttemptsByPaymentIdQuery(id))

  return {
    run,
    requests,
    paymentId,
    createQerkoPayment,
    attempts,
    advance: deps.advance,
    claims: (id: PaymentId = paymentId) =>
      testEvolu.evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id)),
    transactions: (id: PaymentId = paymentId) =>
      testEvolu.evolu.loadQuery(accountTransactionsByPaymentIdQuery(id)),
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

const wire = (
  id: string,
  idBill: string,
  overrides: Partial<QerkoWirePayment> = {}
): QerkoWirePayment => ({
  id,
  idBill,
  currency: "CZK",
  state: "STARTED",
  items: [{ name: "Platba #1", price: "129.5", quantity: "1" }],
  parts: [
    { provider: { id: "qerko", name: "Card", type: "CARD" }, total: "100" },
    {
      provider: { id: "edenred", name: "Ticket", type: "MEAL_TICKET" },
      total: "29.5",
    },
  ],
  discount: null,
  ...overrides,
})

describe("resolveQerkoBill", () => {
  test("offers the payment as one line, paid at once, without tip or discount", async () => {
    await using test = await setup()

    const result = await test.run(resolveQerkoBill(test.paymentId))

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: test.paymentId,
        currency: "CZK",
        items: [
          {
            price: "129.5",
            quantity: "1",
            minQuantity: "0",
            name: expect.stringMatching(/^Platba/),
          },
        ],
        allowPartialPayment: false,
        allowTip: false,
        denyDiscounts: true,
        denyMenus: true,
      },
    })
  })

  test("knows no payment that was not offered through Qerko", async () => {
    await using test = await setup()
    const other = await test.createQerkoPayment({ prepare: false })

    for (const id of ["not-an-id", other]) {
      expect(await test.run(resolveQerkoBill(id))).toMatchObject({
        ok: false,
        error: { type: "QerkoBillNotFound" },
      })
    }
  })

  test("a payment no longer waiting is a closed bill", async () => {
    await using test = await setup()
    await test.run.orThrow(cancelPayment(test.paymentId))

    expect(await test.run(resolveQerkoBill(test.paymentId))).toMatchObject({
      ok: false,
      error: { type: "QerkoBillClosed" },
    })
  })
})

describe("startQerkoPayment", () => {
  test("records the attempt once, however often Qerko repeats it", async () => {
    await using test = await setup()
    const payment = wire("qerko-1", test.paymentId)

    expect((await test.run(startQerkoPayment(payment))).ok).toBe(true)
    expect((await test.run(startQerkoPayment(payment))).ok).toBe(true)

    expect(await test.attempts()).toMatchObject([
      { qerkoPaymentId: "qerko-1", closedAt: null, outcome: null },
    ])
  })

  test.each([
    [{ currency: "EUR" }, "currency"],
    [{ items: [{ name: "x", price: "100", quantity: "1" }] }, "amount"],
    [{ discount: { value: "10" } }, "discount"],
  ] satisfies ReadonlyArray<readonly [Partial<QerkoWirePayment>, string]>)(
    "refuses %j as %s",
    async (overrides, reason) => {
      await using test = await setup()

      expect(
        await test.run(
          startQerkoPayment(wire("qerko-1", test.paymentId, overrides))
        )
      ).toMatchObject({
        ok: false,
        error: { type: "QerkoInvalidData", reason },
      })
      expect(await test.attempts()).toEqual([])
    }
  )

  test("locks the bill while another Qerko payment of it is in progress", async () => {
    await using test = await setup()
    await test.run.orThrow(startQerkoPayment(wire("qerko-1", test.paymentId)))

    expect(
      await test.run(startQerkoPayment(wire("qerko-2", test.paymentId)))
    ).toMatchObject({ ok: false, error: { type: "QerkoBillLocked" } })
  })
})

describe("processQerkoPayment", () => {
  test("marks the attempt processing and answers a receipt that adds up", async () => {
    await using test = await setup()
    await test.run.orThrow(startQerkoPayment(wire("qerko-1", test.paymentId)))

    const result = await test.run(processQerkoPayment("qerko-1"))

    expect(result).toMatchObject({
      ok: true,
      value: {
        items: [{ quantity: "1", price: "129.5" }],
        taxInfo: [{ rate: "0", base: "129.5", tax: "0" }],
      },
    })
    expect(await test.attempts()).toMatchObject([
      { processingAt: expect.any(Number), closedAt: null },
    ])
    // No money before PAID (qerko/0008).
    expect(await test.claims()).toEqual([])
  })

  test("refuses a Qerko payment that never started", async () => {
    await using test = await setup()

    expect(await test.run(processQerkoPayment("unknown"))).toMatchObject({
      ok: false,
      error: { type: "QerkoPaymentAttemptNotFound" },
    })
  })
})

describe("settleQerkoPayment", () => {
  test("PAID records what Qerko charged, once, whoever reports it", async () => {
    await using test = await setup({
      getPayment: (body) => wire(String(body.paymentId), test.paymentId),
    })
    await test.run.orThrow(startQerkoPayment(wire("qerko-1", test.paymentId)))

    // The websocket's paymentClosed carries only the state, so the parts are
    // read with get-payment; the sync job hands its get-payment result in.
    expect(
      await test.run(
        settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "PAID" })
      )
    ).toEqual({ ok: true, value: "paid" })
    expect(test.requests).toEqual(["get-payment"])
    expect(
      await test.run(
        settleQerkoPayment({
          qerkoPaymentId: "qerko-1",
          state: "PAID",
          payment: wire("qerko-1", test.paymentId, { state: "PAID" }),
        })
      )
    ).toEqual({ ok: true, value: "paid" })

    expect(await test.transactions()).toMatchObject([
      { kind: "qerkoPayment", amount: 12_950, currency: "CZK" },
    ])
    // Qerko said paid, not staff (payment/0010).
    expect(await test.claims()).toMatchObject([{ source: "auto" }])
    expect(await test.attempts()).toMatchObject([
      {
        outcome: "paid",
        closedAt: expect.any(Number),
        chargedAmount: 12_950,
        providers: JSON.stringify(["CARD", "MEAL_TICKET"]),
        failureReason: null,
      },
    ])
    expect(await test.run(resolveQerkoBill(test.paymentId))).toMatchObject({
      ok: false,
      error: { type: "QerkoBillClosed" },
    })
  })

  test("a late PROCESSING or CANCELLED does not undo PAID", async () => {
    await using test = await setup()
    const payment = wire("qerko-1", test.paymentId, { state: "PAID" })
    await test.run.orThrow(startQerkoPayment(payment))
    await test.run.orThrow(
      settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "PAID", payment })
    )

    for (const state of ["PROCESSING", "CANCELLED"]) {
      expect(
        await test.run(settleQerkoPayment({ qerkoPaymentId: "qerko-1", state }))
      ).toEqual({ ok: true, value: "paid" })
    }

    expect(await test.attempts()).toMatchObject([
      { outcome: "paid", failureReason: null },
    ])
    expect(await test.claims()).toHaveLength(1)
  })

  test.each(["CANCELLED", "ERROR", "SOMETHING_NEW"])(
    "%s is a failed payment, no money",
    async (state) => {
      await using test = await setup()
      await test.run.orThrow(startQerkoPayment(wire("qerko-1", test.paymentId)))

      expect(
        await test.run(settleQerkoPayment({ qerkoPaymentId: "qerko-1", state }))
      ).toEqual({ ok: true, value: "failed" })

      expect(await test.attempts()).toMatchObject([
        {
          outcome: "failed",
          failureReason: state,
          closedAt: expect.any(Number),
        },
      ])
      expect(await test.claims()).toEqual([])
    }
  )

  test("a state still in progress only marks the attempt processing", async () => {
    await using test = await setup()
    await test.run.orThrow(startQerkoPayment(wire("qerko-1", test.paymentId)))

    expect(
      await test.run(
        settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "STARTED" })
      )
    ).toEqual({ ok: true, value: "started" })
    expect(
      await test.run(
        settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "AUTHORIZED" })
      )
    ).toEqual({ ok: true, value: "processing" })

    expect(await test.attempts()).toMatchObject([
      { processingAt: expect.any(Number), closedAt: null, outcome: null },
    ])
  })

  test("a late CANCELLED of the first attempt leaves the second alone", async () => {
    await using test = await setup()
    await test.run.orThrow(startQerkoPayment(wire("qerko-1", test.paymentId)))
    await test.run.orThrow(
      settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "CANCELLED" })
    )
    test.advance(1_000)
    await test.run.orThrow(startQerkoPayment(wire("qerko-2", test.paymentId)))

    await test.run.orThrow(
      settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "CANCELLED" })
    )

    expect(await test.attempts()).toMatchObject([
      { qerkoPaymentId: "qerko-1", outcome: "failed" },
      { qerkoPaymentId: "qerko-2", outcome: null, closedAt: null },
    ])
  })
})
