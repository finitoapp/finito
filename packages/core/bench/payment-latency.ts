import { parseArgs } from "node:util"
import {
  createConsole,
  type MutationOptions,
  testCreateRun,
} from "@evolu/common"
import { installPolyfills } from "@evolu/common/polyfills"
import { bytesToHex } from "@noble/hashes/utils.js"
import { PrivateDirectMessage } from "nostr-tools/kinds"
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { startCashuAccountSyncJob } from "../src/background-jobs/jobs/cashu-account-sync-job.ts"
import { createSparkAccountTransactionSyncJob } from "../src/background-jobs/jobs/spark-account-transaction-sync-job.ts"
import { writeCashuDefaultMint } from "../src/cashu/cashu-mints.ts"
import { cashuTokenArrivals } from "../src/cashu/cashu-token-listener.ts"
import {
  createCashuWalletDep,
  loadCashuWallet,
} from "../src/cashu/cashu-wallet.ts"
import { deriveDeviceAccountId } from "../src/evolu/device-account.ts"
import type { DeviceAccountId } from "../src/evolu/device-client.ts"
import { createEetApiDep } from "../src/integrations/eet/eet-client.ts"
import { createQerkoApiDep } from "../src/integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../src/integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../src/integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../src/integrations/yadio/yadio-client.ts"
import {
  createAccount,
  saveCashuAccount,
} from "../src/modules/account/account-actions.ts"
import { cashuProofCopiesQuery } from "../src/modules/cashu/cashu-queries.ts"
import {
  CashuAmount,
  KeysetId,
  MintUrl,
} from "../src/modules/cashu/cashu-types.ts"
import type { DeviceId } from "../src/modules/device/device-types.ts"
import {
  cancelPayment,
  createPayment,
} from "../src/modules/payment/payment-actions.ts"
import { prepareCashuPaymentMethod } from "../src/modules/payment/payment-preparation-actions.ts"
import { cashuTokenCandidatePaymentsQuery } from "../src/modules/payment/payment-queries.ts"
import type { PaymentId } from "../src/modules/payment/payment-types.ts"
import {
  CashuWalletSeed,
  deriveNostrSecretKey,
  type SparkSecret,
} from "../src/modules/shared/key-derivation.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveNumber,
  TimestampMs,
} from "../src/modules/shared/schema.ts"
import { createInProcessLockManager } from "../src/runtime/in-process-lock-manager.ts"
import type {
  SharedSparkSyncWallet,
  SharedSparkSyncWalletEventHandlers,
  SparkWalletTransfer,
} from "../src/spark/spark-wallet.ts"
import { testNotificationsDep } from "../src/testing/background-jobs.ts"
import { createCashuTest, testCashuMasterKey } from "../src/testing/cashu.ts"
import { createEvoluTest } from "../src/testing/evolu.ts"
import { evoluTestDeps } from "../src/testing/evolu-deps.ts"
import { createFakeNostrDep } from "../src/testing/nostr.ts"

/**
 * Times Finito's real payment pipelines (the Cashu and Spark sync jobs,
 * claim, receive and booking code) against in-memory Evolu and fake mint,
 * Spark wallet and nostr relays that answer after a simulated round trip.
 * Run it before and after a latency fix: `bun run bench:payment-latency`.
 */

const { values: args } = parseArgs({
  options: {
    rtt: { type: "string", default: "150" },
    "prior-payments": { type: "string", default: "10" },
    proofs: { type: "string", default: "200" },
    "spark-history": { type: "string", default: "20" },
    only: { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
})

if (args.help) {
  console.log(`Usage: bun run bench:payment-latency [options]

  --rtt <ms>             simulated round trip of every mint, Yadio and Spark call (150)
  --prior-payments <n>   earlier Cashu payments whose Lightning quotes stay pending (10)
  --proofs <n>           spent proofs seeded into the wallet history (200)
  --spark-history <n>    Spark transfers of the last hour, already booked (20)
  --only <section>       run one section: cashu, spark or probes
  --json                 print the measurements as JSON`)
  process.exit(0)
}

const wholeNumber = (name: string, value: string): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`--${name} takes a whole number, got "${value}"`)
  return parsed
}

