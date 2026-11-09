import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { ConnectivityDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createAccount } from "../../modules/account/account-actions.ts"
import {
  addManualAmountToBill,
  createBill,
} from "../../modules/bill/bill-actions.ts"
import { loadBillStatusSnapshot } from "../../modules/bill/bill-guards.ts"
import type { BillId } from "../../modules/bill/bill-types.ts"
import type { DeviceId } from "../../modules/device/device-types.ts"
import {
  createEetSale,
  disableEet,
  enableEet,
  retryEetSale,
  saveEetTipOwner,
  selectEetEnvironment,
} from "../../modules/eet/eet-actions.ts"
import {
  eetReversalsByPaymentIdQuery,
  eetSalesByPaymentIdQuery,
} from "../../modules/eet/eet-queries.ts"
import {
  configureEet,
  createEetTestContext,
  createTestPayment,
  type EetTestContext,
  settleByTransfer,
  settleInCash,
  settleWithLightning,
} from "../../modules/eet/eet-test-fixtures.ts"
import { toEetCashRegisterId } from "../../modules/eet/eet-utils.ts"
import { markPaymentPaidIban } from "../../modules/payment/payment-actions.ts"
import {
  paymentClaimsQuery,
  paymentDetailQuery,
} from "../../modules/payment/payment-queries.ts"
import { derivePaymentStatus } from "../../modules/payment/payment-status-utils.ts"
import type { PaymentId } from "../../modules/payment/payment-types.ts"
import {
  refundPayment,
  refundWholePayment,
} from "../../modules/refund/refund-actions.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
import {
  IbanSchema,
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  TimestampMs,
} from "../../modules/shared/schema.ts"
import {
  createTestDeviceAccountDep,
  testNotificationsDep,
} from "../../testing/background-jobs.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import {
  createEetReportingJob,
  getEetRetryDelayMs,
} from "./eet-reporting-job.ts"

const allEetSalesQuery = createQuery((db) =>
  db.selectFrom("eetSale").select(["paymentId", "deviceId"])
)

const createConnectivity = (): ConnectivityDep & {
  readonly goOnline: () => void
} => {
  const listeners = new Set<() => void>()
  return {
    connectivity: {
      onOnline: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    goOnline: () => {
      for (const listener of listeners) listener()
    },
  }
}

const startJob = async (
  context: EetTestContext,
  {
    deviceId = context.deviceId,
    connectivity = createConnectivity(),
    retryBaseDelayMs = 10,
    priorityPeriodMs,
  }: {
    readonly deviceId?: DeviceId
    readonly connectivity?: ConnectivityDep
    readonly retryBaseDelayMs?: number
    readonly priorityPeriodMs?: number
  } = {}
) => {
  const errors: unknown[] = []
  const device = await createTestDeviceAccountDep()
  const jobDeps: AppBackgroundJobContext = {
    ...device.deviceAccount,
    ...testNotificationsDep(),
    ...context.deps,
    ...createQerkoApiDep({ posId: "test" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    ...connectivity,
    deviceId,
    onError: (error) => {
      errors.push(error)
    },
  }
  const run = testCreateRun(jobDeps)
  const job = await run.ok(
    createEetReportingJob({ retryBaseDelayMs, priorityPeriodMs })
  )

  return {
    errors,
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
      await device[Symbol.asyncDispose]()
    },
  }
}

const saleOf = async (context: EetTestContext, paymentId: PaymentId) =>
  (
    await context.deps.evolu.loadQuery(eetSalesByPaymentIdQuery(paymentId))
  ).filter(({ extraFrom }) => extraFrom === null)

const settleLater = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const createTestBill = async (context: EetTestContext): Promise<BillId> => {
  await using run = testCreateRun(context.deps)
  return await run.ok(
    createBill({
      deviceId: context.deviceId,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId: null,
      currency: "CZK",
    })
  )
}

describe("getEetRetryDelayMs", () => {
  test("starts at 30 seconds, doubles, and stops at 15 minutes", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7].map((attempt) => getEetRetryDelayMs(attempt))
    ).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 900_000])
  })
})

