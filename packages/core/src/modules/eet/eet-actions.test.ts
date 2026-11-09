import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createQuery } from "../../evolu/schema.ts"
import { createTestCertificate } from "../../testing/eet-test-certificates.ts"
import { createBill } from "../bill/bill-actions.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  NonNegativeInteger,
  PositiveInteger,
  TimestampMs,
} from "../shared/schema.ts"
import {
  createEetReversal,
  createEetSale,
  deliverEetReversal,
  deliverEetSale,
  disableEet,
  enableEet,
  retryEetSale,
  saveEetEstablishmentId,
  saveEetTipOwner,
  selectEetEnvironment,
  sendEetTestMessage,
  storeEetCertificate,
} from "./eet-actions.ts"
import {
  eetReversalByIdQuery,
  eetSaleByIdQuery,
  eetSalesByPaymentIdQuery,
  eetSettingsQuery,
  eetSigningCertificateQuery,
} from "./eet-queries.ts"
import {
  configureEet,
  createEetTestContext,
  type EetTestContext,
  eetTestEic,
  getEetTestCertificateFile,
} from "./eet-test-fixtures.ts"
import {
  type EetEic,
  EetEstablishmentIdSchema,
  type EetSaleId,
} from "./eet-types.ts"
import { bytesToEetBase64 } from "./eet-utils.ts"

const allEetSalesQuery = createQuery((db) =>
  db.selectFrom("eetSale").selectAll()
)

const createSaleForNewPayment = async (
  context: EetTestContext,
  overrides: Partial<Parameters<typeof createEetSale>[0]["payment"]> = {}
) => {
  await using run = testCreateRun(context.deps)
  const saleId = await run.ok(
    createEetSale({
      payment: {
        id: createRowId<"Payment">(),
        billId: null,
        amount: NonNegativeInteger(25_000),
        tipAmount: NonNegativeInteger(0),
        cashReceivedAmount: null,
        currency: "CZK",
        method: "cashRegister",
        firstClaimedAt: TimestampMs(context.clock.date.now().getTime()),
        firstClaimTransactionId: createRowId<"AccountTransaction">(),
        firstSettlementValue: overrides.amount ?? NonNegativeInteger(25_000),
        ...overrides,
      },
      deviceId: context.deviceId,
    })
  )
  if (saleId === null) throw new Error("Expected a created sale.")
  return saleId
}

describe("enableEet", () => {
  test("names every missing piece of configuration", async () => {
    await using context = await createEetTestContext()
    await using run = testCreateRun(context.deps)

    await expect(run(enableEet())).resolves.toEqual({
      ok: false,
      error: {
        type: "EetConfigurationIncompleteError",
        missing: ["certificate", "establishment"],
      },
    })

    await run.ok(
      storeEetCertificate({
        certificate: await getEetTestCertificateFile(),
        isTestCertificate: false,
      })
    )
    await expect(run(enableEet())).resolves.toMatchObject({
      ok: false,
      error: { missing: ["establishment"] },
    })
  })

  test("refuses an expired certificate", async () => {
    await using context = await createEetTestContext({
      now: new Date("2028-01-01T00:00:00.000Z"),
    })
    await configureEet(context, { enabled: false })
    await using run = testCreateRun(context.deps)

    await expect(run(enableEet())).resolves.toMatchObject({
      ok: false,
      error: { missing: ["certificateExpired"] },
    })
  })

  test("starts at the current moment and stops on disable", async () => {
    await using context = await createEetTestContext()
    await configureEet(context, { enabled: false })
    await using run = testCreateRun(context.deps)

    await expect(run(enableEet())).resolves.toEqual({
      ok: true,
      value: context.clock.date.now().getTime(),
    })
    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSettingsQuery))
      .toMatchObject([{ enabledAt: context.clock.date.now().getTime() }])

    await run.ok(disableEet())
    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSettingsQuery))
      .toMatchObject([{ enabledAt: null }])
  })
})

