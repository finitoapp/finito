import { testCreateConsole, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { ConnectivityDep } from "../../deps.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import {
  createQerkoConnectionStatusDep,
  createQerkoConnectionStatusStore,
} from "../../integrations/qerko/qerko-connection-status.ts"
import { qerkoRpcTiming } from "../../integrations/qerko/qerko-rpc.ts"
import type {
  QerkoSocketDep,
  QerkoSocketHandlers,
} from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import {
  saveQerkoPaymentAccount,
  setQerkoPaymentConnectionDevice,
} from "../../modules/account/account-actions.ts"
import { createQerkoPaymentAccountId } from "../../modules/account/account-utils.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import { preparePaymentMethod } from "../../modules/payment/payment-preparation-actions.ts"
import { saveQerkoPlugin } from "../../modules/qerko-plugin/qerko-plugin-actions.ts"
import { createRowId } from "../../modules/shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../../modules/shared/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import {
  createQerkoPaymentConnectionJob,
  getQerkoReconnectDelayMs,
} from "./qerko-payment-connection-job.ts"

const accountId = createQerkoPaymentAccountId("CZK")

interface FakeConnection {
  readonly url: string
  readonly handlers: QerkoSocketHandlers
  readonly sent: Array<Record<string, unknown>>
  closed: boolean
}

const until = async (condition: () => boolean, what: string) => {
  for (let i = 0; i < 200; i++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`timed out waiting for ${what}`)
}