describe("eet reporting job: sale records", () => {
  test("reports a cash payment on a bill", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const billId = await createTestBill(context)
    const paymentId = await createTestPayment(context, { billId })

    await settleInCash(context, paymentId)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([
        {
          billId,
          method: "cashRegister",
          pok: expect.stringMatching(/-ff$/u),
        },
      ])
    expect(job.errors).toEqual([])
  })

  test("reports a bank payment on the device that confirmed it by hand", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const tabletDeviceId = createRowId<"Device">()
    await using phone = await startJob(context)
    await using tablet = await startJob(context, { deviceId: tabletDeviceId })
    await using run = testCreateRun(context.deps)
    const ibanAccountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Bank account"),
        iban: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          currency: "CZK",
        },
      })
    )
    const paymentId = await createTestPayment(context)

    await run.orThrow(
      markPaymentPaidIban({
        paymentId,
        accountId: ibanAccountId,
        deviceId: tabletDeviceId,
      })
    )

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([
        { deviceId: tabletDeviceId, method: "iban", pok: expect.any(String) },
      ])
    expect(context.responder.requests).toMatchObject([
      { data: { id_pokl: toEetCashRegisterId(tabletDeviceId) } },
    ])
    expect([...phone.errors, ...tablet.errors]).toEqual([])
  })

  test("reports an automatically matched payment on the device that created it", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const tabletDeviceId = createRowId<"Device">()
    await using phone = await startJob(context)
    await using tablet = await startJob(context, { deviceId: tabletDeviceId })
    const paymentId = await createTestPayment(context, {
      deviceId: tabletDeviceId,
    })

    await settleByTransfer(context, paymentId)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([
        {
          deviceId: tabletDeviceId,
          cashRegisterId: toEetCashRegisterId(tabletDeviceId),
          method: "iban",
          pok: expect.any(String),
        },
      ])
    expect(context.responder.requests).toMatchObject([
      { data: { id_pokl: toEetCashRegisterId(tabletDeviceId) } },
    ])
    expect([...phone.errors, ...tablet.errors]).toEqual([])
  })

  test("reports a keypad Lightning payment without a bill", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)

    await settleWithLightning(context, paymentId)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ billId: null, method: "spark" }])
    expect(job.errors).toEqual([])
  })

  test("reports each payment of a bill paid in two payments", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const billId = await createTestBill(context)
    const first = await createTestPayment(context, { billId, amount: 10_000 })
    const second = await createTestPayment(context, { billId, amount: 15_000 })

    await settleInCash(context, first)
    await settleInCash(context, second)

    await expect
      .poll(() => context.deps.evolu.loadQuery(allEetSalesQuery))
      .toHaveLength(2)
    expect(await saleOf(context, first)).toMatchObject([{ amount: 10_000 }])
    expect(await saleOf(context, second)).toMatchObject([{ amount: 15_000 }])
    expect(job.errors).toEqual([])
  })

  test("never reports a payment settled before EET was enabled", async () => {
    await using context = await createEetTestContext()
    await configureEet(context, { enabled: false })
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    context.clock.advance(1_000)
    await using run = testCreateRun(context.deps)

    await run.orThrow(enableEet())
    await settleLater(100)

    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([])
    expect(context.responder.requests).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("never reports a payment settled while EET was disabled", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    await using run = testCreateRun(context.deps)
    await run.ok(disableEet())
    context.clock.advance(1_000)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    context.clock.advance(1_000)

    await run.orThrow(enableEet())
    await settleLater(100)

    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("never reports a payment with no device", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context, { priorityPeriodMs: 100 })
    const paymentId = await createTestPayment(context, { deviceId: null })

    await settleByTransfer(context, paymentId)
    context.clock.advance(1_000)
    await settleLater(300)

    await expect(saleOf(context, paymentId)).resolves.toEqual([])
    expect(context.responder.requests).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("reports a canceled payment that still received money", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    // Canceled after the money was recorded, as a merge from another device
    // lands: on one device a hand confirmation refuses a canceled payment
    // (payment/0004).
    await runMutationWithCompletion((options) =>
      context.deps.evolu.update(
        "payment",
        {
          id: paymentId,
          canceledAt: TimestampMs(context.clock.date.now().getTime()),
        },
        options
      )
    )

    await expect.poll(() => saleOf(context, paymentId)).toHaveLength(1)
    expect(job.errors).toEqual([])
  })

  test("keeps a euro payment unsent and unsupported", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    await using run = testCreateRun(context.deps)
    const euroCashRegister = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Euro cash register"),
        cashRegister: { currency: "EUR" },
      })
    )
    const paymentId = await createTestPayment(context, { currency: "EUR" })

    await settleInCash(context, paymentId, { accountId: euroCashRegister })

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ unsupportedReason: "currency", lastAttemptAt: null }])
    await settleLater(100)
    expect(context.responder.requests).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("creates one record when two devices see the same payment", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using originating = await startJob(context)
    await using other = await startJob(context, {
      deviceId: createRowId<"Device">(),
    })
    const paymentId = await createTestPayment(context)

    await settleInCash(context, paymentId)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([
      { paymentId, deviceId: context.deviceId },
    ])
    expect(context.responder.requests).toHaveLength(1)
    expect([...originating.errors, ...other.errors]).toEqual([])
  })

  test("makes no request while EET is disabled and nothing is pending", async () => {
    await using context = await createEetTestContext()
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)

    await settleInCash(context, paymentId)
    await settleLater(100)

    expect(context.responder.requests).toEqual([])
    expect(await context.deps.evolu.loadQuery(allEetSalesQuery)).toEqual([])
    expect(job.errors).toEqual([])
  })
})