describe("selectEetEnvironment", () => {
  test("offers only the playground without a production endpoint", async () => {
    await using context = await createEetTestContext()
    await using run = testCreateRun(context.deps)

    await expect(run(selectEetEnvironment("production"))).resolves.toEqual({
      ok: false,
      error: { type: "EetProductionUnavailableError" },
    })
    await expect(run(selectEetEnvironment("playground"))).resolves.toEqual({
      ok: true,
      value: "playground",
    })
  })

  test("refuses production while a test certificate is stored", async () => {
    await using context = await createEetTestContext({
      productionUrl: "https://eet.invalid/production",
    })
    await configureEet(context, { enabled: false, isTestCertificate: true })
    await using run = testCreateRun(context.deps)

    await expect(run(selectEetEnvironment("production"))).resolves.toEqual({
      ok: false,
      error: { type: "EetTestCertificateBlocksProductionError" },
    })
  })

  test("defaults new sales to production when its endpoint is set", async () => {
    await using context = await createEetTestContext({
      productionUrl: "https://eet.invalid/production",
    })
    await using run = testCreateRun(context.deps)
    await run.ok(
      storeEetCertificate({
        certificate: await getEetTestCertificateFile(),
        isTestCertificate: false,
      })
    )
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("24")))

    const saleId = await createSaleForNewPayment(context)

    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId)))
      .toMatchObject([{ environment: "production" }])
  })
})

describe("storeEetCertificate", () => {
  test("replaces the certificate every later delivery signs with", async () => {
    await using context = await createEetTestContext()
    await using run = testCreateRun(context.deps)
    const first = await getEetTestCertificateFile()
    const secondCertificate = await createTestCertificate({
      subject: { commonName: "CZ9876543210" },
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2027-01-01T00:00:00.000Z"),
    })
    const second = {
      ...first,
      eic: "CZ9876543210" as EetEic,
      certificateDer: secondCertificate.certificateDer,
      privateKeyPkcs8: secondCertificate.privateKeyPkcs8,
    }

    await run.ok(
      storeEetCertificate({ certificate: first, isTestCertificate: false })
    )
    await run.ok(
      storeEetCertificate({ certificate: second, isTestCertificate: false })
    )

    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSigningCertificateQuery))
      .toEqual([
        {
          eic: "CZ9876543210",
          certificateDer: bytesToEetBase64(second.certificateDer),
          privateKeyPkcs8: bytesToEetBase64(second.privateKeyPkcs8),
          isTestCertificate: 0,
        },
      ])
    await expect
      .poll(() =>
        context.deps.evolu.loadQuery(
          createQuery((db) =>
            db
              .selectFrom("eetCertificate")
              .select(["eic", "isDeleted"])
              .orderBy("eic")
          )
        )
      )
      .toEqual([
        { eic: eetTestEic, isDeleted: sqliteTrue },
        { eic: "CZ9876543210", isDeleted: 0 },
      ])
  })
})