const options = {
  rttMs: wholeNumber("rtt", args.rtt),
  priorPayments: wholeNumber("prior-payments", args["prior-payments"]),
  proofs: wholeNumber("proofs", args.proofs),
  sparkHistory: wholeNumber("spark-history", args["spark-history"]),
}

// Bun's `navigator` has no `locks`; the CLI fills it the same way.
installPolyfills()
const navigatorWithLocks = globalThis.navigator as Navigator & {
  locks?: LockManager
}
navigatorWithLocks.locks ??= createInProcessLockManager()

const now = (): number => performance.now()
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const waitFor = async <T>(
  label: string,
  read: () => T | null | undefined,
  timeoutMs = 90_000
): Promise<T> => {
  const deadline = now() + timeoutMs
  for (;;) {
    const value = read()
    if (value !== null && value !== undefined) return value
    if (now() > deadline) throw new Error(`Timed out waiting for ${label}`)
    await sleep(2)
  }
}

const silentConsole = createConsole({ level: "silent" })
const realDate = { date: { now: () => new Date() } }

/** What the instrumented network, database and job hooks saw, by time. */
interface HttpCall {
  readonly at: number
  doneAt: number | null
  readonly endpoint: string
  readonly quoteId: string | null
  readonly signalled: boolean
}

interface Sweep {
  readonly at: number
  quoteChecks: number
  proofScans: number
}

const createProbes = () => ({
  http: [] as HttpCall[],
  writes: [] as Array<{
    readonly at: number
    readonly db: "app" | "device"
    readonly batch: unknown
  }>,
  proofScans: [] as Array<{ readonly at: number; readonly ms: number }>,
  sweeps: [] as Sweep[],
  claimedAt: new Map<string, number>(),
})
type Probes = ReturnType<typeof createProbes>

const between = <T extends { readonly at: number }>(
  items: ReadonlyArray<T>,
  from: number,
  to: number
): ReadonlyArray<T> => items.filter(({ at }) => at >= from && at <= to)

const endpointOf = (request: Request): string => {
  const url = new URL(request.url)
  const path = url.pathname.replace(
    /(\/v1\/mint\/quote\/bolt11)\/.+$/u,
    "$1/:id"
  )
  return url.hostname === "api.yadio.io"
    ? `yadio ${request.method} ${path}`
    : `mint ${request.method} ${path}`
}

/** Every request waits `rttMs` before the fake behind it answers. */
const withRoundTrip =
  (
    probes: Probes,
    rttMs: number,
    upstream: () => typeof globalThis.fetch
  ): typeof globalThis.fetch =>
  async (input, init) => {
    const request = new Request(input, init)
    const quoteId =
      /\/v1\/mint\/quote\/bolt11\/(.+)$/u.exec(
        new URL(request.url).pathname
      )?.[1] ?? null
    const call: HttpCall = {
      at: now(),
      doneAt: null,
      endpoint: endpointOf(request),
      quoteId,
      signalled: init?.signal !== undefined && init.signal !== null,
    }
    probes.http.push(call)
    const sweep = probes.sweeps.at(-1)
    if (quoteId !== null && sweep !== undefined) sweep.quoteChecks += 1
    await sleep(rttMs)
    const response = await upstream()(input, init)
    call.doneAt = now()
    return response
  }

const yadioFetch: typeof globalThis.fetch = async () =>
  new Response(JSON.stringify({ BTC: 1_500_000, timestamp: Date.now() }))

interface InstrumentedEvolu {
  readonly upsert: unknown
  readonly update: unknown
  readonly insert: unknown
  readonly loadQuery: unknown
}

/**
 * Wraps an Evolu client's writes and reads in place, so the shard store and
 * every Task holding it are measured too: write batches by their
 * `onComplete`, the moment a `reconciliationClaim` batch lands, and every
 * full read of the wallet's proofs.
 */