describe("eet reporting job: delivery", () => {
  const reportOnePayment = async (context: EetTestContext) => {
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    return paymentId
  }

  test("stores the POK and every warning of a confirmation", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({
      type: "confirm",
      warnings: [{ code: 5, message: "dat_trzby is too old" }],
    })
    await using job = await startJob(context)

    const paymentId = await reportOnePayment(context)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([
        {
          pok: expect.stringMatching(/-ff$/u),
          warningsJson: JSON.stringify([
            { code: 5, message: "dat_trzby is too old" },
          ]),
        },
      ])
    expect(context.responder.requests).toHaveLength(1)
    expect(job.errors).toEqual([])
  })

  test.each([-1, 8])(
    "retries EET error %i until a POK arrives",
    async (code) => {
      await using context = await createEetTestContext()
      await configureEet(context)
      context.responder.answerNext({ type: "error", code, message: "Later" })
      await using job = await startJob(context)

      const paymentId = await reportOnePayment(context)

      await expect
        .poll(() => saleOf(context, paymentId))
        .toMatchObject([{ pok: expect.any(String), hadUnansweredAttempt: 0 }])
      const [first, second] = context.responder.requests
      expect(second?.data).toEqual(first?.data)
      expect(second?.header.uuid_zpravy).not.toBe(first?.header.uuid_zpravy)
      expect(second?.header.prvni_zaslani).toBe("false")
      expect(job.errors).toEqual([])
    }
  )

  test("retries a timed-out delivery and remembers it went unanswered", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({ type: "timeout" })
    await using job = await startJob(context)

    const paymentId = await reportOnePayment(context)

    await expect
      .poll(() => saleOf(context, paymentId), { timeout: 3_000 })
      .toMatchObject([
        { pok: expect.any(String), hadUnansweredAttempt: sqliteTrue },
      ])
    expect(context.responder.requests).toHaveLength(2)
    expect(job.errors).toEqual([])
  })

  test.each([
    {
      answer: { type: "error", code: 4, message: "Neplatny podpis" },
      errorType: "EetErrorCode",
    },
    {
      answer: { type: "tamperedConfirmation" },
      errorType: "EetSignatureError",
    },
  ] as const)(
    "rejects $errorType without retrying",
    async ({ answer, errorType }) => {
      await using context = await createEetTestContext()
      await configureEet(context)
      context.responder.answerNext(answer)
      await using job = await startJob(context)

      const paymentId = await reportOnePayment(context)

      await expect
        .poll(() => saleOf(context, paymentId))
        .toMatchObject([
          {
            lastAttemptResult: "rejected",
            lastErrorType: errorType,
            pok: null,
          },
        ])
      await settleLater(100)
      expect(context.responder.requests).toHaveLength(1)
      expect(job.errors).toEqual([])
    }
  )

  test("keeps retrying past the 48-hour deadline", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const paymentId = await reportOnePayment(context)
    context.clock.advance(49 * 60 * 60 * 1000)
    context.responder.answerNext({ type: "networkFailure" })

    await using job = await startJob(context)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    expect(context.responder.requests).toHaveLength(2)
    expect(job.errors).toEqual([])
  })

  test("keeps retrying a temporary error with no attempt limit", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext(
      ...Array.from(
        { length: 12 },
        () => ({ type: "error", code: -1, message: "Later" }) as const
      )
    )
    await using job = await startJob(context, { retryBaseDelayMs: 0 })

    const paymentId = await reportOnePayment(context)

    await expect
      .poll(() => saleOf(context, paymentId), { timeout: 5_000 })
      .toMatchObject([{ pok: expect.any(String) }])
    expect(context.responder.requests).toHaveLength(13)
    expect(job.errors).toEqual([])
  })

  test("retries at once when the device comes back online", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({ type: "networkFailure" })
    const connectivity = createConnectivity()
    await using job = await startJob(context, {
      connectivity,
      retryBaseDelayMs: 60_000,
    })

    const paymentId = await reportOnePayment(context)
    await expect.poll(() => context.responder.requests).toHaveLength(1)
    connectivity.goOnline()

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    expect(job.errors).toEqual([])
  })

  test("retries at once when the device comes back online during an attempt", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({ type: "timeout" })
    const connectivity = createConnectivity()
    await using job = await startJob(context, {
      connectivity,
      retryBaseDelayMs: 60_000,
    })

    const paymentId = await reportOnePayment(context)
    await expect.poll(() => context.responder.requests).toHaveLength(1)
    const [inFlight] = await saleOf(context, paymentId)
    connectivity.goOnline()

    expect(inFlight).toMatchObject({
      attemptStartedAt: expect.any(Number),
      lastAttemptAt: null,
    })
    await expect
      .poll(() => saleOf(context, paymentId), { timeout: 3_000 })
      .toMatchObject([{ pok: expect.any(String) }])
    expect(context.responder.requests).toHaveLength(2)
    expect(job.errors).toEqual([])
  })

  test("never sends a confirmed sale again", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const connectivity = createConnectivity()
    await using job = await startJob(context, { connectivity })

    const paymentId = await reportOnePayment(context)
    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    connectivity.goOnline()
    await settleLater(100)

    expect(context.responder.requests).toHaveLength(1)
    expect(job.errors).toEqual([])
  })

  test("keeps sandbox sales in the sandbox after switching to production", async () => {
    await using context = await createEetTestContext({
      productionUrl: "https://eet.invalid/production",
    })
    await configureEet(context, { environment: "playground" })
    context.responder.answerNext({ type: "error", code: 8, message: "Later" })
    await using job = await startJob(context, { retryBaseDelayMs: 250 })
    const sandboxPayment = await reportOnePayment(context)
    await expect.poll(() => context.responder.requests).toHaveLength(1)
    await using run = testCreateRun(context.deps)

    await run.orThrow(selectEetEnvironment("production"))
    const productionPayment = await reportOnePayment(context)

    await expect
      .poll(() => saleOf(context, sandboxPayment))
      .toMatchObject([{ environment: "playground", pok: expect.any(String) }])
    await expect
      .poll(() => saleOf(context, productionPayment))
      .toMatchObject([{ environment: "production", pok: expect.any(String) }])
    const urlOf = (sequenceNumber: string) =>
      context.responder.requests
        .filter(({ data }) => data.porad_cis === sequenceNumber)
        .map(({ url }) => new URL(url).hostname)
    expect(new Set(urlOf(sandboxPayment))).toEqual(
      new Set(["pg.trzbyeet.gov.cz"])
    )
    expect(urlOf(productionPayment)).toEqual(["eet.invalid"])
    expect(job.errors).toEqual([])
  })

  test("leaves a payment paid and its bill closed when EET rejects the sale", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({ type: "error", code: 4, message: "Refused" })
    await using job = await startJob(context)
    await using run = testCreateRun(context.deps)
    const billId = await createTestBill(context)
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: context.deviceId,
        totalAmount: NonNegativeInteger(25_000),
        name: NonEmptyString255("Lunch"),
        currency: "CZK",
      })
    )
    const paymentId = await createTestPayment(context, { billId })

    await settleInCash(context, paymentId)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ lastAttemptResult: "rejected" }])
    const [payment] = await context.deps.evolu.loadQuery(
      paymentDetailQuery(paymentId)
    )
    if (payment === undefined) throw new Error("Expected a payment.")
    const claims = await context.deps.evolu.loadQuery(
      paymentClaimsQuery(paymentId)
    )
    expect(
      derivePaymentStatus({
        canceledAt: payment.canceledAt,
        confirmedPaidAt: payment.confirmedPaidAt,
        expiresAt: payment.expiresAt,
        hasActiveClaim: claims.length > 0,
        now: context.clock.date.now(),
      })
    ).toBe("paid")
    await expect(
      run.orThrow(loadBillStatusSnapshot(billId))
    ).resolves.toMatchObject({
      status: "closed",
      coverage: "paid",
    })
    expect(job.errors).toEqual([])
  })
})