describe("createEetSale", () => {
  test("freezes the sale data of a payment", async () => {
    await using context = await createEetTestContext({
      now: new Date("2027-01-09T15:45:36.000Z"),
    })
    await configureEet(context)
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
    const paymentId = createRowId<"Payment">()
    const firstClaimTransactionId = createRowId<"AccountTransaction">()

    const saleId = await createSaleForNewPayment(context, {
      id: paymentId,
      billId,
      firstClaimTransactionId,
    })
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))

    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId)))
      .toMatchObject([
        {
          paymentId,
          billId,
          accountTransactionId: firstClaimTransactionId,
          deviceId: context.deviceId,
          method: "cashRegister",
          amount: 25_000,
          currency: "CZK",
          environment: "playground",
          eic: eetTestEic,
          establishmentId: "24",
          cashRegisterId: context.deviceId.slice(0, 20),
          sequenceNumber: paymentId,
          saleAt: "2027-01-09T16:45:36+01:00",
          unsupportedReason: null,
          pok: null,
        },
      ])
  })

  test("marks a euro payment unsupported", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)

    const saleId = await createSaleForNewPayment(context, { currency: "EUR" })

    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId)))
      .toMatchObject([{ unsupportedReason: "currency" }])
  })

  test("never rewrites an existing record", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const paymentId = createRowId<"Payment">()
    const firstClaimTransactionId = createRowId<"AccountTransaction">()
    const saleId = await createSaleForNewPayment(context, {
      id: paymentId,
      firstClaimTransactionId,
    })
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))

    await createSaleForNewPayment(context, {
      id: paymentId,
      firstClaimTransactionId,
      amount: NonNegativeInteger(1),
    })

    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId)))
      .toMatchObject([{ amount: 25_000, establishmentId: "24" }])
    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toHaveLength(1)
  })

  test("reports the tip while nobody said who it belongs to", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)

    const saleId = await createSaleForNewPayment(context, {
      tipAmount: NonNegativeInteger(2_000),
    })

    expect(await context.deps.evolu.loadQuery(eetSettingsQuery)).toMatchObject([
      { tipOwner: null },
    ])
    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId)))
      .toMatchObject([{ amount: 25_000 }])
  })

  test("fixes the tip it reports", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    const businessTip = await createSaleForNewPayment(context, {
      tipAmount: NonNegativeInteger(2_000),
    })
    await run.ok(saveEetTipOwner("employees"))
    const employeesTip = await createSaleForNewPayment(context, {
      tipAmount: NonNegativeInteger(2_000),
    })

    await expect(
      context.deps.evolu.loadQuery(eetSaleByIdQuery(businessTip))
    ).resolves.toMatchObject([{ reportedTipAmount: 2_000 }])
    await expect(
      context.deps.evolu.loadQuery(eetSaleByIdQuery(employeesTip))
    ).resolves.toMatchObject([{ reportedTipAmount: 0 }])
  })

  test("leaves the tip out while tips belong to employees", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetTipOwner("employees"))

    const saleId = await createSaleForNewPayment(context, {
      tipAmount: NonNegativeInteger(2_000),
    })
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(await context.deps.evolu.loadQuery(eetSettingsQuery)).toMatchObject([
      { tipOwner: "employees" },
    ])
    expect(context.responder.requests).toMatchObject([
      { data: { celk_trzba: "230.00" } },
    ])
  })

  test("reports 0.00 for a payment that is all tip while tips belong to employees", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetTipOwner("employees"))

    const saleId = await createSaleForNewPayment(context, {
      amount: NonNegativeInteger(2_000),
      tipAmount: NonNegativeInteger(2_000),
    })
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(context.responder.requests).toMatchObject([
      { data: { celk_trzba: "0.00" } },
    ])
  })

  test("keeps the tip of a sale created before tips went to employees", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context, {
      tipAmount: NonNegativeInteger(2_000),
    })
    context.responder.answerNext({ type: "timeout" })
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    await run.ok(saveEetTipOwner("employees"))
    await run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))

    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["250.00", "250.00"])
  })

  test.each([
    {
      name: "cash rounded to whole crowns",
      method: "cashRegister",
      amount: 7_890,
      cashReceivedAmount: 7_900,
      reported: "79.00",
    },
    {
      name: "change the customer left",
      method: "cashRegister",
      amount: 7_890,
      cashReceivedAmount: 8_000,
      reported: "80.00",
    },
    {
      name: "a card payment",
      method: "cardSwitchio",
      amount: 7_890,
      cashReceivedAmount: null,
      reported: "78.90",
    },
    {
      name: "cash without a received amount",
      method: "cashRegister",
      amount: 7_890,
      cashReceivedAmount: null,
      reported: "78.90",
    },
  ] as const)(
    "reports what was received for $name",
    async ({ method, amount, cashReceivedAmount, reported }) => {
      await using context = await createEetTestContext()
      await configureEet(context)
      const saleId = await createSaleForNewPayment(context, {
        method,
        amount: NonNegativeInteger(amount),
        cashReceivedAmount:
          cashReceivedAmount === null
            ? null
            : NonNegativeInteger(cashReceivedAmount),
      })
      await using run = testCreateRun(context.deps)

      await run.orThrow(
        deliverEetSale({ id: saleId, deviceId: context.deviceId })
      )

      expect(context.responder.requests).toMatchObject([
        { data: { celk_trzba: reported } },
      ])
    }
  )

  test("reports the goods in whole crowns when cash takes part of the tip", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    const cashSale = {
      amount: NonNegativeInteger(5_828),
      tipAmount: NonNegativeInteger(278),
      cashReceivedAmount: NonNegativeInteger(5_800),
    }
    const businessTip = await createSaleForNewPayment(context, cashSale)
    await run.ok(saveEetTipOwner("employees"))
    const employeesTip = await createSaleForNewPayment(context, cashSale)

    await expect(
      context.deps.evolu.loadQuery(eetSaleByIdQuery(businessTip))
    ).resolves.toMatchObject([{ amount: 5_800, reportedTipAmount: 200 }])
    await expect(
      context.deps.evolu.loadQuery(eetSaleByIdQuery(employeesTip))
    ).resolves.toMatchObject([{ amount: 5_600, reportedTipAmount: 0 }])
  })

  test("leaves the tip out of the cash received while tips belong to employees", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetTipOwner("employees"))
    const saleId = await createSaleForNewPayment(context, {
      amount: NonNegativeInteger(11_000),
      tipAmount: NonNegativeInteger(1_000),
      cashReceivedAmount: NonNegativeInteger(11_100),
    })

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(context.responder.requests).toMatchObject([
      { data: { celk_trzba: "100.00" } },
    ])
  })
})

