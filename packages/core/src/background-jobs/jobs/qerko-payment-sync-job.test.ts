import { testCreateConsole, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { ConnectivityDep } from "../../deps.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createNostrRelayClient } from "../../integrations/nostr/nostr-relay-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { saveQerkoPaymentAccount } from "../../modules/account/account-actions.ts"
import { createQerkoPaymentAccountId } from "../../modules/account/account-utils.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import { preparePaymentMethod } from "../../modules/payment/payment-preparation-actions.ts"
import { startQerkoPayment } from "../../modules/payment/payment-qerko-payment-actions.ts"
import { qerkoPaymentAttemptsByPaymentIdQuery } from "../../modules/payment/payment-queries.ts"
import { reconciliationClaimsByPaymentIdQuery } from "../../modules/payment/payment-test-fixtures.ts"
import { saveQerkoPlugin } from "../../modules/qerko-plugin/qerko-plugin-actions.ts"
import { createRowId } from "../../modules/shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../../modules/shared/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import {
  createTestDeviceAccountDep,
  testNotificationsDep,
} from "../../testing/background-jobs.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import {
  createQerkoPaymentSyncJob,
  getQerkoPaymentSyncDelayMs,
} from "./qerko-payment-sync-job.ts"

const accountId = createQerkoPaymentAccountId("CZK")

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const until = async (condition: () => Promise<boolean>, what: string) => {
  for (let i = 0; i < 200; i++) {
    if (await condition()) return
    await sleep(5)
  }
  throw new Error(`timed out waiting for ${what}`)
}

const setup = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const clock = createTestDateDep()
  const qerko = { state: "PROCESSING", requests: 0 }
  let paymentId = ""
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
    ...createQerkoApiDep({ posId: "pos" }),
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith("/get-payment")) throw new Error("unexpected")
      qerko.requests += 1
      const body = JSON.parse(String(init?.body)) as { paymentId: string }
      return Response.json({
        id: body.paymentId,
        idBill: paymentId,
        currency: "CZK",
        state: qerko.state,
        items: [{ name: "Platba", price: "100", quantity: "1" }],
        parts: [
          {
            provider: { id: "qerko", name: "Card", type: "CARD" },
            total: "100",
          },
        ],
      })
    },
  }
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
  const id = await run.orThrow(
    createPayment({
      deviceId: null,
      billId: null,
      tableId: null,
      amount: NonNegativeInteger(10_000),
      currency: "CZK",
      tipAmount: NonNegativeInteger(0),
      canceledAt: null,
      expiresAt: null,
    })
  )
  paymentId = id
  await run.orThrow(
    preparePaymentMethod({ paymentId: id, qerkoPayment: { accountId } })
  )
  await run.orThrow(
    startQerkoPayment({
      id: "qerko-1",
      idBill: id,
      currency: "CZK",
      state: "STARTED",
      items: [{ name: "Platba", price: "100", quantity: "1" }],
      parts: [],
    })
  )

  const connectivity: ConnectivityDep = {
    connectivity: { onOnline: () => () => {} },
  }
  const startJob = async (graceMs: number) => {
    const device = await createTestDeviceAccountDep()
    const jobDeps: AppBackgroundJobContext = {
      ...device.deviceAccount,
      ...deps,
      ...createEetApiDep({ ...deps, ...clock }),
      ...connectivity,
      ...createQerkoSocketDep(),
      ...createQerkoConnectionStatusDep(),
      deviceId: createRowId<"Device">(),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      tableSelfPayRoot: new Uint8Array(32),
      selfPayDefaultRelays: [],
      nostrRelayClient: createNostrRelayClient(),
      console: testCreateConsole(),
      onError: () => {},
    }
    const jobRun = testCreateRun(jobDeps)
    const job = await jobRun.ok(
      createQerkoPaymentSyncJob({ graceMs, retryBaseDelayMs: 5 })
    )
    return {
      [Symbol.asyncDispose]: async () => {
        await job[Symbol.asyncDispose]()
        await jobRun[Symbol.asyncDispose]()
        await device[Symbol.asyncDispose]()
      },
    }
  }

  return {
    qerko,
    startJob,
    attempts: () => evolu.loadQuery(qerkoPaymentAttemptsByPaymentIdQuery(id)),
    claims: () => evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id)),
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("getQerkoPaymentSyncDelayMs", () => {
  test("doubles from 5 s up to a minute", () => {
    expect(getQerkoPaymentSyncDelayMs(0)).toBe(5_000)
    expect(getQerkoPaymentSyncDelayMs(2)).toBe(20_000)
    expect(getQerkoPaymentSyncDelayMs(10)).toBe(60_000)
  })
})

describe("qerko payment sync job", () => {
  test("leaves an attempt to the websocket during the grace period", async () => {
    await using test = await setup()
    await using _job = await test.startJob(60_000)

    await sleep(50)

    expect(test.qerko.requests).toBe(0)
  })

  test("asks get-payment after the grace period until Qerko says PAID", async () => {
    await using test = await setup()
    await using _job = await test.startJob(10)

    await until(async () => test.qerko.requests >= 2, "repeated polls")
    expect(await test.attempts()).toMatchObject([
      { processingAt: expect.any(Number), closedAt: null },
    ])

    test.qerko.state = "PAID"
    await until(
      async () => (await test.attempts())[0]?.outcome === "paid",
      "the payment to settle"
    )
    expect(await test.claims()).toHaveLength(1)

    const requests = test.qerko.requests
    await sleep(50)
    expect(test.qerko.requests).toBe(requests)
  })

  test("a final state that is not PAID closes the attempt without money", async () => {
    await using test = await setup()
    test.qerko.state = "CANCELLED"
    await using _job = await test.startJob(0)

    await until(
      async () => (await test.attempts())[0]?.outcome === "failed",
      "the attempt to fail"
    )
    expect(await test.claims()).toEqual([])
  })
})
