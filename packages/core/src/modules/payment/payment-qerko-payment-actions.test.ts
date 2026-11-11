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
import {
  completeOnboarding,
  updateSettings,
} from "../app-settings/app-settings-actions.ts"
import {
  defaultPaymentMethod,
  defaultPaymentMethodOrder,
} from "../app-settings/app-settings-utils.ts"
import { addCatalogItemToBill, createBill } from "../bill/bill-actions.ts"
import { loadBillStatusSnapshot } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import { setLegalEntity } from "../legal-entity/legal-entity-actions.ts"
import { saveQerkoPlugin } from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import { createTaxRate } from "../tax-rate/tax-rate-actions.ts"
import {
  type TaxRateId,
  TaxRatePercentage,
} from "../tax-rate/tax-rate-types.ts"
import { cancelPayment, createPayment } from "./payment-actions.ts"
import { preparePaymentMethod } from "./payment-preparation-actions.ts"
import {
  processQerkoPayment,
  resolveQerkoBill,
  settleQerkoPayment,
  startQerkoPayment,
} from "./payment-qerko-payment-actions.ts"
import {
  paymentByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "./payment-queries.ts"
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

  const createQerkoPayment = async ({
    prepare = true,
    billId = null,
    amount = 12_950,
    tipAmount = 0,
  }: {
    readonly prepare?: boolean
    readonly billId?: BillId | null
    readonly amount?: number
    /** The tip set on Payky's tip screen, part of `amount`. */
    readonly tipAmount?: number
  } = {}) => {
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
    payment: async (id: PaymentId = paymentId) =>
      (await testEvolu.evolu.loadQuery(paymentByIdQuery(id)))[0],
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
  tipBrutto: "0",
  tipNetto: "0",
  ...overrides,
})

/** Qerko's parts for `total`, paid by card. */
const cardParts = (total: string): QerkoWirePayment["parts"] => [
  { provider: { id: "qerko", name: "Card", type: "CARD" }, total },
]

type QerkoTest = Awaited<ReturnType<typeof setup>>

/**
 * A VAT payer's bill of a beer at 21 %, a soup at 12 % and a tenth off:
 * 159.30, of which the beer bears 12.10 of the discount and the soup 5.60.
 */
const createDiscountedBill = async (test: QerkoTest): Promise<BillId> => {
  await test.run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))
  const rate = (percentage: number, isDefault: boolean) =>
    test.run.ok(
      createTaxRate({
        name: NonEmptyString255(`${percentage / 100} %`),
        rate: TaxRatePercentage(percentage),
        isDefault,
      })
    )
  const item = (
    name: string,
    unitAmount: number,
    taxRateId: TaxRateId | null
  ) =>
    test.run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255(name),
        description: null,
        currency: "CZK",
        unitAmount: Integer(unitAmount),
        sortOrder: NonNegativeInteger(0),
        scanCode: null,
        taxRateId,
      })
    )
  const billId = await test.run.ok(
    createBill({
      deviceId: null,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId: null,
      currency: "CZK",
    })
  )
  for (const catalogItemId of [
    await item("Beer", 12_100, await rate(2100, true)),
    await item("Soup", 5_600, await rate(1200, false)),
    await item("Discount", -1_770, null),
  ]) {
    await test.run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(1),
        expectedDiscount: null,
      })
    )
  }
  return billId
}

/** Starts a Qerko payment of the lines `resolveQerkoBill` offered for it. */
const startOfferedQerkoPayment = async (
  test: QerkoTest,
  qerkoPaymentId: string,
  paymentId: PaymentId,
  overrides: Partial<QerkoWirePayment> = {}
): Promise<ReadonlyArray<QerkoWirePayment["items"][number]>> => {
  const offered = await test.run.orThrow(resolveQerkoBill(paymentId))
  await test.run.orThrow(
    startQerkoPayment(
      wire(qerkoPaymentId, paymentId, { items: offered.items, ...overrides })
    )
  )
  return offered.items
}