describe("deliverEetSale", () => {
  test("stores the POK, the time of receipt and every warning", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.responder.answerNext({
      type: "confirm",
      warnings: [{ code: 4, message: "dat_trzby is in the future" }],
    })
    await using run = testCreateRun(context.deps)

    const outcome = await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(outcome).toMatchObject({ type: "accepted", isTest: true })
    await expect
      .poll(() => context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId)))
      .toMatchObject([
        {
          pok: expect.stringMatching(/-ff$/u),
          receivedAt: "2026-06-05T14:00:00+02:00",
          isTest: sqliteTrue,
          warningsJson: JSON.stringify([
            { code: 4, message: "dat_trzby is in the future" },
          ]),
          lastAttemptAt: context.clock.date.now().getTime(),
        },
      ])
    expect(context.responder.requests).toMatchObject([
      {
        header: { prvni_zaslani: "true" },
        data: { celk_trzba: "250.00", id_jednotky: "24" },
      },
    ])
    await expect(
      run(deliverEetSale({ id: saleId, deviceId: context.deviceId }))
    ).resolves.toEqual({
      ok: false,
      error: { type: "EetSaleAlreadyConfirmedError", id: saleId },
    })
    expect(context.responder.requests).toHaveLength(1)
  })

  test("refuses a sale another delivery holds", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    await using run = testCreateRun(context.deps)

    const result = await context.deps.lockManager.request(
      `eet-sale-${saleId}`,
      async () =>
        await run(deliverEetSale({ id: saleId, deviceId: context.deviceId }))
    )

    expect(result).toEqual({
      ok: false,
      error: { type: "EetSaleBusyError", id: saleId },
    })
    expect(context.responder.requests).toEqual([])
  })

  test("keeps the sale data and marks the resend as repeated", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.responder.answerNext({ type: "timeout" })
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))
    await run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))

    const [first, second] = context.responder.requests
    expect(second?.data).toEqual(first?.data)
    expect(second?.header.uuid_zpravy).not.toBe(first?.header.uuid_zpravy)
    expect(first?.header.prvni_zaslani).toBe("true")
    expect(second?.header.prvni_zaslani).toBe("false")
  })
})

const closeAppDuringSubmit = (context: EetTestContext) => ({
  ...context.deps,
  eetApi: {
    ...context.deps.eetApi,
    submit: () => Promise.reject(new Error("App closed")),
  },
})

describe("first and repeated sending", () => {
  test("marks the recording device's first attempt as the first sending", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.clock.advance(1_000)
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(context.responder.requests).toMatchObject([
      { header: { prvni_zaslani: "true" } },
    ])
  })

  test("marks the attempt after an app closed mid-attempt as repeated", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    await using closingRun = testCreateRun(closeAppDuringSubmit(context))
    await using run = testCreateRun(context.deps)

    await expect(
      closingRun(deliverEetSale({ id: saleId, deviceId: context.deviceId }))
    ).rejects.toMatchObject({ type: "AbortError" })
    await expect(
      context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId))
    ).resolves.toMatchObject([
      {
        attemptStartedAt: context.clock.date.now().getTime(),
        lastAttemptAt: null,
      },
    ])
    context.clock.advance(1_000)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(context.responder.requests).toMatchObject([
      { header: { prvni_zaslani: "false" } },
    ])
    await expect(
      context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId))
    ).resolves.toMatchObject([{ hadUnansweredAttempt: sqliteTrue }])
  })

  test("marks a first attempt made after 5 minutes as repeated", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.clock.advance(6 * 60 * 1000)
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )

    expect(context.responder.requests).toMatchObject([
      { header: { prvni_zaslani: "false" } },
    ])
  })

  test("marks an attempt from another device as repeated", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: createRowId<"Device">() })
    )

    expect(context.responder.requests).toMatchObject([
      { header: { prvni_zaslani: "false" } },
    ])
  })
})

