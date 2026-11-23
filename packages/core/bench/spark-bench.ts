import { testCreateRun } from "@evolu/common"
import { createSparkAccountTransactionSyncJob } from "../src/background-jobs/jobs/spark-account-transaction-sync-job.ts"
import { createAccount } from "../src/modules/account/account-actions.ts"
import { createPayment } from "../src/modules/payment/payment-actions.ts"
import { SparkSecret } from "../src/modules/shared/key-derivation.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  TimestampMs,
} from "../src/modules/shared/schema.ts"
import { createInProcessLockManager } from "../src/runtime/in-process-lock-manager.ts"
import type {
  SharedSparkSyncWallet,
  SharedSparkSyncWalletEventHandlers,
  SparkWalletTransfer,
} from "../src/spark/spark-wallet.ts"
import { testNotificationsDep } from "../src/testing/background-jobs.ts"
import { createEvoluTest } from "../src/testing/evolu.ts"
import { evoluTestDeps } from "../src/testing/evolu-deps.ts"
import {
  BENCH_AMOUNT_CZK,
  BENCH_AMOUNT_SATS,
  BENCH_EXCHANGE_RATE,
  createProbes,
  instrumentEvolu,
  now,
  realDate,
  silentConsole,
  sleep,
  waitFor,
  yadioFetch,
} from "./probes.ts"

/** Operator + SSP lookup per Spark SDK transfer call. */
const SPARK_ROUND_TRIPS_PER_CALL = 2

export interface SparkBenchConfig {
  readonly rttMs: number
  readonly sparkHistory: number
}

interface FakeTransfer {
  readonly id: string
  readonly status: string
  readonly type: string
  readonly valueSentByWallet: number
  readonly valueReceivedByWallet: number
  readonly transferDirection: string
  readonly updatedTime: Date
  readonly createdTime: Date
  readonly sparkInvoice: undefined
  readonly userRequest: unknown
}

const completedTransfer = (id: string, invoice: string): FakeTransfer => ({
  id,
  status: "TRANSFER_STATUS_COMPLETED",
  type: "TRANSFER",
  valueSentByWallet: 0,
  valueReceivedByWallet: Number(BENCH_AMOUNT_SATS),
  transferDirection: "INCOMING",
  updatedTime: new Date(),
  createdTime: new Date(Date.now() - 1_000),
  sparkInvoice: undefined,
  userRequest: {
    invoice: { encodedInvoice: invoice, paymentHash: `hash-${id}` },
    paymentPreimage: `preimage-${id}`,
  },
})

const createFakeSparkWallet = (rttMs: number) => {
  const transfers: FakeTransfer[] = []
  const calls: Array<{
    readonly at: number
    doneAt: number | null
    readonly method: "getTransfers" | "getTransfer"
  }> = []
  let handlers: SharedSparkSyncWalletEventHandlers = {}

  const timedCall = async <T>(
    method: "getTransfers" | "getTransfer",
    answer: () => T
  ): Promise<T> => {
    const record = { at: now(), doneAt: null as number | null, method }
    calls.push(record)
    await sleep(rttMs * SPARK_ROUND_TRIPS_PER_CALL)
    record.doneAt = now()
    return answer()
  }

  const wallet: SharedSparkSyncWallet = {
    getTransfers: (limit = 20, offset = 0, createdAfter) =>
      timedCall("getTransfers", () => {
        const visible = transfers.filter(
          (transfer) =>
            createdAfter === undefined || transfer.createdTime > createdAfter
        )
        const page = visible.slice(offset, offset + limit)
        return {
          // The fake carries only the fields the sync job reads.
          transfers: page as unknown as SparkWalletTransfer[],
          offset:
            offset + page.length < visible.length
              ? offset + page.length
              : offset,
        }
      }),
    getTransfer: (id) =>
      timedCall(
        "getTransfer",
        () =>
          transfers.find((transfer) => transfer.id === id) as unknown as
            | SparkWalletTransfer
            | undefined
      ),
    subscribe: (next) => {
      handlers = next
      return () => {
        handlers = {}
      }
    },
    [Symbol.asyncDispose]: async () => {},
  }

  return {
    wallet,
    transfers,
    calls,
    emitClaimed: (transferId: string) => {
      handlers["balance:update"]?.({ available: 0n, owned: 0n, incoming: 0n })
      handlers["balance:update"]?.({ available: 0n, owned: 0n, incoming: 0n })
      handlers["transfer:claimed"]?.(transferId, 0n)
    },
  }
}