const refundInCash = async (
  context: EetTestContext,
  {
    paymentId,
    amount,
    deviceId = context.deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly amount: number
    readonly deviceId?: DeviceId | null
  }
) => {
  await using run = testCreateRun(context.deps)
  return await run.orThrow(
    refundPayment({
      paymentId,
      method: "cashRegister",
      deviceId,
      amount: NonNegativeInteger(amount),
    })
  )
}

const reversalsOf = (context: EetTestContext, paymentId: PaymentId) =>
  context.deps.evolu.loadQuery(eetReversalsByPaymentIdQuery(paymentId))

describe("eet reporting job: reversals", () => {
  test("reverses a cash refund of a confirmed sale", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId, { receivedAmount: 25_000 })
    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.stringMatching(/-ff$/u) }])

    await refundInCash(context, { paymentId, amount: 5_000 })

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 5_000, pok: expect.stringMatching(/-ff$/u) }])
    expect(context.responder.requests.at(-1)?.data.celk_trzba).toBe("-50.00")
    expect(job.errors).toEqual([])
  })

  test("reverses the whole crowns a cash refund of a transfer handed out", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context, {
      amount: 6_330,
      tipAmount: 580,
    })
    await settleByTransfer(context, paymentId, {
      amount: 6_330,
      deviceId: context.deviceId,
    })
    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.stringMatching(/-ff$/u) }])

    await using run = testCreateRun(context.deps)
    await run.orThrow(
      refundWholePayment({
        paymentId,
        method: "cashRegister",
        deviceId: context.deviceId,
      })
    )

    await expect
      .poll(async () =>
        (await reversalsOf(context, paymentId))
          .filter(({ pok }) => pok !== null)
          .map(({ amount }) => amount)
          .sort((a, b) => b - a)
      )
      .toEqual([5_720, 580])
    expect(job.errors).toEqual([])
  })

  test("sends a reversal only once its sale is confirmed", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({
      type: "error",
      code: 4,
      message: "Neplatny podpis SOAP zpravy",
    })
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId, { receivedAmount: 25_000 })
    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ lastAttemptResult: "rejected" }])

    await refundInCash(context, { paymentId, amount: 25_000 })
    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 25_000, pok: null, lastAttemptAt: null }])
    await settleLater(100)
    expect(context.responder.requests).toHaveLength(1)

    const [sale] = await saleOf(context, paymentId)
    if (sale === undefined) throw new Error("Expected a sale.")
    await using run = testCreateRun(context.deps)
    await run.orThrow(retryEetSale({ id: sale.id, deviceId: context.deviceId }))

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ pok: expect.stringMatching(/-ff$/u) }])
    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["250.00", "250.00", "-250.00"])
    expect(job.errors).toEqual([])
  })

  test("reverses a refund recorded before its sale was created", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    await refundInCash(context, { paymentId, amount: 5_000 })
    await expect(saleOf(context, paymentId)).resolves.toEqual([])

    await using job = await startJob(context)

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 5_000, pok: expect.stringMatching(/-ff$/u) }])
    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["250.00", "-50.00"])
    expect(job.errors).toEqual([])
  })

  test("reverses nothing for a payment settled before EET was enabled", async () => {
    await using context = await createEetTestContext()
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    context.clock.advance(1_000)
    await configureEet(context)
    await using job = await startJob(context)

    await refundInCash(context, { paymentId, amount: 5_000 })
    await settleLater(100)

    await expect(reversalsOf(context, paymentId)).resolves.toEqual([])
    expect(context.responder.requests).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("reverses nothing for a refund with no device", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context, { priorityPeriodMs: 100 })
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])

    await refundInCash(context, { paymentId, amount: 5_000, deviceId: null })
    context.clock.advance(1_000)
    await settleLater(300)

    await expect(reversalsOf(context, paymentId)).resolves.toEqual([])
    expect(context.responder.requests).toHaveLength(1)
    expect(job.errors).toEqual([])
  })

  test("leaves a refund to the device that recorded it", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.stringMatching(/-ff$/u) }])

    await refundInCash(context, {
      paymentId,
      amount: 5_000,
      deviceId: createRowId<"Device">(),
    })
    await settleLater(100)

    await expect(reversalsOf(context, paymentId)).resolves.toEqual([])
    expect(job.errors).toEqual([])
  })
})