describe("retryEetSale", () => {
  test("takes the corrected establishment number when every attempt was rejected", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.responder.answerNext({
      type: "error",
      code: 6,
      message: "Unknown establishment",
    })
    await using run = testCreateRun(context.deps)

    await expect(
      run.orThrow(deliverEetSale({ id: saleId, deviceId: context.deviceId }))
    ).resolves.toMatchObject({
      type: "rejected",
      code: 6,
    })
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))
    await expect(
      run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))
    ).resolves.toMatchObject({
      type: "accepted",
    })

    expect(
      context.responder.requests.map(({ data }) => data.id_jednotky)
    ).toEqual(["24", "77"])
  })

  test("keeps the original data after an attempt without an answer", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.responder.answerNext(
      { type: "networkFailure" },
      { type: "error", code: 6, message: "Unknown establishment" }
    )
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))
    await run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))

    expect(
      context.responder.requests.map(({ data }) => data.id_jednotky)
    ).toEqual(["24", "24", "24"])
  })

  test("keeps the original data after an attempt cut off by the app closing", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.responder.answerNext({
      type: "error",
      code: 6,
      message: "Unknown establishment",
    })
    await using closingRun = testCreateRun(closeAppDuringSubmit(context))
    await using run = testCreateRun(context.deps)

    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    context.clock.advance(1_000)
    await expect(
      closingRun(deliverEetSale({ id: saleId, deviceId: context.deviceId }))
    ).rejects.toMatchObject({ type: "AbortError" })
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))
    await run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))

    expect(
      context.responder.requests.map(({ data }) => data.id_jednotky)
    ).toEqual(["24", "24"])
  })

  test("keeps the original data after a confirmation it could not verify", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSaleForNewPayment(context)
    context.responder.answerNext({ type: "tamperedConfirmation" })
    await using run = testCreateRun(context.deps)

    await expect(
      run.orThrow(deliverEetSale({ id: saleId, deviceId: context.deviceId }))
    ).resolves.toMatchObject({
      type: "rejected",
      errorType: "EetSignatureError",
    })
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))
    await run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))

    expect(
      context.responder.requests.map(({ data }) => data.id_jednotky)
    ).toEqual(["24", "24"])
  })

  test("delivers a record created by another device", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    const saleId = await run.ok(
      createEetSale({
        payment: {
          id: createRowId<"Payment">(),
          billId: null,
          amount: NonNegativeInteger(25_000),
          tipAmount: NonNegativeInteger(0),
          cashReceivedAmount: null,
          currency: "CZK",
          method: "cashRegister",
          firstClaimedAt: TimestampMs(context.clock.date.now().getTime()),
          firstClaimTransactionId: createRowId<"AccountTransaction">(),
          firstSettlementValue: NonNegativeInteger(25_000),
        },
        deviceId: createRowId<"Device">(),
      })
    )
    if (saleId === null) throw new Error("Expected a created sale.")

    await expect(
      run.orThrow(retryEetSale({ id: saleId, deviceId: context.deviceId }))
    ).resolves.toMatchObject({
      type: "accepted",
    })
  })
})