const instrumentEvolu = (
  probes: Probes,
  db: "app" | "device",
  evolu: InstrumentedEvolu,
  proofScanQuery: string | null
): void => {
  const wrapWrite =
    (write: (...args: ReadonlyArray<unknown>) => unknown) =>
    (
      table: string,
      values: Record<string, unknown>,
      options?: MutationOptions
    ) => {
      probes.writes.push({ at: now(), db, batch: options?.onComplete ?? null })
      const onComplete = options?.onComplete
      const paymentId = values.paymentId
      if (
        table !== "reconciliationClaim" ||
        onComplete === undefined ||
        typeof paymentId !== "string"
      )
        return write(table, values, options)
      return write(table, values, {
        ...options,
        onComplete: () => {
          if (!probes.claimedAt.has(paymentId))
            probes.claimedAt.set(paymentId, now())
          onComplete()
        },
      })
    }
  const methods = evolu as unknown as Record<
    keyof InstrumentedEvolu,
    (...args: ReadonlyArray<unknown>) => unknown
  >
  const loadQuery = methods.loadQuery.bind(evolu)
  Object.assign(evolu, {
    upsert: wrapWrite(methods.upsert.bind(evolu)),
    update: wrapWrite(methods.update.bind(evolu)),
    insert: wrapWrite(methods.insert.bind(evolu)),
    loadQuery: async (query: string) => {
      const at = now()
      const rows = await loadQuery(query)
      if (query === proofScanQuery) {
        probes.proofScans.push({ at, ms: now() - at })
        const sweep = probes.sweeps.at(-1)
        if (sweep !== undefined) sweep.proofScans += 1
      }
      return rows
    },
  })
}

const writeBatches = (
  probes: Probes,
  from: number,
  to: number
): { readonly app: number; readonly device: number } => {
  const count = (db: "app" | "device") => {
    const writes = between(probes.writes, from, to).filter(
      (write) => write.db === db
    )
    const batched = new Set(writes.flatMap(({ batch }) => batch ?? []))
    return batched.size + writes.filter(({ batch }) => batch === null).length
  }
  return { app: count("app"), device: count("device") }
}

const tally = (calls: ReadonlyArray<HttpCall>): string => {
  const counts = new Map<string, number>()
  for (const { endpoint } of calls)
    counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1)
  return [...counts]
    .map(([endpoint, count]) => `${count}x ${endpoint.replace(/^mint /u, "")}`)
    .join(", ")
}