describe("eet reporting job: takeover", () => {
  test("reports a payment on the device that settled it in cash", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const tabletDeviceId = createRowId<"Device">()
    await using phone = await startJob(context)
    await using tablet = await startJob(context, { deviceId: tabletDeviceId })
    const paymentId = await createTestPayment(context)

    await settleInCash(context, paymentId, { deviceId: tabletDeviceId })

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ deviceId: tabletDeviceId, pok: expect.any(String) }])
    expect(context.responder.requests).toMatchObject([
      {
        header: { prvni_zaslani: "true" },
        data: { id_pokl: toEetCashRegisterId(tabletDeviceId) },
      },
    ])
    expect([...phone.errors, ...tablet.errors]).toEqual([])
  })

  test("takes over a pending sale once its device's priority is over", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    context.responder.answerNext({ type: "networkFailure" })
    const paymentId = await createTestPayment(context)
    {
      await using recording = await startJob(context, {
        retryBaseDelayMs: 60_000,
      })
      await settleInCash(context, paymentId)
      await expect.poll(() => context.responder.requests).toHaveLength(1)
      expect(recording.errors).toEqual([])
    }
    await using other = await startJob(context, {
      deviceId: createRowId<"Device">(),
      priorityPeriodMs: 100,
    })

    await settleLater(300)
    expect(context.responder.requests).toHaveLength(1)
    context.clock.advance(1_000)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    const [first, second] = context.responder.requests
    expect(second?.data).toEqual(first?.data)
    expect(first?.header.prvni_zaslani).toBe("true")
    expect(second?.header.prvni_zaslani).toBe("false")
    expect(other.errors).toEqual([])
  })

  test("creates a sale its recording device never created", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using other = await startJob(context, {
      deviceId: createRowId<"Device">(),
      priorityPeriodMs: 100,
    })
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)

    await settleLater(300)
    await expect(saleOf(context, paymentId)).resolves.toEqual([])
    context.clock.advance(1_000)

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([
        {
          deviceId: context.deviceId,
          cashRegisterId: toEetCashRegisterId(context.deviceId),
          pok: expect.any(String),
        },
      ])
    expect(context.responder.requests).toMatchObject([
      {
        header: { prvni_zaslani: "false" },
        data: { id_pokl: toEetCashRegisterId(context.deviceId) },
      },
    ])
    expect(other.errors).toEqual([])
  })

  test("takes over a reversal only after its sale's confirmation and the priority", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const paymentId = await createTestPayment(context)
    {
      await using recording = await startJob(context)
      await settleInCash(context, paymentId)
      await expect
        .poll(() => saleOf(context, paymentId))
        .toMatchObject([{ pok: expect.any(String) }])
      expect(recording.errors).toEqual([])
    }
    await refundInCash(context, { paymentId, amount: 5_000 })
    await using other = await startJob(context, {
      deviceId: createRowId<"Device">(),
      priorityPeriodMs: 100,
    })

    await settleLater(300)
    await expect(reversalsOf(context, paymentId)).resolves.toEqual([])
    context.clock.advance(1_000)

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([
        {
          deviceId: context.deviceId,
          cashRegisterId: toEetCashRegisterId(context.deviceId),
          pok: expect.any(String),
        },
      ])
    expect(context.responder.requests.at(-1)).toMatchObject({
      header: { prvni_zaslani: "false" },
      data: { celk_trzba: "-50.00" },
    })
    expect(other.errors).toEqual([])
  })
})