describe("sendEetTestMessage", () => {
  test("runs the connection test in verification mode without a record", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)

    const submission = await run.orThrow(
      sendEetTestMessage({ kind: "verification", deviceId: context.deviceId })
    )

    expect(submission.outcome).toMatchObject({ type: "verified" })
    expect(submission.rawRequest).toContain('overeni="true"')
    expect(submission.rawResponse).toContain('kod="0"')
    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([])
  })

  test("shows the EET error of a failed connection test", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({
      type: "error",
      code: 4,
      message: "Neplatny podpis SOAP zpravy",
    })
    await using run = testCreateRun(context.deps)

    const submission = await run.orThrow(
      sendEetTestMessage({ kind: "verification", deviceId: context.deviceId })
    )

    expect(submission.outcome).toMatchObject({
      type: "rejected",
      code: 4,
      message: "Neplatny podpis SOAP zpravy",
    })
    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([])
  })

  test("sends a test sale to the playground without a record", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)

    const submission = await run.orThrow(
      sendEetTestMessage({ kind: "sale", deviceId: context.deviceId })
    )

    expect(submission.outcome).toMatchObject({
      type: "accepted",
      pok: expect.stringMatching(/-ff$/u),
    })
    expect(submission.rawRequest).toContain("<tns:Trzba")
    expect(submission.rawResponse).toContain("<eet:Potvrzeni")
    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([])
  })

  test("offers no test sale in production", async () => {
    await using context = await createEetTestContext({
      productionUrl: "https://eet.invalid/production",
    })
    await configureEet(context, { environment: "production" })
    await using run = testCreateRun(context.deps)

    await expect(
      run(sendEetTestMessage({ kind: "sale", deviceId: context.deviceId }))
    ).resolves.toEqual({
      ok: false,
      error: { type: "EetTestSaleOutsidePlaygroundError" },
    })
    expect(context.responder.requests).toEqual([])
  })
})

const allEetReversalsQuery = createQuery((db) =>
  db.selectFrom("eetReversal").selectAll()
)

const reverseRefund = async (
  context: EetTestContext,
  {
    paymentId,
    saleId,
    amount,
    cashHandedAmount = null,
    isTip = null,
    refundId = createRowId<"Refund">(),
    deviceId = context.deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly saleId: EetSaleId
    readonly amount: number
    readonly cashHandedAmount?: number | null
    readonly isTip?: typeof sqliteTrue | null
    readonly refundId?: RefundId
    readonly deviceId?: DeviceId
  }
) => {
  await using run = testCreateRun(context.deps)
  return await run.ok(
    createEetReversal({
      refund: {
        id: refundId,
        paymentId,
        amount: NonNegativeInteger(amount),
        cashHandedAmount:
          cashHandedAmount === null
            ? null
            : NonNegativeInteger(cashHandedAmount),
        isTip,
        refundedAt: TimestampMs(context.clock.date.now().getTime()),
        saleId,
      },
      deviceId,
    })
  )
}

const createSaleToReverse = async (
  context: EetTestContext,
  overrides: Partial<Parameters<typeof createEetSale>[0]["payment"]> = {}
) => {
  const paymentId = createRowId<"Payment">()
  const saleId = await createSaleForNewPayment(context, {
    id: paymentId,
    ...overrides,
  })
  return { paymentId, saleId }
}

