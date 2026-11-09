import {
  sqliteFalse,
  sqliteTrue,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { ConnectivityDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { saveQerkoTerminalAccount } from "../../modules/account/account-actions.ts"
import { createQerkoTerminalAccountId } from "../../modules/account/account-utils.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import { preparePaymentMethod } from "../../modules/payment/payment-preparation-actions.ts"
import { startQerkoTerminalPayment } from "../../modules/payment/payment-qerko-actions.ts"
import { accountTransactionsByPaymentIdQuery } from "../../modules/payment/payment-test-fixtures.ts"
import type { PaymentId } from "../../modules/payment/payment-types.ts"
import { saveQerkoPlugin } from "../../modules/qerko-plugin/qerko-plugin-actions.ts"
import { tipRefundId } from "../../modules/refund/refund-actions.ts"
import { startQerkoTerminalRefund } from "../../modules/refund/refund-qerko-actions.ts"
import {
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "../../modules/refund/refund-queries.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../../modules/shared/evolu-utils.ts"
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
  createQerkoTerminalSyncJob,
  getQerkoPollDelayMs,
} from "./qerko-terminal-sync-job.ts"

const accountId = createQerkoTerminalAccountId("CZK")
const terminalId = NonEmptyString255("terminal-1")

const rowQuery = (id: PaymentId) =>
  createQuery((db) =>
    db.selectFrom("paymentQerkoTerminal").selectAll().where("id", "=", id)
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

const approved = (transactionId: string) => ({
  status: "approved",
  transactionId,
  currency: "CZK",
  amount: "129",
  chargedAmount: "129",
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

/** A payment with an attempt pending on a Qerko that answers `status` from `answer`. */
const setup = async ({
  tipAmount = 0,
}: {
  readonly tipAmount?: number
} = {}) => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const state = {
    answer: "pending" as "pending" | "approved",
    refundAnswer: "pending" as "pending" | "approved",
    polls: 0,
  }
  const clock = createTestDateDep()
  const connectivity = createConnectivity()
  let uuid = 0
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
    ...createQerkoApiDep({ posId: "pos" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    sparkWallet: { create: async () => createFakeSparkWallet({}) },
    ...createYadioApiDep(),
    uuid: {
      create: () =>
        `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).split("/pos/")[1]
      const body = JSON.parse(String(init?.body))
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
      if (path === "create-terminal-refund") {
        return Response.json({
          type: "started",
          refund: {
            status: "pending",
            transactionId: body.transactionId,
            step: "waitingForCard",
          },
        })
      }
      if (path === "get-terminal-refund-status") {
        return Response.json({
          type: "found",
          refund: {
            status: state.refundAnswer,
            transactionId: body.transactionId,
            ...(state.refundAnswer === "pending"
              ? { step: "waitingForCard" }
              : {}),
          },
        })
      }
      state.polls += 1
      return Response.json({
        type: "found",
        payment:
          state.answer === "approved"
            ? approved(body.transactionId)
            : {
                status: "pending",
                transactionId: body.transactionId,
                step: "waitingForCard",
              },
      })
    },
  }
  await using run = testCreateRun(deps)
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
      tipAmount: NonNegativeInteger(tipAmount),
      canceledAt: null,
      expiresAt: null,
    })
  )
  await run.orThrow(
    preparePaymentMethod({ paymentId, qerkoTerminal: { accountId } })
  )
  await run(startQerkoTerminalPayment({ paymentId, accountId, terminalId }))
  state.polls = 0

  const errors: unknown[] = []
  const startJob = async (retryBaseDelayMs: number) => {
    const jobDeps: AppBackgroundJobContext = {
      ...deps,
      ...createEetApiDep({ ...deps, ...clock }),
      ...connectivity,
      deviceId: createRowId<"Device">(),
      lockManager: createInProcessLockManager(),
      console: testCreateConsole(),
      onError: (error) => {
        errors.push(error)
      },
    }
    const jobRun = testCreateRun(jobDeps)
    const job = await jobRun.ok(
      createQerkoTerminalSyncJob({ retryBaseDelayMs })
    )
    return {
      [Symbol.asyncDispose]: async () => {
        await job[Symbol.asyncDispose]()
        await jobRun[Symbol.asyncDispose]()
      },
    }
  }

  return {
    evolu,
    deps,
    paymentId,
    state,
    errors,
    connectivity,
    startJob,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

describe("getQerkoPollDelayMs", () => {
  test("doubles from the first poll up to a minute", () => {
    expect(
      [0, 1, 2, 3, 5, 6, 7, 20].map((polls) => getQerkoPollDelayMs(polls))
    ).toEqual([1_000, 2_000, 4_000, 8_000, 32_000, 60_000, 60_000, 60_000])
  })
})

describe("qerko terminal sync job", () => {
  test("settles a payment nobody is watching once Qerko approves it", async () => {
    await using test = await setup()
    test.state.answer = "approved"
    await using _job = await test.startJob(5)

    await expect
      .poll(() =>
        test.evolu.loadQuery(
          accountTransactionsByPaymentIdQuery(test.paymentId)
        )
      )
      .toMatchObject([{ accountId, kind: "qerkoTerminal", amount: 12_900 }])
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([{ pendingTransactionId: null }])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("keeps polling while the terminal waits, then settles", async () => {
    await using test = await setup()
    await using _job = await test.startJob(5)

    await expect.poll(() => test.state.polls).toBeGreaterThanOrEqual(2)
    await expect(
      test.evolu.loadQuery(accountTransactionsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])

    test.state.answer = "approved"
    await expect
      .poll(() =>
        test.evolu.loadQuery(
          accountTransactionsByPaymentIdQuery(test.paymentId)
        )
      )
      .toHaveLength(1)
  }, 15_000)

  test("polls at once when the device comes back online", async () => {
    await using test = await setup()
    // A first poll a minute away: only coming online can fetch the answer.
    await using _job = await test.startJob(60_000)
    test.state.answer = "approved"
    expect(test.state.polls).toBe(0)

    // Online may be signalled before the job has loaded the pending attempt,
    // so it is signalled until the answer is in.
    await expect
      .poll(async () => {
        test.connectivity.goOnline()
        return (
          await test.evolu.loadQuery(
            accountTransactionsByPaymentIdQuery(test.paymentId)
          )
        ).length
      })
      .toBe(1)
  }, 15_000)

  test("settles a refund to the card the terminal approves later", async () => {
    await using test = await setup()
    test.state.answer = "approved"
    await using _job = await test.startJob(5)
    await expect
      .poll(() =>
        test.evolu.loadQuery(
          accountTransactionsByPaymentIdQuery(test.paymentId)
        )
      )
      .toHaveLength(1)

    await using run = testCreateRun(test.deps)
    await expect(
      run(
        startQerkoTerminalRefund({
          paymentId: test.paymentId,
          deviceId: null,
          amount: NonNegativeInteger(5_000),
        })
      )
    ).resolves.toMatchObject({ ok: true, value: { status: "pending" } })
    await expect(
      test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId))
    ).resolves.toEqual([])

    test.state.refundAnswer = "approved"
    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toMatchObject([{ amount: 5_000, method: "qerkoTerminal" }])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("writes the tip an older version left out when it settled a whole refund", async () => {
    await using test = await setup({ tipAmount: 900 })
    test.state.answer = "approved"
    await using _job = await test.startJob(5)
    await expect
      .poll(() =>
        test.evolu.loadQuery(
          accountTransactionsByPaymentIdQuery(test.paymentId)
        )
      )
      .toHaveLength(1)

    await using run = testCreateRun(test.deps)
    await run.orThrow(
      startQerkoTerminalRefund({
        paymentId: test.paymentId,
        deviceId: null,
        whole: true,
      })
    )
    const [attempt] = await test.evolu.loadQuery(
      qerkoTerminalRefundAttemptsByPaymentIdQuery(test.paymentId)
    )
    if (attempt === undefined) throw new Error("Expected an attempt.")

    // Another device on a version that knows no `tipAmount` settles it.
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

    await expect
      .poll(() => test.evolu.loadQuery(refundsByPaymentIdQuery(test.paymentId)))
      .toMatchObject([
        { id: attempt.id, amount: 12_000 },
        { id: tipRefundId(test.paymentId), amount: 900, isTip: sqliteTrue },
      ])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("does nothing when no attempt is pending", async () => {
    await using test = await setup()
    test.state.answer = "approved"
    await using job = await test.startJob(5)
    await expect
      .poll(() => test.evolu.loadQuery(rowQuery(test.paymentId)))
      .toMatchObject([{ pendingTransactionId: null }])
    const settledPolls = test.state.polls

    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(test.state.polls).toBe(settledPolls)
    void job
  }, 15_000)
})