const salesOf = (context: EetTestContext, paymentId: PaymentId) =>
  context.deps.evolu.loadQuery(eetSalesByPaymentIdQuery(paymentId))

const settleTwice = async (context: EetTestContext, paymentId: PaymentId) => {
  await settleInCash(context, paymentId)
  context.clock.advance(1_000)
  await settleByTransfer(context, paymentId, { deviceId: context.deviceId })
}

describe("eet reporting job: extra money", () => {
  test("reports a payment settled twice as its sale and an extra sale", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)

    await settleTwice(context, paymentId)

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        {
          extraFrom: null,
          amount: 25_000,
          method: "cashRegister",
          pok: expect.any(String),
        },
        {
          extraFrom: 0,
          accountTransactionId: null,
          amount: 25_000,
          method: "iban",
          deviceId: context.deviceId,
          pok: expect.any(String),
        },
      ])
    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["250.00", "250.00"])
    const [sale, extraSale] = await salesOf(context, paymentId)
    expect(extraSale?.sequenceNumber).not.toBe(sale?.sequenceNumber)
    expect(extraSale?.saleAt).not.toBe(sale?.saleAt)
    expect(job.errors).toEqual([])
  })

  test("reports no tip on an extra sale", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context, { tipAmount: 2_000 })

    await settleTwice(context, paymentId)

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, reportedTipAmount: 2_000 },
        { extraFrom: 0, reportedTipAmount: 0 },
      ])
    expect(job.errors).toEqual([])
  })

  test("reports the part of one transfer above the payment", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)

    await settleByTransfer(context, paymentId, {
      amount: 100_000,
      deviceId: context.deviceId,
    })

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, amount: 25_000, pok: expect.any(String) },
        { extraFrom: 0, amount: 75_000, pok: expect.any(String) },
      ])
    expect(job.errors).toEqual([])
  })

  test("reports a split as the money each settlement brought", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)

    await settleByTransfer(context, paymentId, {
      amount: 15_000,
      deviceId: context.deviceId,
    })
    context.clock.advance(1_000)
    await settleByTransfer(context, paymentId, {
      amount: 10_000,
      deviceId: context.deviceId,
    })

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, amount: 15_000, pok: expect.any(String) },
        { extraFrom: 0, amount: 10_000, pok: expect.any(String) },
      ])
    const [sale, extraSale] = await salesOf(context, paymentId)
    expect(extraSale?.saleAt).not.toBe(sale?.saleAt)
    expect(job.errors).toEqual([])
  })

  test("reports only what a short first settlement brought", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)

    await settleByTransfer(context, paymentId, {
      amount: 15_000,
      deviceId: context.deviceId,
    })

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, amount: 15_000, pok: expect.any(String) },
      ])
    await settleLater(100)
    await expect(salesOf(context, paymentId)).resolves.toHaveLength(1)
    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["150.00"])
    expect(job.errors).toEqual([])
  })

  test("reports each increase of the extra money once", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleTwice(context, paymentId)
    await expect.poll(() => salesOf(context, paymentId)).toHaveLength(2)

    await settleByTransfer(context, paymentId, {
      amount: 10_000,
      deviceId: context.deviceId,
    })

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, amount: 25_000 },
        { extraFrom: 0, amount: 25_000 },
        { extraFrom: 25_000, amount: 10_000, pok: expect.any(String) },
      ])
    expect(job.errors).toEqual([])
  })

  test("reports all extra money once the sale has taken off an employees' tip", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    {
      await using run = testCreateRun(context.deps)
      await run.ok(saveEetTipOwner("employees"))
    }
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context, { tipAmount: 2_000 })

    await settleTwice(context, paymentId)

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, amount: 23_000 },
        { extraFrom: 0, amount: 25_000 },
      ])
    expect(job.errors).toEqual([])
  })

  test("leaves the rest of an employees' tip out of the extra money", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    {
      await using run = testCreateRun(context.deps)
      await run.ok(saveEetTipOwner("employees"))
    }
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context, { tipAmount: 10_000 })

    await settleByTransfer(context, paymentId, {
      amount: 5_000,
      deviceId: context.deviceId,
    })
    context.clock.advance(1_000)
    await settleByTransfer(context, paymentId, {
      amount: 20_000,
      deviceId: context.deviceId,
    })

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, amount: 0, pok: expect.any(String) },
        { extraFrom: 0, amount: 15_000, pok: expect.any(String) },
      ])
    expect(job.errors).toEqual([])
  })

  test("reports a payment two devices settled while cut off from sync as one sale each", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const tablet = createRowId<"Device">()
    const paymentId = await createTestPayment(context)
    {
      await using phone = await startJob(context)
      await settleInCash(context, paymentId)
      await expect
        .poll(() => saleOf(context, paymentId))
        .toMatchObject([{ pok: expect.any(String) }])
      expect(phone.errors).toEqual([])
    }
    context.clock.advance(1_000)
    const transferId = await settleByTransfer(context, paymentId, {
      deviceId: tablet,
    })
    {
      await using run = testCreateRun(context.deps)
      await run.ok(
        createEetSale({
          payment: {
            id: paymentId,
            billId: null,
            amount: NonNegativeInteger(25_000),
            tipAmount: NonNegativeInteger(0),
            cashReceivedAmount: null,
            currency: "CZK",
            method: "iban",
            firstClaimedAt: TimestampMs(context.clock.date.now().getTime()),
            firstClaimTransactionId: transferId,
            firstSettlementValue: NonNegativeInteger(25_000),
          },
          deviceId: tablet,
        })
      )
    }
    await using job = await startJob(context, { deviceId: tablet })

    await expect
      .poll(() => saleOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }, { pok: expect.any(String) }])
    await settleLater(100)
    await expect(salesOf(context, paymentId)).resolves.toHaveLength(2)
    expect(context.responder.requests.map(({ data }) => data.id_pokl)).toEqual([
      toEetCashRegisterId(context.deviceId),
      toEetCashRegisterId(tablet),
    ])
    expect(job.errors).toEqual([])
  })

  test("never reports extra money brought while EET was disabled", async () => {
    await using context = await createEetTestContext()
    const paymentId = await createTestPayment(context)
    await settleTwice(context, paymentId)
    context.clock.advance(1_000)
    await configureEet(context)
    await using job = await startJob(context)

    await settleLater(100)

    await expect(salesOf(context, paymentId)).resolves.toEqual([])
    expect(context.responder.requests).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("creates one extra sale when two devices see it", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using phone = await startJob(context)
    await using tablet = await startJob(context, {
      deviceId: createRowId<"Device">(),
    })
    const paymentId = await createTestPayment(context)

    await settleTwice(context, paymentId)

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }, { pok: expect.any(String) }])
    await settleLater(100)
    await expect(salesOf(context, paymentId)).resolves.toHaveLength(2)
    expect([...phone.errors, ...tablet.errors]).toEqual([])
  })

  test("leaves automatically matched extra money to the device that created the payment", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const tabletDeviceId = createRowId<"Device">()
    await using phone = await startJob(context)
    await using tablet = await startJob(context, { deviceId: tabletDeviceId })
    const paymentId = await createTestPayment(context, {
      deviceId: tabletDeviceId,
    })

    await settleInCash(context, paymentId)
    context.clock.advance(1_000)
    await settleByTransfer(context, paymentId)

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, deviceId: context.deviceId },
        {
          extraFrom: 0,
          deviceId: tabletDeviceId,
          cashRegisterId: toEetCashRegisterId(tabletDeviceId),
          pok: expect.any(String),
        },
      ])
    expect([...phone.errors, ...tablet.errors]).toEqual([])
  })

  test("reports extra money on the device that matched it by hand", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const tabletDeviceId = createRowId<"Device">()
    await using phone = await startJob(context)
    await using tablet = await startJob(context, { deviceId: tabletDeviceId })
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    context.clock.advance(1_000)

    await settleByTransfer(context, paymentId, { deviceId: tabletDeviceId })

    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([
        { extraFrom: null, deviceId: context.deviceId },
        {
          extraFrom: 0,
          deviceId: tabletDeviceId,
          cashRegisterId: toEetCashRegisterId(tabletDeviceId),
          pok: expect.any(String),
        },
      ])
    expect(context.responder.requests.map(({ data }) => data.id_pokl)).toEqual([
      toEetCashRegisterId(context.deviceId),
      toEetCashRegisterId(tabletDeviceId),
    ])
    expect([...phone.errors, ...tablet.errors]).toEqual([])
  })
})