describe("createEetReversal", () => {
  test.each([
    {
      name: "a rounded cash sale in full",
      payment: { amount: 7_890, tipAmount: 0, cashReceivedAmount: 7_900 },
      refunded: 7_900,
      reversed: 7_900,
    },
    {
      name: "one refunded item",
      payment: { amount: 25_000, tipAmount: 0, cashReceivedAmount: null },
      refunded: 5_000,
      reversed: 5_000,
    },
  ])("reverses $name", async ({ payment, refunded, reversed }) => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      amount: NonNegativeInteger(payment.amount),
      tipAmount: NonNegativeInteger(payment.tipAmount),
      cashReceivedAmount:
        payment.cashReceivedAmount === null
          ? null
          : NonNegativeInteger(payment.cashReceivedAmount),
    })

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: refunded,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([
      { amount: reversed, saleId, paymentId, unsupportedReason: null },
    ])
  })

  test("keeps a reversal out of the sale table", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetSalesByPaymentIdQuery(paymentId))
    ).resolves.toMatchObject([{ id: saleId }])
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toHaveLength(1)
  })

  test("caps a refund at a sale that left out an employees' tip", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetTipOwner("employees"))
    const { paymentId, saleId } = await createSaleToReverse(context, {
      tipAmount: NonNegativeInteger(2_000),
    })

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 25_000,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ amount: 23_000 }])
  })

  test("reverses no tip refund of a tip that belonged to employees", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetTipOwner("employees"))
    const { paymentId, saleId } = await createSaleToReverse(context, {
      tipAmount: NonNegativeInteger(2_000),
    })

    await expect(
      reverseRefund(context, {
        paymentId,
        saleId,
        amount: 2_000,
        isTip: sqliteTrue,
      })
    ).resolves.toBeNull()
  })

  test("reverses the tip refund of a tip that belonged to the business", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      tipAmount: NonNegativeInteger(2_000),
    })

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 2_000,
      isTip: sqliteTrue,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ amount: 2_000 }])
  })

  test("reverses no more of a tip than its refund returned", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      tipAmount: NonNegativeInteger(278),
    })

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 200,
      isTip: sqliteTrue,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ amount: 200 }])
  })

  test("reverses no tip refund of a sale that recorded no reported tip", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      tipAmount: NonNegativeInteger(2_000),
    })
    await runMutationWithCompletion((options) =>
      context.deps.evolu.update(
        "eetSale",
        { id: saleId, reportedTipAmount: null },
        { ...options, owner: context.deps.evoluOwner }
      )
    )

    await expect(
      reverseRefund(context, {
        paymentId,
        saleId,
        amount: 2_000,
        isTip: sqliteTrue,
      })
    ).resolves.toBeNull()
  })

  test.each([
    {
      name: "rounded down, the goods carrying the rounding",
      payment: { amount: 6_330, tipAmount: 580 },
      goods: { amount: 5_750, handed: 5_720 },
      reversed: [5_720, 580],
    },
    {
      name: "rounded up, capped at what the sale reported",
      payment: { amount: 6_370, tipAmount: 580 },
      goods: { amount: 5_790, handed: 5_820 },
      reversed: [5_820, 550],
    },
  ])(
    "reverses the cash a whole refund from the cash register handed out, $name",
    async ({ payment, goods, reversed }) => {
      await using context = await createEetTestContext()
      await configureEet(context)
      const { paymentId, saleId } = await createSaleToReverse(context, {
        amount: NonNegativeInteger(payment.amount),
        tipAmount: NonNegativeInteger(payment.tipAmount),
      })

      await reverseRefund(context, {
        paymentId,
        saleId,
        amount: goods.amount,
        cashHandedAmount: goods.handed,
      })
      await reverseRefund(context, {
        paymentId,
        saleId,
        amount: payment.tipAmount,
        cashHandedAmount: payment.tipAmount,
        isTip: sqliteTrue,
      })

      expect(
        (await context.deps.evolu.loadQuery(allEetReversalsQuery))
          .map(({ amount }) => amount ?? 0)
          .sort((a, b) => b - a)
      ).toEqual(reversed)
    }
  )

  test("reverses the whole crowns a tip refund from the cash register handed out", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      tipAmount: NonNegativeInteger(580),
    })

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 580,
      cashHandedAmount: 600,
      isTip: sqliteTrue,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ amount: 600 }])
  })

  test("reverses the amount of a cash refund recorded without the cash handed out", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      amount: NonNegativeInteger(5_790),
    })

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_790,
      cashHandedAmount: null,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ amount: 5_790 }])
  })

  test("caps later refunds at what the sale has left", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)

    const amounts = [
      await reverseRefund(context, { paymentId, saleId, amount: 20_000 }),
      await reverseRefund(context, { paymentId, saleId, amount: 10_000 }),
      await reverseRefund(context, { paymentId, saleId, amount: 100 }),
    ]

    expect(amounts[2]).toBeNull()
    expect(
      (await context.deps.evolu.loadQuery(allEetReversalsQuery))
        .map(({ amount }) => amount)
        .sort()
    ).toEqual([20_000, 5_000].sort())
  })

  test("caps refunds at what every sale of the payment reports, whichever sale they name", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    const otherSaleId = await createSaleForNewPayment(context, {
      id: paymentId,
    })

    await reverseRefund(context, { paymentId, saleId, amount: 25_000 })
    await reverseRefund(context, {
      paymentId,
      saleId: otherSaleId,
      amount: 25_000,
    })

    await expect(
      reverseRefund(context, { paymentId, saleId, amount: 100 })
    ).resolves.toBeNull()
  })

  test("creates nothing for an unsupported sale", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context, {
      currency: "EUR",
    })

    await expect(
      reverseRefund(context, { paymentId, saleId, amount: 1_000 })
    ).resolves.toBeNull()
    expect(await context.deps.evolu.loadQuery(allEetReversalsQuery)).toEqual([])
  })

  test("keeps one reversal when two devices see the refund", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    const refundId = createRowId<"Refund">()

    const first = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
      refundId,
    })
    const second = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
      refundId,
      deviceId: createRowId<"Device">(),
    })

    expect(second).toBe(first)
    expect(
      await context.deps.evolu.loadQuery(allEetReversalsQuery)
    ).toMatchObject([{ deviceId: context.deviceId }])
  })

  test("carries the establishment number in force at the refund", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    await using run = testCreateRun(context.deps)
    await run.ok(saveEetEstablishmentId(EetEstablishmentIdSchema.decode("77")))

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([
      { establishmentId: "77", unsupportedReason: null },
    ])
  })

  test("never sends a reversal once EET runs in another environment", async () => {
    await using context = await createEetTestContext({
      productionUrl: "https://eet.invalid/production",
    })
    await configureEet(context, { environment: "playground" })
    const { paymentId, saleId } = await createSaleToReverse(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    await run.orThrow(selectEetEnvironment("production"))

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ unsupportedReason: "environment" }])
    await expect(
      run(deliverEetReversal({ id: reversalId, deviceId: context.deviceId }))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "EetSaleUnsupportedError" },
    })
  })

  test("never sends a reversal once EET reports for another taxpayer", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    await run.ok(
      storeEetCertificate({
        certificate: await getEetTestCertificateFile("CZ9876543210" as EetEic),
        isTestCertificate: false,
      })
    )

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ unsupportedReason: "taxpayer" }])
    await expect(
      run(deliverEetReversal({ id: reversalId, deviceId: context.deviceId }))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "EetSaleUnsupportedError" },
    })
  })

  test("marks a reversal unsupported while EET is off", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    await using run = testCreateRun(context.deps)
    await run.ok(disableEet())

    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })

    if (reversalId === null) throw new Error("Expected a reversal.")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ unsupportedReason: "disabled" }])
  })
})