/** A Cashu wallet with `proofs` spent proofs, a default mint and the job's deps. */
const createCashuBench = async (priorPayments: number) => {
  const probes = createProbes()
  let mintFetch: typeof globalThis.fetch = () =>
    Promise.reject(new TypeError("the fake mint is not up yet"))
  const network = withRoundTrip(
    probes,
    options.rttMs,
    () => (input, init) =>
      new Request(input, init).url.startsWith("https://api.yadio.io")
        ? yadioFetch(input, init)
        : mintFetch(input, init)
  )
  const t = await createCashuTest({ fetch: network })
  mintFetch = t.mint.fetch
  const relays = createFakeNostrDep()
  const errors: unknown[] = []
  const deps = {
    ...t.deps,
    ...realDate,
    ...createYadioApiDep(),
    ...createQerkoApiDep({ posId: "bench" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    ...createEetApiDep({ ...realDate, fetch: network }),
    masterKey: testCashuMasterKey,
    deviceAccountId: deriveDeviceAccountId(testCashuMasterKey),
    ...testNotificationsDep(),
    nostr: relays.nostr,
    console: silentConsole,
    deviceId: "bench-device" as DeviceId,
    connectivity: { onOnline: () => () => {} },
    onError: (error: unknown) => {
      errors.push(error)
    },
  }
  const run = testCreateRun(deps)
  const accountId = await run.ok(saveCashuAccount({ enabled: true }))
  if (accountId === null) throw new Error("no Cashu account")
  const mint = MintUrl(t.mint.url)
  await writeCashuDefaultMint(deps.cashuShardStore, mint)
  const store = deps.cashuShardStore
  const keysetId = KeysetId(t.mint.keysetId)
  for (let index = 0; index < options.proofs; index += 50)
    await store.insertProofs(
      Array.from(
        { length: Math.min(50, options.proofs - index) },
        (_, offset) => ({
          mint,
          unit: "sat" as const,
          keysetId,
          amount: CashuAmount(2 ** ((index + offset) % 10)),
          secret: bytesToHex(generateSecretKey()),
          C: `02${bytesToHex(generateSecretKey())}`,
          dleq: null,
          state: "spent" as const,
          operationId: null,
        })
      )
    )

  instrumentEvolu(
    probes,
    "app",
    deps.evolu,
    cashuProofCopiesQuery(await store.shardOwnerIds())
  )
  instrumentEvolu(probes, "device", deps.deviceEvolu, null)
  const loadPendingOperations = store.loadPendingOperations
  let onSweep: (() => void) | null = null
  Object.assign(store, {
    loadPendingOperations: () => {
      probes.sweeps.push({ at: now(), quoteChecks: 0, proofScans: 0 })
      const callback = onSweep
      onSweep = null
      callback?.()
      return loadPendingOperations()
    },
  })

  /** Creates a payment and prepares its Cashu method: what the QR waits for. */
  const preparePayment = async () => {
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )
    const from = now()
    await run.orThrow(prepareCashuPaymentMethod({ paymentId, accountId }))
    const to = now()
    const quoteId = t.mint.mintQuoteIds().at(-1)
    if (quoteId === undefined) throw new Error("no mint quote")
    return { paymentId, quoteId, from, to }
  }

  for (let index = 0; index < priorPayments; index += 1) {
    const { paymentId } = await preparePayment()
    await run.orThrow(cancelPayment(paymentId))
  }

  return {
    t,
    deps,
    probes,
    relays,
    errors,
    preparePayment,
    /** Runs `callback` as the next poll sweep starts. */
    onNextSweep: (callback: () => void) => {
      onSweep = callback
    },
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await t[Symbol.asyncDispose]()
    },
  }
}

type CashuBench = Awaited<ReturnType<typeof createCashuBench>>

/**
 * Lightning: the customer pays the topup quote right after a poll found it
 * unpaid, the worst phase, so the wait shows the job's whole poll interval.
 */
const measureLightning = async (bench: CashuBench) => {
  const { probes, t } = bench
  const payment = await bench.preparePayment()
  const firstPoll = await waitFor("the first poll of the quote", () =>
    probes.http.find(
      (call) => call.quoteId === payment.quoteId && call.doneAt !== null
    )
  )
  await waitFor("the poll's answer", () => firstPoll.doneAt)
  const paidAt = now()
  t.mint.payMintQuote(payment.quoteId)
  const claimedAt = await waitFor("the Lightning claim", () =>
    probes.claimedAt.get(payment.paymentId)
  )
  const detection = probes.http.find(
    (call) => call.quoteId === payment.quoteId && call.at > paidAt
  )
  if (detection === undefined) throw new Error("the quote was never polled")
  const sweepsWaited = between(probes.sweeps, paidAt, detection.at)
  const detectingSweep = sweepsWaited.at(-1)
  const sweepStart = detectingSweep?.at ?? detection.at
  const detectingChecks = between(probes.http, sweepStart, claimedAt).filter(
    (call) => call.quoteId !== null
  )
  return {
    paidToDetectedMs: detection.at - paidAt,
    detectedToClaimMs: claimedAt - detection.at,
    paidToClaimMs: claimedAt - paidAt,
    sweepsWhileWaiting: sweepsWaited.length,
    sweepsThatSkippedQuote: Math.max(0, sweepsWaited.length - 1),
    quoteChecksPerSweep: detectingSweep?.quoteChecks ?? 0,
    quotePositionInSweep:
      detectingChecks.findIndex((call) => call.quoteId === payment.quoteId) + 1,
    proofScansPerSweep: detectingSweep?.proofScans ?? 0,
    mintCallsDetectedToClaim: between(probes.http, detection.at, claimedAt),
    proofScansDetectedToClaim: between(
      probes.proofScans,
      detection.at,
      claimedAt
    ),
    writeBatchesDetectedToClaim: writeBatches(probes, detection.at, claimedAt),
    preparationMs: payment.to - payment.from,
    preparationCalls: between(probes.http, payment.from, payment.to),
  }
}