describe("eet reporting job: reversals of extra money", () => {
  test("returning the duplicate leaves the real sale reported", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleTwice(context, paymentId)
    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }, { pok: expect.any(String) }])

    await refundInCash(context, { paymentId, amount: 25_000 })

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 25_000, pok: expect.any(String) }])
    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["250.00", "250.00", "-250.00"])
    expect(job.errors).toEqual([])
  })

  test("returning everything reverses the sale and the extra money", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleTwice(context, paymentId)
    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }, { pok: expect.any(String) }])

    await refundInCash(context, { paymentId, amount: 50_000 })

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 50_000, pok: expect.any(String) }])
    expect(job.errors).toEqual([])
  })

  test("waits for the extra sale before reversing a refund", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const bankDeviceId = createRowId<"Device">()
    await using job = await startJob(context, { priorityPeriodMs: 100 })
    const paymentId = await createTestPayment(context)
    await settleByTransfer(context, paymentId, {
      amount: 15_000,
      deviceId: context.deviceId,
    })
    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    context.clock.advance(1_000)
    await settleByTransfer(context, paymentId, {
      amount: 10_000,
      deviceId: bankDeviceId,
    })

    await refundInCash(context, { paymentId, amount: 25_000 })
    await settleLater(300)
    await expect(reversalsOf(context, paymentId)).resolves.toEqual([])
    context.clock.advance(1_000)

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 25_000, pok: expect.any(String) }])
    expect(
      context.responder.requests.map(({ data }) => data.celk_trzba)
    ).toEqual(["150.00", "100.00", "-250.00"])
    expect(job.errors).toEqual([])
  })

  test("sends the reversal only once the extra sale is confirmed", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    context.responder.answerNext({
      type: "error",
      code: 4,
      message: "Neplatny podpis SOAP zpravy",
    })
    context.clock.advance(1_000)
    await settleByTransfer(context, paymentId, { deviceId: context.deviceId })
    await expect
      .poll(() => salesOf(context, paymentId))
      .toMatchObject([{}, { lastAttemptResult: "rejected" }])

    await refundInCash(context, { paymentId, amount: 25_000 })
    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ amount: 25_000, saleConfirmedAt: null }])
    await settleLater(100)
    expect(context.responder.requests).toHaveLength(2)

    const [, extraSale] = await salesOf(context, paymentId)
    if (extraSale === undefined) throw new Error("Expected an extra sale.")
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      retryEetSale({ id: extraSale.id, deviceId: context.deviceId })
    )

    await expect
      .poll(() => reversalsOf(context, paymentId))
      .toMatchObject([{ pok: expect.any(String) }])
    expect(job.errors).toEqual([])
  })

  test("refunding the second payment of an overpaid bill reverses only its sale", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    await using job = await startJob(context)
    const billId = await createTestBill(context)
    const first = await createTestPayment(context, { billId })
    const second = await createTestPayment(context, { billId })
    await settleInCash(context, first)
    await settleByTransfer(context, second, { deviceId: context.deviceId })
    await expect
      .poll(async () => [
        ...(await saleOf(context, first)),
        ...(await saleOf(context, second)),
      ])
      .toMatchObject([{ pok: expect.any(String) }, { pok: expect.any(String) }])

    await refundInCash(context, { paymentId: second, amount: 25_000 })

    await expect
      .poll(() => reversalsOf(context, second))
      .toMatchObject([{ amount: 25_000, pok: expect.any(String) }])
    await expect(reversalsOf(context, first)).resolves.toEqual([])
    expect(job.errors).toEqual([])
  })
})