describe("deliverEetReversal", () => {
  test("sends the negative amount at the moment of the refund", async () => {
    await using context = await createEetTestContext({
      now: new Date("2027-01-09T15:45:36.000Z"),
    })
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    context.clock.advance(
      new Date("2027-01-10T08:00:00.000Z").getTime() -
        context.clock.date.now().getTime()
    )
    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 25_000,
    })
    if (reversalId === null) throw new Error("Expected a reversal.")

    await expect(
      run.orThrow(
        deliverEetReversal({ id: reversalId, deviceId: context.deviceId })
      )
    ).resolves.toMatchObject({ type: "accepted" })

    const [sale, reversal] = context.responder.requests
    expect(reversal?.data).toMatchObject({
      celk_trzba: "-250.00",
      dat_trzby: "2027-01-10T09:00:00+01:00",
    })
    expect(reversal?.data.porad_cis).not.toBe(sale?.data.porad_cis)
    expect(reversal?.header.uuid_zpravy).not.toBe(sale?.header.uuid_zpravy)
    expect(reversal?.header.prvni_zaslani).toBe("true")
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([{ pok: expect.stringMatching(/-ff$/u) }])
  })

  test("waits while its sale is not confirmed", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })
    if (reversalId === null) throw new Error("Expected a reversal.")
    await using run = testCreateRun(context.deps)

    await expect(
      run(deliverEetReversal({ id: reversalId, deviceId: context.deviceId }))
    ).resolves.toEqual({
      ok: false,
      error: { type: "EetReversalWaitingForSaleError", id: reversalId },
    })
    expect(context.responder.requests).toEqual([])
  })

  test("stays pending while EET cannot be reached", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const { paymentId, saleId } = await createSaleToReverse(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    const reversalId = await reverseRefund(context, {
      paymentId,
      saleId,
      amount: 5_000,
    })
    if (reversalId === null) throw new Error("Expected a reversal.")
    context.responder.answerNext({ type: "timeout" })

    await expect(
      run.orThrow(
        deliverEetReversal({ id: reversalId, deviceId: context.deviceId })
      )
    ).resolves.toMatchObject({ type: "retry" })
    await expect(
      context.deps.evolu.loadQuery(eetReversalByIdQuery(reversalId))
    ).resolves.toMatchObject([
      { pok: null, lastAttemptResult: "retry", hadUnansweredAttempt: 1 },
    ])
  })
})
