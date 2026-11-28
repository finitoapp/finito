import { testCreateRun } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import { PrivateDirectMessage } from "nostr-tools/kinds"
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { startCashuAccountSyncJob } from "../src/background-jobs/jobs/cashu-account-sync-job.ts"
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
import { saveCashuAccount } from "../src/modules/account/account-actions.ts"
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
} from "../src/modules/shared/key-derivation.ts"
import { NonNegativeInteger } from "../src/modules/shared/schema.ts"
import { testNotificationsDep } from "../src/testing/background-jobs.ts"
import { createCashuTest, testCashuMasterKey } from "../src/testing/cashu.ts"
import { createFakeNostrDep } from "../src/testing/nostr.ts"
import {
  BENCH_AMOUNT_CZK,
  between,
  countWriteBatches,
  createProbes,
  instrumentEvolu,
  now,
  realDate,
  silentConsole,
  sleep,
  tallyCalls,
  waitFor,
  withRoundTrip,
  yadioFetch,
} from "./probes.ts"

export interface CashuBenchConfig {
  readonly rttMs: number
  readonly proofs: number
}

const createCashuBench = async (
  config: CashuBenchConfig,
  priorPayments: number
) => {
  const probes = createProbes()
  let mintFetch: typeof globalThis.fetch = () =>
    Promise.reject(new TypeError("fake mint is not ready"))
  const routedFetch: typeof globalThis.fetch = (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    return url.startsWith("https://api.yadio.io")
      ? yadioFetch(input, init)
      : mintFetch(input, init)
  }
  const network = withRoundTrip(probes, config.rttMs, routedFetch)
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

  for (let index = 0; index < config.proofs; index += 50)
    await store.insertProofs(
      Array.from(
        { length: Math.min(50, config.proofs - index) },
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
      probes.sweeps.push({ at: now() })
      const callback = onSweep
      onSweep = null
      callback?.()
      return loadPendingOperations()
    },
  })

  const preparePayment = async () => {
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: BENCH_AMOUNT_CZK,
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
 * Pays the Lightning quote right after a poll sees it unpaid (worst phase),
 * so the measurement exposes the full poll interval and any skipped tick.
 */
const measureLightning = async (bench: CashuBench) => {
  const { probes, t } = bench
  const payment = await bench.preparePayment()
  await waitFor("first poll of the quote", () =>
    probes.http.find(
      (call) => call.quoteId === payment.quoteId && call.doneAt !== null
    )
  )

  const paidAt = now()
  t.mint.payMintQuote(payment.quoteId)
  const claimedAt = await waitFor("Lightning claim", () =>
    probes.claimedAt.get(payment.paymentId)
  )
  const detection = probes.http.find(
    (call) => call.quoteId === payment.quoteId && call.at > paidAt
  )
  if (detection === undefined) throw new Error("quote was never polled")

  const sweepsWaited = between(probes.sweeps, paidAt, detection.at)
  const detectingSweep = probes.sweeps.findLast(
    (sweep) => sweep.at <= detection.at
  )
  const sweepStart = detectingSweep?.at ?? detection.at
  const nextSweep = probes.sweeps.find((sweep) => sweep.at > sweepStart)
  const sweepEnd =
    nextSweep !== undefined && nextSweep.at < claimedAt
      ? nextSweep.at
      : claimedAt

  const detectingChecks = between(probes.http, sweepStart, sweepEnd).filter(
    (call) => call.quoteId !== null
  )
  const mintCallsDetectedToPaid = between(probes.http, detection.at, claimedAt)
  const proofScansBeforeDetection = between(
    probes.proofScans,
    sweepStart,
    detection.at
  )
  const proofScansDetectedToPaid = between(
    probes.proofScans,
    detection.at,
    claimedAt
  )

  return {
    paidToDetectedMs: detection.at - paidAt,
    detectedToPaidMs: claimedAt - detection.at,
    paidToPaidMs: claimedAt - paidAt,
    sweepsWhileWaiting: sweepsWaited.length,
    sweepsThatSkippedQuote: Math.max(0, sweepsWaited.length - 1),
    quoteChecksInSweep: detectingChecks.length,
    quotePositionInSweep:
      detectingChecks.findIndex((call) => call.quoteId === payment.quoteId) + 1,
    proofScansBeforeDetection: proofScansBeforeDetection.length,
    mintCallsDetectedToPaidCount: mintCallsDetectedToPaid.length,
    mintCallsDetectedToPaidSummary: tallyCalls(mintCallsDetectedToPaid),
    proofScansDetectedToPaidCount: proofScansDetectedToPaid.length,
    writeBatchesDetectedToPaid: countWriteBatches(
      probes,
      detection.at,
      claimedAt
    ),
  }
}

const buildCustomerTokenWrap = async (
  bench: CashuBench,
  paymentId: PaymentId
) => {
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
 * Delivers a NIP-17 token just as a poll sweep starts, exposing head-of-line
 * blocking in the single Cashu queue plus the post-"receiving" pipeline.
 */
const measureToken = async (bench: CashuBench) => {
  const { probes } = bench
  const payment = await bench.preparePayment()
  const message = await buildCustomerTokenWrap(bench, payment.paymentId)

  let receivingAt: number | null = null
  const unsubscribe = cashuTokenArrivals.subscribe(() => {
    if (
      receivingAt === null &&
      cashuTokenArrivals.get(payment.paymentId)?.state === "receiving"
    )
      receivingAt = now()
  })

  let delivered: number
  let receiving: number
  let claimedAt: number
  try {
    let deliveredAt: number | null = null
    bench.onNextSweep(() => {
      deliveredAt = now()
      bench.relays.deliver(message)
    })
    delivered = await waitFor("poll sweep", () => deliveredAt)
    receiving = await waitFor("token receive banner", () => receivingAt)
    claimedAt = await waitFor("token claim", () =>
      probes.claimedAt.get(payment.paymentId)
    )
  } finally {
    unsubscribe()
  }

  const stageA = between(probes.http, delivered, receiving)
  const stageB = between(probes.http, receiving, claimedAt)
  const proofScansStageB = between(probes.proofScans, receiving, claimedAt)
  return {
    deliveredToReceivingMs: receiving - delivered,
    receivingToPaidMs: claimedAt - receiving,
    deliveredToPaidMs: claimedAt - delivered,
    quoteChecksAheadOfToken: stageA.filter((call) => call.quoteId !== null)
      .length,
    checkstateCalls: stageB.filter(({ endpoint }) =>
      endpoint.endsWith("/v1/checkstate")
    ).length,
    swapCalls: stageB.filter(({ endpoint }) => endpoint.endsWith("/v1/swap"))
      .length,
    mintCallsStageBCount: stageB.length,
    mintCallsStageBSummary: tallyCalls(stageB),
    proofScansStageBCount: proofScansStageB.length,
    proofScansStageBMs: proofScansStageB.reduce(
      (sum, scan) => sum + scan.ms,
      0
    ),
    writeBatchesStageB: countWriteBatches(probes, receiving, claimedAt),
  }
}

export const runCashu = async (
  config: CashuBenchConfig,
  priorPayments: number
) => {
  await using bench = await createCashuBench(config, priorPayments)
  await using run = testCreateRun(bench.deps)
  await using _job = await run.ok(startCashuAccountSyncJob)
  const lightning = await measureLightning(bench)
  const token = await measureToken(bench)
  if (bench.errors.length > 0) throw bench.errors[0]
  return { priorPayments, lightning, token }
}

export type CashuRun = Awaited<ReturnType<typeof runCashu>>

const probeBackToBackPreparation = async (config: CashuBenchConfig) => {
  await using bench = await createCashuBench(config, 0)
  const first = await bench.preparePayment()
  const second = await bench.preparePayment()
  const firstCalls = between(bench.probes.http, first.from, first.to)
  const secondCalls = between(bench.probes.http, second.from, second.to)
  const yadioCalls = [...firstCalls, ...secondCalls].filter(({ endpoint }) =>
    endpoint.startsWith("yadio")
  ).length
  return {
    yadioCalls,
    payments: [
      { ms: first.to - first.from, callsSummary: tallyCalls(firstCalls) },
      { ms: second.to - second.from, callsSummary: tallyCalls(secondCalls) },
    ] as const,
  }
}

const probeMintTimeout = async () => {
  const windowMs = 1_500
  let requestsCarrySignal = false
  const hungUp: Array<() => void> = []
  const hanging: typeof globalThis.fetch = (_input, init) => {
    if (init?.signal !== undefined && init.signal !== null)
      requestsCarrySignal = true
    return new Promise<Response>((_resolve, reject) => {
      const hangUp = () => reject(new TypeError("bench hung up"))
      init?.signal?.addEventListener("abort", hangUp)
      hungUp.push(hangUp)
    })
  }
  await using t = await createCashuTest({ fetch: hanging })
  await using run = testCreateRun(t.deps)
  const settled = await Promise.race([
    run(loadCashuWallet(MintUrl("https://slow-mint.test"))).then((result) =>
      result.ok ? "loaded" : result.error.type
    ),
    sleep(windowMs).then(() => null),
  ])
  // Unblock pending fetches so disposing `run` does not hang.
  for (const hangUp of hungUp) hangUp()
  return { windowMs, settled, requestsCarrySignal }
}

export const runProbes = async (config: CashuBenchConfig) => {
  const preparation = await probeBackToBackPreparation(config)
  const mintTimeout = await probeMintTimeout()
  return { preparation, mintTimeout }
}

export type ProbesRun = Awaited<ReturnType<typeof runProbes>>