const setup = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const clock = createTestDateDep()
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
    ...createQerkoApiDep({ posId: "pos" }),
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    fetch: async () => {
      throw new Error("offline")
    },
  }
  const run = testCreateRun(deps)
  const deviceId = createRowId<"Device">()

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

  const connections: FakeConnection[] = []
  const qerkoSocket: QerkoSocketDep["qerkoSocket"] = {
    connect: (url, handlers) => {
      const connection: FakeConnection = {
        url,
        handlers,
        sent: [],
        closed: false,
      }
      connections.push(connection)
      return {
        send: (text) => connection.sent.push(JSON.parse(text)),
        close: () => {
          connection.closed = true
        },
      }
    },
  }
  let goOnline = (): void => {}
  const connectivity: ConnectivityDep = {
    connectivity: {
      onOnline: (listener) => {
        goOnline = listener
        return () => {}
      },
    },
  }
  const status = createQerkoConnectionStatusStore()
  const errors: unknown[] = []

  const jobDeps: AppBackgroundJobContext = {
    ...deps,
    ...createEetApiDep({ ...deps, ...clock }),
    ...connectivity,
    deviceId,
    lockManager: createInProcessLockManager(),
    console: testCreateConsole(),
    onError: (error) => {
      errors.push(error)
    },
    qerkoSocket,
    ...createQerkoConnectionStatusDep(status),
  }
  const jobRun = testCreateRun(jobDeps)
  const job = await jobRun.ok(
    createQerkoPaymentConnectionJob({
      retryBaseDelayMs: 5,
      timing: { ...qerkoRpcTiming, noopTimeoutMs: 60_000 },
    })
  )

  /** Opens the latest connection and lets Qerko authorize it. */
  const authorize = async () => {
    await until(() => connections.length > 0, "a connection")
    const connection = connections.at(-1)
    if (connection === undefined) throw new Error("no connection")
    connection.handlers.onOpen()
    connection.handlers.onMessage(
      JSON.stringify({ type: "auth-response", authorized: true, error: null })
    )
    await until(() => status.get().type === "connected", "connected")
    return connection
  }

  return {
    run,
    deviceId,
    connections,
    status,
    errors,
    authorize,
    goOnline: () => goOnline(),
    choose: (id: typeof deviceId | null) =>
      run.ok(setQerkoPaymentConnectionDevice({ accountId, deviceId: id })),
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await jobRun[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("getQerkoReconnectDelayMs", () => {
  test("doubles from a second up to a minute", () => {
    expect(getQerkoReconnectDelayMs(0)).toBe(1_000)
    expect(getQerkoReconnectDelayMs(3)).toBe(8_000)
    expect(getQerkoReconnectDelayMs(10)).toBe(60_000)
  })
})

describe("qerko payment connection job", () => {
  test("connects only on the device chosen to serve Qerko payments", async () => {
    await using test = await setup()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(test.connections).toEqual([])
    expect(test.status.get()).toEqual({ type: "idle" })

    await test.choose(test.deviceId)
    const connection = await test.authorize()

    expect(connection.url).toBe("wss://sandbox.qerko.com/api/v2/pos/ws")
    expect(connection.sent[0]).toEqual({
      type: "auth-request",
      posId: "pos",
      apiKey: "secret",
    })
  })

  test("connects only once the key is paired with a location", async () => {
    await using test = await setup()
    const savePlugin = (restaurantId: string | null) =>
      test.run.ok(
        saveQerkoPlugin({
          role: "standard",
          environment: "sandbox",
          apiKey: NonEmptyStringSchema.decode("secret"),
          apiKeyName: NonEmptyString255("Payky"),
          legalEntityName: NonEmptyString255("Cafe"),
          identificationNumber: NonEmptyString255("12345678"),
          country: "CZ",
          restaurantId:
            restaurantId === null ? null : NonEmptyString255(restaurantId),
        })
      )
    await savePlugin(null)
    await test.choose(test.deviceId)

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(test.connections).toEqual([])

    await savePlugin("restaurant-1")
    await test.authorize()
  })

  test("choosing another device hands the connection over", async () => {
    await using test = await setup()
    await test.choose(test.deviceId)
    const connection = await test.authorize()

    await test.choose(createRowId<"Device">())

    await until(() => connection.closed, "the connection to close")
    await until(() => test.status.get().type === "idle", "idle")
    expect(test.connections).toHaveLength(1)
  })

  test("answers Qerko's calls from the payments", async () => {
    await using test = await setup()
    const paymentId = await test.run.orThrow(
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
    await test.run.orThrow(
      preparePaymentMethod({ paymentId, qerkoPayment: { accountId } })
    )
    await test.choose(test.deviceId)
    const connection = await test.authorize()

    connection.handlers.onMessage(
      JSON.stringify({
        type: "method-call-request",
        uuid: "u-1",
        method: "searchBills",
        args: [paymentId, null],
      })
    )
    connection.handlers.onMessage(
      JSON.stringify({
        type: "method-call-request",
        uuid: "u-2",
        method: "searchBills",
        args: ["unknown", null],
      })
    )

    const reply = (uuid: string) =>
      connection.sent.find((message) => message.uuid === uuid)
    await until(
      () => reply("u-1") !== undefined && reply("u-2") !== undefined,
      "the replies"
    )
    expect(reply("u-1")).toMatchObject({
      type: "method-call-response",
      calledMethod: "searchBills",
      error: null,
      result: [{ id: paymentId, items: [{ price: "100" }] }],
    })
    expect(reply("u-2")).toMatchObject({ result: [], error: null })
  })

  test("a dropped line reconnects", async () => {
    await using test = await setup()
    await test.choose(test.deviceId)
    const first = await test.authorize()

    first.handlers.onClose(1006, "")

    await until(() => test.connections.length === 2, "a second connection")
    await test.authorize()
  })

  test("a connection taken over stays down until this device is chosen again", async () => {
    await using test = await setup()
    await test.choose(test.deviceId)
    const first = await test.authorize()

    first.handlers.onClose(4409, "conflict")

    await until(() => test.status.get().type === "stolen", "stolen")
    test.goOnline()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(test.connections).toHaveLength(1)

    test.status.resume()
    await until(() => test.connections.length === 2, "a reconnection")
  })

  test("a refused key waits for a new pairing", async () => {
    await using test = await setup()
    await test.choose(test.deviceId)
    const first = await test.authorize()

    first.handlers.onClose(4401, "AUTHORIZATION")
    await until(() => test.status.get().type === "unauthorized", "unauthorized")

    await test.run.ok(
      saveQerkoPlugin({
        role: "standard",
        environment: "sandbox",
        apiKey: NonEmptyStringSchema.decode("new-secret"),
        apiKeyName: NonEmptyString255("Payky"),
        legalEntityName: NonEmptyString255("Cafe"),
        identificationNumber: NonEmptyString255("12345678"),
        country: "CZ",
        restaurantId: NonEmptyString255("restaurant-1"),
      })
    )

    await until(() => test.connections.length === 2, "a reconnection")
    test.connections[1]?.handlers.onOpen()
    expect(test.connections[1]?.sent[0]).toMatchObject({ apiKey: "new-secret" })
    expect(test.errors).toEqual([])
  })
})
