import { createConsole, testCreateRun } from "@evolu/common"
import { PrivateDirectMessage } from "nostr-tools/kinds"
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { describe, expect, test } from "vitest"
import { writeCashuDefaultMint } from "../../cashu/cashu-mints.ts"
import { createCashuWalletDep } from "../../cashu/cashu-wallet.ts"
import { deriveDeviceAccountId } from "../../evolu/device-account.ts"
import type { DeviceAccountId } from "../../evolu/device-client.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createNostrRelayClient } from "../../integrations/nostr/nostr-relay-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { saveCashuAccount } from "../../modules/account/account-actions.ts"
import type { DeviceId } from "../../modules/device/device-types.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import { prepareCashuPaymentMethod } from "../../modules/payment/payment-preparation-actions.ts"
import { paymentClaimsQuery } from "../../modules/payment/payment-queries.ts"
import type { PaymentId } from "../../modules/payment/payment-types.ts"
import {
  CashuWalletSeed,
  deriveNostrSecretKey,
} from "../../modules/shared/key-derivation.ts"
import { NonNegativeInteger } from "../../modules/shared/schema.ts"
import { createSparkWalletDep } from "../../spark/spark-wallet.ts"
import { testSyncedAppOwner } from "../../testing/app-owner-sync.ts"
import { testNotificationsDep } from "../../testing/background-jobs.ts"
import {
  createCashuTest,
  testCashuMasterKey,
  testMintUrl,
} from "../../testing/cashu.ts"
import { createFakeNostrDep } from "../../testing/nostr.ts"
import type { CashuBackgroundJobContext } from "../background-job-types.ts"
import { startCashuAccountSyncJob } from "./cashu-account-sync-job.ts"

const setup = async () => {
  const t = await createCashuTest()
  const dateDep = { date: { now: () => new Date() } }
  const fetchDep = {
    fetch: async () =>
      new Response(
        JSON.stringify({ BTC: 1_500_000, timestamp: 1_700_000_000_000 })
      ),
  }
  const errors: unknown[] = []
  const relays = createFakeNostrDep()
  const deps: CashuBackgroundJobContext & ReturnType<typeof createYadioApiDep> =
    {
      ...t.deps,
      ...dateDep,
      ...fetchDep,
      ...createYadioApiDep(),
      ...createQerkoApiDep({ posId: "test" }),
      ...createQerkoSocketDep(),
      ...createQerkoConnectionStatusDep(),
      ...testSyncedAppOwner,
      ...createEetApiDep({ ...dateDep, ...fetchDep }),
      ...createSparkWalletDep(),
      tableSelfPayRoot: new Uint8Array(32),
      selfPayDefaultRelays: [],
      nostrRelayClient: createNostrRelayClient(),
      masterKey: testCashuMasterKey,
      deviceAccountId: deriveDeviceAccountId(testCashuMasterKey),
      ...testNotificationsDep(),
      nostr: relays.nostr,
      console: createConsole({ level: "silent" }),
      deviceId: "device" as DeviceId,
      connectivity: { onOnline: () => () => {} },
      onError: (error) => {
        errors.push(error)
      },
    }
  await using run = testCreateRun(deps)
  const accountId = await run.ok(saveCashuAccount({ enabled: true }))
  if (accountId === null) throw new Error("no Cashu account")
  await writeCashuDefaultMint(deps.cashuShardStore, testMintUrl)
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
  await run.orThrow(prepareCashuPaymentMethod({ paymentId, accountId }))
  return { t, deps, errors, relays, paymentId }
}

const waitForClaim = (deps: CashuBackgroundJobContext, paymentId: PaymentId) =>
  expect
    .poll(() => deps.evolu.loadQuery(paymentClaimsQuery(paymentId)), {
      timeout: 15_000,
      interval: 200,
    })
    .toHaveLength(1)

describe("cashu account sync job", () => {
  test("settles a paid Cashu payment: claims the quote, books the topup, claims the payment", async () => {
    const { t, deps, errors, paymentId } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const job = await run.ok(startCashuAccountSyncJob)

    const [quoteId] = t.mint.mintQuoteIds()
    t.mint.payMintQuote(quoteId ?? "")

    await waitForClaim(deps, paymentId)
    expect(t.mint.mintQuoteState(quoteId ?? "")).toBe("ISSUED")
    await job[Symbol.asyncDispose]()
    expect(errors).toEqual([])
  }, 30_000)

  test("settles a payment paid with a NUT-18 token over NIP-17", async () => {
    const { t, deps, errors, relays, paymentId } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const job = await run.ok(startCashuAccountSyncJob)

    // The customer's wallet sends the payment's 8 600 sat as a payload.
    const customerWallet = await createCashuWalletDep({
      seed: CashuWalletSeed(new Uint8Array(64).fill(9)),
      deviceAccountId: "customer" as DeviceAccountId,
      fetch: t.deps.fetch,
    }).cashuWallet.load(testMintUrl)
    const quote = await customerWallet.createMintQuoteBolt11(8_600)
    t.mint.payMintQuote(quote.quote)
    const proofs = await customerWallet.mintProofsBolt11(8_600, quote.quote)
    const customer = generateSecretKey()
    const payky = getPublicKey(deriveNostrSecretKey(testCashuMasterKey))
    const payload = JSON.stringify({
      id: paymentId,
      mint: testMintUrl,
      unit: "sat",
      proofs: proofs.map((proof) => ({
        id: proof.id,
        amount: Number(proof.amount),
        secret: proof.secret,
        C: proof.C,
      })),
    })
    relays.deliver(
      createWrap(
        createSeal(
          createRumor(
            {
              kind: PrivateDirectMessage,
              created_at: Math.floor(Date.now() / 1000),
              content: payload,
              tags: [["p", payky]],
            },
            customer
          ),
          customer,
          payky
        ),
        payky
      )
    )

    await waitForClaim(deps, paymentId)
    await job[Symbol.asyncDispose]()
    expect(errors).toEqual([])
  }, 30_000)
})