/** NIP-17 gift wrap of a NUT-18 payload, as the customer's wallet sends it. */
const tokenMessage = async (bench: CashuBench, paymentId: PaymentId) => {
  const candidates = await bench.deps.evolu.loadQuery(
    cashuTokenCandidatePaymentsQuery
  )
  const amount = candidates.find(
    (row) => row.paymentId === paymentId
  )?.amountSats
  if (amount === undefined) throw new Error("no Cashu amount")
  const customerWallet = await createCashuWalletDep({
    seed: CashuWalletSeed(new Uint8Array(64).fill(9)),
    deviceAccountId: "customer" as DeviceAccountId,
    fetch: bench.t.mint.fetch,
  }).cashuWallet.load(MintUrl(bench.t.mint.url))
  const quote = await customerWallet.createMintQuoteBolt11(amount)
  bench.t.mint.payMintQuote(quote.quote)
  const proofs = await customerWallet.mintProofsBolt11(amount, quote.quote)
  const customer = generateSecretKey()
  const finito = getPublicKey(deriveNostrSecretKey(testCashuMasterKey))
  const content = JSON.stringify({
    id: paymentId,
    mint: bench.t.mint.url,
    unit: "sat",
    proofs: proofs.map((proof) => ({
      id: proof.id,
      amount: Number(proof.amount),
      secret: proof.secret,
      C: proof.C,
    })),
  })
  const rumor = createRumor(
    {
      kind: PrivateDirectMessage,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: [["p", finito]],
    },
    customer
  )
  return createWrap(createSeal(rumor, customer, finito), finito)
}

/**
 * Token: the NIP-17 message lands as a poll sweep starts, so the `tokens`
 * work waits behind `topups` in the job's one queue.
 */
const measureToken = async (bench: CashuBench) => {
  const { probes } = bench
  const payment = await bench.preparePayment()
  const message = await tokenMessage(bench, payment.paymentId)
  let receivingAt: number | null = null
  const unsubscribe = cashuTokenArrivals.subscribe(() => {
    if (
      receivingAt === null &&
      cashuTokenArrivals.get(payment.paymentId)?.state === "receiving"
    )
      receivingAt = now()
  })
  let deliveredAt: number | null = null
  bench.onNextSweep(() => {
    deliveredAt = now()
    bench.relays.deliver(message)
  })
  const delivered = await waitFor("a poll sweep", () => deliveredAt)
  const receiving = await waitFor("the token's receive", () => receivingAt)
  const claimedAt = await waitFor("the token's claim", () =>
    probes.claimedAt.get(payment.paymentId)
  )
  unsubscribe()
  const stageA = between(probes.http, delivered, receiving)
  const stageB = between(probes.http, receiving, claimedAt)
  return {
    deliveredToReceivingMs: receiving - delivered,
    receivingToClaimMs: claimedAt - receiving,
    deliveredToClaimMs: claimedAt - delivered,
    quoteChecksAheadOfToken: stageA.filter((call) => call.quoteId !== null)
      .length,
    checkstateCalls: stageB.filter(({ endpoint }) =>
      endpoint.endsWith("/v1/checkstate")
    ).length,
    swapCalls: stageB.filter(({ endpoint }) => endpoint.endsWith("/v1/swap"))
      .length,
    mintCallsReceivingToClaim: stageB,
    proofScansReceivingToClaim: between(
      probes.proofScans,
      receiving,
      claimedAt
    ),
    writeBatchesReceivingToClaim: writeBatches(probes, receiving, claimedAt),
    preparationMs: payment.to - payment.from,
    preparationCalls: between(probes.http, payment.from, payment.to),
  }
}