describe("resolveQerkoBill", () => {
  test("offers the payment as one line, paid at once, without discount", async () => {
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
        allowTip: true,
        denyDiscounts: true,
        denyMenus: true,
      },
    })
  })

  test("offers the goods alone and lets the customer tip in Qerko, whatever tip the payment carries", async () => {
    await using test = await setup()
    const keypadId = await test.createQerkoPayment({
      amount: 13_950,
      tipAmount: 1_000,
    })
    const billId = await createDiscountedBill(test)
    const billPaymentId = await test.createQerkoPayment({
      billId,
      amount: 16_930,
      tipAmount: 1_000,
    })

    expect(await test.run.orThrow(resolveQerkoBill(keypadId))).toMatchObject({
      items: [{ name: expect.stringMatching(/^Platba/), price: "129.5" }],
      allowTip: true,
    })
    expect(
      await test.run.orThrow(resolveQerkoBill(billPaymentId))
    ).toMatchObject({
      items: [
        { name: "Beer", price: "121" },
        { name: "Soup", price: "56" },
        { name: "Discount", price: "-17.7" },
      ],
      allowTip: true,
    })
  })

  test("offers a bill its payment covers line by line", async () => {
    await using test = await setup()
    const billId = await createDiscountedBill(test)
    const paymentId = await test.createQerkoPayment({
      billId,
      amount: 15_930,
    })

    const result = await test.run.orThrow(resolveQerkoBill(paymentId))

    expect(result).toMatchObject({
      id: paymentId,
      name: expect.stringMatching(/^#/),
      currency: "CZK",
      items: [
        { name: "Beer", price: "121", quantity: "1", minQuantity: "0" },
        { name: "Soup", price: "56", quantity: "1", minQuantity: "0" },
        { name: "Discount", price: "-17.7", quantity: "1", minQuantity: "0" },
      ],
      allowPartialPayment: false,
      allowTip: true,
      denyDiscounts: true,
      denyMenus: true,
    })
    // Each line is the payment line it was frozen as.
    expect(new Set(result.items.map((item) => item.id)).size).toBe(3)
    expect(result.items.map((item) => item.id)).not.toContain(paymentId)
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
    // A price is the line's total; it is not multiplied by the quantity.
    [{ items: [{ name: "x", price: "64.75", quantity: "2" }] }, "amount"],
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

  test("accepts the lines it offered", async () => {
    await using test = await setup()
    const billId = await createDiscountedBill(test)
    const paymentId = await test.createQerkoPayment({
      billId,
      amount: 15_930,
    })
    const offered = await test.run.orThrow(resolveQerkoBill(paymentId))

    expect(
      await test.run(
        startQerkoPayment(
          wire("qerko-2", paymentId, {
            items: offered.items,
            parts: [
              {
                provider: { id: "qerko", name: "Card", type: "CARD" },
                total: "159.3",
              },
            ],
          })
        )
      )
    ).toMatchObject({ ok: true })
    expect(await test.attempts(paymentId)).toMatchObject([
      { qerkoPaymentId: "qerko-2", closedAt: null },
    ])
  })

  test("checks the items against the payment's goods, not its tip", async () => {
    await using test = await setup()
    const paymentId = await test.createQerkoPayment({
      amount: 13_950,
      tipAmount: 1_000,
    })
    const item = (price: string) => ({
      items: [{ name: "Platba", price, quantity: "1" }],
    })

    expect(
      await test.run(
        startQerkoPayment(wire("qerko-1", paymentId, item("139.5")))
      )
    ).toMatchObject({
      ok: false,
      error: { type: "QerkoInvalidData", reason: "amount" },
    })
    expect(
      await test.run(
        startQerkoPayment(
          wire("qerko-2", paymentId, { ...item("129.5"), tipBrutto: "20" })
        )
      )
    ).toEqual({ ok: true, value: undefined })
  })

  test("records Qerko's tip with the start, once", async () => {
    await using test = await setup()

    await test.run.orThrow(
      startQerkoPayment(
        wire("qerko-1", test.paymentId, {
          tipBrutto: "15.00",
          tipNetto: "14.25",
        })
      )
    )
    await test.run.orThrow(
      startQerkoPayment(
        wire("qerko-1", test.paymentId, { tipBrutto: "99", tipNetto: "99" })
      )
    )

    expect(await test.attempts()).toMatchObject([
      { qerkoPaymentId: "qerko-1", tipAmount: 1_500, tipNetAmount: 1_425 },
    ])
  })

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
    // No money before PAID (qerko/0015).
    expect(await test.claims()).toEqual([])
  })

  test("answers a discounted bill's VAT from the net lines its payment froze, no rate below zero", async () => {
    await using test = await setup()
    const billId = await createDiscountedBill(test)
    const paymentId = await test.createQerkoPayment({
      billId,
      amount: 15_930,
    })
    await startOfferedQerkoPayment(test, "qerko-2", paymentId)

    const result = await test.run(processQerkoPayment("qerko-2"))

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          { name: "Beer", quantity: "1", price: "121" },
          { name: "Soup", quantity: "1", price: "56" },
          { name: "Discount", quantity: "1", price: "-17.7" },
        ],
        taxInfo: [
          { rate: "21", base: "90", tax: "18.9" },
          { rate: "12", base: "45", tax: "5.4" },
        ],
      },
    })
  })

  test("prorates a partly paid bill's VAT", async () => {
    await using test = await setup()
    const billId = await createDiscountedBill(test)
    // 100 of the bill's 159.30: 68.36 of the beer's rate and 31.64 of the
    // soup's, each split again at its rate.
    const paymentId = await test.createQerkoPayment({ billId, amount: 10_000 })
    await startOfferedQerkoPayment(test, "qerko-2", paymentId)

    const result = await test.run(processQerkoPayment("qerko-2"))

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            name: expect.stringMatching(/^Platba/),
            quantity: "1",
            price: "100",
          },
        ],
        taxInfo: [
          { rate: "21", base: "56.5", tax: "11.86" },
          { rate: "12", base: "28.25", tax: "3.39" },
        ],
      },
    })
  })

  test("lists neither the customer's Qerko tip nor the payment's own on the receipt", async () => {
    await using test = await setup()
    const billId = await createDiscountedBill(test)
    const paymentId = await test.createQerkoPayment({
      billId,
      amount: 16_930,
      tipAmount: 1_000,
    })
    await startOfferedQerkoPayment(test, "qerko-2", paymentId, {
      tipBrutto: "15",
      tipNetto: "14.25",
    })

    expect(await test.run(processQerkoPayment("qerko-2"))).toEqual({
      ok: true,
      value: {
        items: [
          { name: "Beer", quantity: "1", price: "121" },
          { name: "Soup", quantity: "1", price: "56" },
          { name: "Discount", quantity: "1", price: "-17.7" },
        ],
        taxInfo: [
          { rate: "21", base: "90", tax: "18.9" },
          { rate: "12", base: "45", tax: "5.4" },
        ],
      },
    })
  })

  test("taxes a VAT payer's keypad payment at the keypad rate set when the receipt is made", async () => {
    await using test = await setup()
    await test.run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))
    await test.run.orThrow(
      completeOnboarding({
        fiatCurrency: "CZK",
        defaultPaymentMethod,
        paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
      })
    )
    const rateId = await test.run.ok(
      createTaxRate({
        name: NonEmptyString255("21 %"),
        rate: TaxRatePercentage(2100),
        isDefault: true,
      })
    )
    const process = async (qerkoPaymentId: string) => {
      const paymentId = await test.createQerkoPayment({
        amount: 12_600,
        tipAmount: 500,
      })
      await startOfferedQerkoPayment(test, qerkoPaymentId, paymentId)
      return await test.run.orThrow(processQerkoPayment(qerkoPaymentId))
    }

    // No rate set: no VAT lines rather than a guessed one.
    expect(await process("qerko-2")).toMatchObject({
      items: [{ price: "121" }],
      taxInfo: [],
    })

    await test.run.ok(updateSettings({ keypadTaxRateId: rateId }))
    expect(await process("qerko-3")).toMatchObject({
      items: [{ price: "121" }],
      taxInfo: [{ rate: "21", base: "100", tax: "21" }],
    })
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

  test.each([
    ["a tip", "15", 1_500, "174.3"],
    ["no tip", "0", 0, "159.3"],
  ] as const)(
    "takes the customer's Qerko tip in place of the payment's own and closes its bill as paid: %s",
    async (_case, tipBrutto, tipAmount, charged) => {
      await using test = await setup()
      const billId = await createDiscountedBill(test)
      // The bill's 159.30 and a 10 tip from Payky's tip screen, which never
      // reached Qerko.
      const paymentId = await test.createQerkoPayment({
        billId,
        amount: 16_930,
        tipAmount: 1_000,
      })
      const items = await startOfferedQerkoPayment(test, "qerko-2", paymentId, {
        tipBrutto,
      })

      await test.run.orThrow(
        settleQerkoPayment({
          qerkoPaymentId: "qerko-2",
          state: "PAID",
          payment: wire("qerko-2", paymentId, {
            state: "PAID",
            items: [...items],
            parts: cardParts(charged),
            tipBrutto,
          }),
        })
      )

      expect(await test.payment(paymentId)).toMatchObject({
        amount: 15_930 + tipAmount,
        tipAmount,
      })
      expect(await test.transactions(paymentId)).toMatchObject([
        { kind: "qerkoPayment", amount: 15_930 + tipAmount },
      ])
      expect(
        await test.run.orThrow(loadBillStatusSnapshot(billId))
      ).toMatchObject({
        status: "closed",
        coverage: "paid",
        claimedSum: 15_930,
      })
    }
  )

  test("records the money as charged when it is not the goods and Qerko's tip", async () => {
    await using test = await setup()
    await test.run.orThrow(
      startQerkoPayment(wire("qerko-1", test.paymentId, { tipBrutto: "15" }))
    )

    await test.run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: wire("qerko-1", test.paymentId, {
          state: "PAID",
          parts: cardParts("149.5"),
          tipBrutto: "15",
        }),
      })
    )

    expect(await test.payment()).toMatchObject({
      amount: 12_950,
      tipAmount: 0,
    })
    expect(await test.transactions()).toMatchObject([{ amount: 14_950 }])
  })

  test("reads the customer's tip from the attempt when the Payment carries none", async () => {
    await using test = await setup({
      getPayment: (body) =>
        wire(String(body.paymentId), test.paymentId, {
          state: "PAID",
          parts: cardParts("144.5"),
          tipBrutto: undefined,
          tipNetto: undefined,
        }),
    })
    await test.run.orThrow(
      startQerkoPayment(wire("qerko-1", test.paymentId, { tipBrutto: "15" }))
    )

    await test.run.orThrow(
      settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "PAID" })
    )

    expect(await test.payment()).toMatchObject({
      amount: 14_450,
      tipAmount: 1_500,
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