export const runSpark = async (config: SparkBenchConfig) => {
  const probes = createProbes()
  await using testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  instrumentEvolu(probes, "app", evolu, null)

  await using run = testCreateRun({ ...evoluTestDeps(evolu), ...realDate })
  const secret = SparkSecret(`${"0".repeat(31)}1`)
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Spark"),
      spark: { secret },
    })
  )

  const createSparkPayment = (invoice: string) =>
    run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: BENCH_AMOUNT_CZK,
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        spark: {
          accountId,
          amountSats: BENCH_AMOUNT_SATS,
          exchangeRate: BENCH_EXCHANGE_RATE,
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(Date.now()),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode(invoice),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode(`hash-${invoice}`),
            paymentPreimage: null,
          },
        },
      })
    )

  const spark = createFakeSparkWallet(config.rttMs)
  for (let index = 0; index < config.sparkHistory; index += 1) {
    const invoice = `lnbc1benchprior${index}`
    await createSparkPayment(invoice)
    spark.transfers.push(completedTransfer(`prior-${index}`, invoice))
  }

  const errors: unknown[] = []
  await using jobRun = testCreateRun({
    ...evoluTestDeps(evolu),
    ...realDate,
    console: silentConsole,
    fetch: yadioFetch,
    lockManager: createInProcessLockManager(),
    ...testNotificationsDep(),
    onError: (error: unknown) => {
      errors.push(error)
    },
  })
  await using _job = await jobRun.ok(
    createSparkAccountTransactionSyncJob({
      walletFactory: async () => spark.wallet,
    })
  )

  await waitFor("initial Spark history sweep", () =>
    probes.claimedAt.size >= config.sparkHistory &&
    spark.calls.length > 0 &&
    spark.calls.every((call) => call.doneAt !== null)
      ? true
      : null
  )
  // Wait for the initial sweep's post-loop pointer write and checkWithdrawals to finish.
  await sleep(50)

  const invoice = "lnbc1benchtarget"
  const paymentId = await createSparkPayment(invoice)
  spark.transfers.unshift(completedTransfer("target", invoice))

  const emittedAt = now()
  spark.emitClaimed("target")
  const claimedAt = await waitFor("Spark claim", () =>
    probes.claimedAt.get(paymentId)
  )
  const drainedAt = await waitFor("Spark sync queue to drain", () => {
    const after = spark.calls.filter((call) => call.at >= emittedAt)
    return after.some((call) => call.method === "getTransfer") &&
      after.every((call) => call.doneAt !== null)
      ? Math.max(...after.map((call) => call.doneAt ?? 0))
      : null
  })
  if (errors.length > 0) throw errors[0]

  const after = spark.calls.filter((call) => call.at >= emittedAt)
  return {
    eventsToPaidMs: claimedAt - emittedAt,
    eventsToQueueDrainedMs: drainedAt - emittedAt,
    queueOrder: after.map((call) => call.method),
    getTransfersCalls: after.filter((call) => call.method === "getTransfers")
      .length,
    getTransferCalls: after.filter((call) => call.method === "getTransfer")
      .length,
    callsBeforePaid: after.filter(
      (call) => call.doneAt !== null && call.doneAt <= claimedAt
    ).length,
    getTransferStartedAfterMs:
      (after.find((call) => call.method === "getTransfer")?.at ?? emittedAt) -
      emittedAt,
  }
}

export type SparkRun = Awaited<ReturnType<typeof runSpark>>