const runCashu = async (priorPayments: number) => {
  await using bench = await createCashuBench(priorPayments)
  await using run = testCreateRun(bench.deps)
  const job = await run.ok(startCashuAccountSyncJob)
  try {
    const lightning = await measureLightning(bench)
    const token = await measureToken(bench)
    if (bench.errors.length > 0) throw bench.errors[0]
    return { priorPayments, lightning, token }
  } finally {
    await job[Symbol.asyncDispose]()
  }
}

/** The SDK wallet over operators and the SSP: each call costs two round trips. */
const SPARK_ROUND_TRIPS_PER_CALL = 2

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
  valueReceivedByWallet: 8_600,
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
  const call = async <T>(
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
      call("getTransfers", () => {
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
      call(
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
    /** The SDK's order when a Lightning receive is claimed. */
    emitClaimed: (transferId: string) => {
      handlers["balance:update"]?.({ available: 0n, owned: 0n, incoming: 0n })
      handlers["balance:update"]?.({ available: 0n, owned: 0n, incoming: 0n })
      handlers["transfer:claimed"]?.(transferId, 0n)
    },
  }
}

const runSpark = async () => {
  const probes = createProbes()
  await using testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  instrumentEvolu(probes, "app", evolu, null)
  await using run = testCreateRun({ ...evoluTestDeps(evolu), ...realDate })
  const secret = "0".repeat(31).concat("1") as SparkSecret
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Spark"),
      spark: { secret },
    })
  )
  const sparkPayment = async (invoice: string) =>
    run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        spark: {
          accountId,
          amountSats: NonNegativeInteger(8_600),
          exchangeRate: PositiveNumber(1_500_000),
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
  const spark = createFakeSparkWallet(options.rttMs)
  for (let index = 0; index < options.sparkHistory; index += 1) {
    const invoice = `lnbc1benchprior${index}`
    await sparkPayment(invoice)
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
  await waitFor("the first history sweep", () =>
    probes.claimedAt.size >= options.sparkHistory &&
    spark.calls.every((call) => call.doneAt !== null) &&
    spark.calls.length > 0
      ? true
      : null
  )
  await sleep(200)

  const invoice = "lnbc1benchtarget"
  const paymentId = await sparkPayment(invoice)
  spark.transfers.unshift(completedTransfer("target", invoice))
  const emittedAt = now()
  spark.emitClaimed("target")
  const claimedAt = await waitFor("the Spark claim", () =>
    probes.claimedAt.get(paymentId)
  )
  const drainedAt = await waitFor("the Spark queue to drain", () => {
    const after = spark.calls.filter((call) => call.at >= emittedAt)
    return after.some((call) => call.method === "getTransfer") &&
      after.every((call) => call.doneAt !== null)
      ? Math.max(...after.map((call) => call.doneAt ?? 0))
      : null
  })
  if (errors.length > 0) throw errors[0]
  const after = spark.calls.filter((call) => call.at >= emittedAt)
  return {
    eventToClaimMs: claimedAt - emittedAt,
    eventToQueueDrainedMs: drainedAt - emittedAt,
    queueOrder: after.map((call) => call.method),
    getTransfersCalls: after.filter((call) => call.method === "getTransfers")
      .length,
    getTransferCalls: after.filter((call) => call.method === "getTransfer")
      .length,
    callsBeforeClaim: after.filter(
      (call) => call.doneAt !== null && call.doneAt <= claimedAt
    ).length,
    getTransferAt:
      (after.find((call) => call.method === "getTransfer")?.at ?? emittedAt) -
      emittedAt,
  }
}

/** A mint that never answers: does anything give up on it? */
const probeMintTimeout = async () => {
  const probes = createProbes()
  const windowMs = 1_500
  const hungUp: Array<() => void> = []
  const hanging: typeof globalThis.fetch = (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const hangUp = () => reject(new TypeError("the bench hung up"))
      init?.signal?.addEventListener("abort", hangUp)
      hungUp.push(hangUp)
    })
  const t = await createCashuTest({
    fetch: withRoundTrip(probes, 0, () => hanging),
  })
  await using _t = t
  await using run = testCreateRun(t.deps)
  const outcome = await Promise.race([
    run(loadCashuWallet(MintUrl("https://slow-mint.test"))).then((result) =>
      result.ok ? "loaded" : result.error.type
    ),
    sleep(windowMs).then(() => null),
  ])
  // Disposing the run waits for the request the mint never answers.
  for (const hangUp of hungUp) hangUp()
  return {
    windowMs,
    settled: outcome,
    requestsCarrySignal: probes.http.some((call) => call.signalled),
  }
}

