import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
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
import { createPayment } from "../payment/payment-actions.ts"
import { preparePaymentMethod } from "../payment/payment-preparation-actions.ts"
import {
  settleQerkoPayment,
  startQerkoPayment,
} from "../payment/payment-qerko-payment-actions.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { saveQerkoPlugin } from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { createRowId } from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { refundPayment } from "./refund-actions.ts"
import { refundQerkoPayment } from "./refund-qerko-payment-actions.ts"
import { refundsByPaymentIdQuery } from "./refund-queries.ts"

const accountId = createQerkoPaymentAccountId("CZK")
const deviceId = createRowId<"Device">()

const accountTransactionsQuery = (id: typeof accountId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .select(["id", "amount", "kind"])
      .where("accountId", "=", id)
      .orderBy("amount")
  )

const wire = (
  idBill: string,
  state: string,
  overrides: Partial<QerkoWirePayment> = {}
): QerkoWirePayment => ({
  id: "qerko-1",
  idBill,
  currency: "CZK",
  state,
  // Qerko is offered the goods; the customer's tip is only in the parts.
  items: [{ name: "Platba", price: "100", quantity: "1" }],
  parts: [
    { provider: { id: "qerko", name: "Card", type: "CARD" }, total: "110" },
  ],
  tipBrutto: "10",
  tipNetto: "9.5",
  ...overrides,
})

/**
 * A payment of 100 of goods and `tipAmount` from Payky's tip screen, paid
 * through Qerko with the customer's tip `tipBrutto` (qerko/0015).
 */
const setup = async ({
  paid = true,
  tipAmount = 1_000,
  tipBrutto = "10",
}: {
  readonly paid?: boolean
  readonly tipAmount?: number
  readonly tipBrutto?: string
} = {}) => {
  const charged = {
    tipBrutto,
    parts: [
      {
        provider: { id: "qerko", name: "Card", type: "CARD" },
        total: String(100 + Number(tipBrutto)),
      },
    ],
  }
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const qerko = { state: "CANCELLED", cancels: 0 }
  let paymentId = ""
  const deps = {
    ...evoluTestDeps(evolu),
    ...createTestDateDep(),
    ...createQerkoApiDep({ posId: "pos" }),
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    fetch: async (input: RequestInfo | URL) => {
      if (!String(input).endsWith("/cancel-payment")) {
        throw new Error(`unexpected ${String(input)}`)
      }
      qerko.cancels += 1
      return Response.json(wire(paymentId, qerko.state))
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
  const id: PaymentId = await run.orThrow(
    createPayment({
      deviceId: null,
      billId: null,
      tableId: null,
      amount: NonNegativeInteger(10_000 + tipAmount),
      currency: "CZK",
      tipAmount: NonNegativeInteger(tipAmount),
      canceledAt: null,
      expiresAt: null,
    })
  )
  paymentId = id
  await run.orThrow(
    preparePaymentMethod({ paymentId: id, qerkoPayment: { accountId } })
  )
  await run.orThrow(startQerkoPayment(wire(id, "STARTED", charged)))
  if (paid) {
    await run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: wire(id, "PAID", charged),
      })
    )
  }

  return {
    run,
    qerko,
    paymentId: id,
    refund: () => run(refundQerkoPayment({ paymentId: id, deviceId })),
    refunds: () => evolu.loadQuery(refundsByPaymentIdQuery(id)),
    transactions: () => evolu.loadQuery(accountTransactionsQuery(accountId)),
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("refundQerkoPayment", () => {
  test("refunds all of the payment once Qerko cancelled it", async () => {
    await using test = await setup()

    expect((await test.refund()).ok).toBe(true)

    const refunds = await test.refunds()
    expect(refunds).toHaveLength(2)
    expect(refunds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 10_000,
          method: "qerkoPayment",
          isTip: null,
        }),
        expect.objectContaining({
          amount: 1_000,
          method: "qerkoPayment",
          isTip: 1,
        }),
      ])
    )
    expect(await test.transactions()).toMatchObject([
      { amount: -10_000, kind: "qerkoPayment" },
      { amount: -1_000, kind: "qerkoPayment" },
      { amount: 11_000, kind: "qerkoPayment" },
    ])
  })

  test("returns the tip the customer chose in Qerko as the tip, not the one Payky's screen set", async () => {
    await using test = await setup({ tipAmount: 0, tipBrutto: "15" })

    expect((await test.refund()).ok).toBe(true)

    const refunds = await test.refunds()
    expect(refunds).toHaveLength(2)
    expect(refunds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 10_000, isTip: null }),
        expect.objectContaining({ amount: 1_500, isTip: 1 }),
      ])
    )
    expect(await test.transactions()).toMatchObject([
      { amount: -10_000 },
      { amount: -1_500 },
      { amount: 11_500 },
    ])
  })

  test("records nothing unless Qerko says CANCELLED", async () => {
    await using test = await setup()
    test.qerko.state = "PAID"

    expect(await test.refund()).toMatchObject({
      ok: false,
      error: { type: "QerkoPaymentRefundNotCancelled", state: "PAID" },
    })
    expect(await test.refunds()).toEqual([])
  })

  test("a second refund asks Qerko no more and records nothing twice", async () => {
    await using test = await setup()

    const first = await test.refund()
    const second = await test.refund()

    expect(second).toEqual(first)
    expect(test.qerko.cancels).toBe(1)
    expect(await test.refunds()).toHaveLength(2)
  })

  test("is refused without a payment paid through Qerko", async () => {
    await using test = await setup({ paid: false })

    expect(await test.refund()).toMatchObject({
      ok: false,
      error: { type: "QerkoPaymentRefundNotAvailable" },
    })
    expect(test.qerko.cancels).toBe(0)
  })

  test("is refused once part of the payment is refunded another way", async () => {
    await using test = await setup()
    await test.run.orThrow(
      refundPayment({
        paymentId: test.paymentId,
        method: "outside",
        deviceId,
        amount: NonNegativeInteger(500),
      })
    )

    expect(await test.refund()).toMatchObject({
      ok: false,
      error: { type: "QerkoPaymentRefundNotAvailable" },
    })
    expect(test.qerko.cancels).toBe(0)
  })
})