const formatMs = (ms: number): string =>
  `${Math.round(ms).toLocaleString("en-US")} ms`

const printTable = (
  title: string,
  header: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>
) => {
  const widths = header.map((_, column) =>
    Math.max(...[header, ...rows].map((row) => (row[column] ?? "").length))
  )
  const line = (row: ReadonlyArray<string>) =>
    row
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] ?? 0)
          : cell.padStart(widths[column] ?? 0)
      )
      .join("  ")
      .trimEnd()
  console.log(`\n${title}`)
  console.log(line(header))
  console.log(widths.map((width) => "-".repeat(width)).join("  "))
  for (const row of rows) console.log(line(row))
}

type CashuRun = Awaited<ReturnType<typeof runCashu>>

const batches = ({ app, device }: { app: number; device: number }) =>
  `${app} app + ${device} device`

const printCashu = (cashu: ReadonlyArray<CashuRun>) => {
  const header = ["", ...cashu.map((r) => `${r.priorPayments} prior payments`)]
  const row = (label: string, read: (r: CashuRun) => string) => [
    label,
    ...cashu.map(read),
  ]
  printTable("1. Cashu Lightning: quote paid -> reconciliationClaim", header, [
    row("paid -> detected by a poll", (r) =>
      formatMs(r.lightning.paidToDetectedMs)
    ),
    row("detected -> claim written", (r) =>
      formatMs(r.lightning.detectedToClaimMs)
    ),
    row("paid -> Paid (total)", (r) => formatMs(r.lightning.paidToClaimMs)),
    row("poll sweeps after the payment", (r) =>
      String(r.lightning.sweepsWhileWaiting)
    ),
    row("  sweeps that skipped the quote", (r) =>
      String(r.lightning.sweepsThatSkippedQuote)
    ),
    row("quote checks in the detecting sweep", (r) =>
      String(r.lightning.quoteChecksPerSweep)
    ),
    row("  paid quote's position", (r) =>
      String(r.lightning.quotePositionInSweep)
    ),
    row("  full proof scans", (r) => String(r.lightning.proofScansPerSweep)),
    row("mint calls, detected -> Paid", (r) =>
      String(r.lightning.mintCallsDetectedToClaim.length)
    ),
    row("full proof scans, detected -> Paid", (r) =>
      String(r.lightning.proofScansDetectedToClaim.length)
    ),
    row("write batches, detected -> Paid", (r) =>
      batches(r.lightning.writeBatchesDetectedToClaim)
    ),
  ])
  for (const r of cashu)
    console.log(
      `  ${r.priorPayments} prior, mint calls: ${tally(r.lightning.mintCallsDetectedToClaim)}`
    )

  printTable(
    "2. Cashu NIP-17 token: delivered -> receiving -> reconciliationClaim",
    header,
    [
      row("A. delivered -> receiving", (r) =>
        formatMs(r.token.deliveredToReceivingMs)
      ),
      row("   quote checks ahead in the queue", (r) =>
        String(r.token.quoteChecksAheadOfToken)
      ),
      row("B. receiving -> claim written", (r) =>
        formatMs(r.token.receivingToClaimMs)
      ),
      row("delivered -> Paid (total)", (r) =>
        formatMs(r.token.deliveredToClaimMs)
      ),
      row("B: POST /v1/checkstate", (r) => String(r.token.checkstateCalls)),
      row("B: POST /v1/swap", (r) => String(r.token.swapCalls)),
      row("B: mint calls", (r) =>
        String(r.token.mintCallsReceivingToClaim.length)
      ),
      row("B: full proof scans", (r) =>
        String(r.token.proofScansReceivingToClaim.length)
      ),
      row("B:   time in them", (r) =>
        formatMs(
          r.token.proofScansReceivingToClaim.reduce(
            (sum, scan) => sum + scan.ms,
            0
          )
        )
      ),
      row("B: write batches", (r) =>
        batches(r.token.writeBatchesReceivingToClaim)
      ),
    ]
  )
  for (const r of cashu)
    console.log(
      `  ${r.priorPayments} prior, mint calls: ${tally(r.token.mintCallsReceivingToClaim)}`
    )
}

const printSpark = (spark: Awaited<ReturnType<typeof runSpark>>) =>
  printTable(
    "3. Spark: balance:update x2, transfer:claimed -> reconciliationClaim",
    ["", "value"],
    [
      ["events -> claim written", formatMs(spark.eventToClaimMs)],
      ["events -> sync queue drained", formatMs(spark.eventToQueueDrainedMs)],
      ["queue order after the events", spark.queueOrder.join(", ")],
      ["getTransfers calls", String(spark.getTransfersCalls)],
      ["getTransfer calls", String(spark.getTransferCalls)],
      ["SDK calls finished before the claim", String(spark.callsBeforeClaim)],
      ["getTransfer(id) starts after", formatMs(spark.getTransferAt)],
    ]
  )

const printProbes = (
  cashu: CashuRun | undefined,
  mintTimeout: Awaited<ReturnType<typeof probeMintTimeout>>
) => {
  const preparations = cashu === undefined ? [] : [cashu.lightning, cashu.token]
  const yadioCalls = preparations.flatMap(({ preparationCalls }) =>
    preparationCalls.filter(({ endpoint }) => endpoint.startsWith("yadio"))
  )
  printTable(
    "4. Probes",
    ["", "value"],
    [
      ...(cashu === undefined
        ? []
        : [
            ["Yadio calls, 2 payments in a row", String(yadioCalls.length)],
            ...preparations.map((preparation, index) => [
              `payment ${index + 1} preparation (QR shown)`,
              formatMs(preparation.preparationMs),
            ]),
          ]),
      [
        "mint requests carry an AbortSignal",
        mintTimeout.requestsCarrySignal ? "yes" : "no",
      ],
      [
        `loadCashuWallet, silent mint, ${mintTimeout.windowMs} ms`,
        mintTimeout.settled ?? "still pending",
      ],
    ]
  )
  preparations.forEach((preparation, index) => {
    console.log(
      `  payment ${index + 1} calls: ${tally(preparation.preparationCalls)}`
    )
  })
}

const allSections = ["cashu", "spark", "probes"]
if (args.only !== undefined && !allSections.includes(args.only))
  throw new Error(`--only takes ${allSections.join(", ")}, got "${args.only}"`)
const sections = new Set(args.only === undefined ? allSections : [args.only])

const main = async () => {
  const startedAt = now()
  // Sections run side by side: the Cashu ones spend most of their time
  // waiting out the job's real 5 s poll timer.
  const [cashu, spark, mintTimeout] = await Promise.all([
    sections.has("cashu")
      ? Promise.all([...new Set([0, options.priorPayments])].map(runCashu))
      : [],
    sections.has("spark") ? runSpark() : null,
    sections.has("probes") ? probeMintTimeout() : null,
  ])
  const report = {
    options,
    cashu,
    spark,
    mintTimeout,
    totalMs: now() - startedAt,
  }

  if (args.json) {
    const tallied = (_key: string, value: unknown) =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (item) =>
          typeof item === "object" && item !== null && "endpoint" in item
      )
        ? tally(value as ReadonlyArray<HttpCall>)
        : value
    console.log(JSON.stringify(report, tallied, 2))
    return
  }

  console.log("Finito payment latency benchmark")
  console.log(
    `RTT ${options.rttMs} ms per call, ${options.proofs} spent proofs in the wallet, ${options.sparkHistory} Spark transfers in the last hour`
  )
  if (cashu.length > 0) printCashu(cashu)
  if (spark !== null) printSpark(spark)
  if (mintTimeout !== null) printProbes(cashu[0], mintTimeout)
  console.log(`\nTotal ${formatMs(report.totalMs)}`)
}

await main()
