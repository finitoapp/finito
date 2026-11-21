import { testCreateRun } from "@evolu/common"
import type { Event } from "nostr-tools/pure"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { describe, expect, test } from "vitest"
import { returnCashuSend, sendCashu } from "../../cashu/cashu-send.ts"
import {
  claimCashuTopup,
  createCashuTopupQuote,
} from "../../cashu/cashu-topup.ts"
import { createCashuWalletDep } from "../../cashu/cashu-wallet.ts"
import type { DeviceAccountId } from "../../evolu/device-client.ts"
import type { NostrDep } from "../../integrations/nostr/nostr-client.ts"
import {
  createCashuTest,
  testCashuMasterKey,
  testMintUrl,
} from "../../testing/cashu.ts"
import { saveCashuAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import { sumAvailableByMint } from "../cashu/cashu-queries.ts"
import { CashuAmount, type CashuOperationId } from "../cashu/cashu-types.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { CashuWalletSeed } from "../shared/key-derivation.ts"
import {
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
} from "../shared/schema.ts"
import {
  CASHU_SEND_SETTLE_AFTER_MS,
  type CashuSendRecipient,
  executeCashuSendWithdrawal,
  quoteCashuSend,
  settlePendingCashuSends,
} from "./withdraw-cashu-send-actions.ts"
import {
  toWithdrawalView,
  withdrawalsByAccountQuery,
} from "./withdraw-queries.ts"

const createFakeNostrDep = (accepts = true) => {
  const published: Event[] = []
  const deps = {
    nostr: {
      relays: ["wss://relay.test"],
      pool: {
        get: async () => null,
        publish: (relays, event) => {
          published.push(event)
          return relays.map(async () =>
            accepts ? "ok" : "connection failure: refused"
          )
        },
        listConnectionStatus: () => new Map(),
        subscribeMany: () => ({ close: () => undefined }),
        subscribeManyEose: () => ({ close: () => undefined }),
      },
    },
  } satisfies NostrDep
  return { deps, published }
}

const setup = async (accepts = true) => {
  const t = await createCashuTest()
  const nostr = createFakeNostrDep(accepts)
  const deps = {
    ...t.deps,
    ...nostr.deps,
    masterKey: testCashuMasterKey,
    date: { now: () => new Date() },
  }
  await using run = testCreateRun(deps)
  const accountId = await run.ok(saveCashuAccount({ enabled: true }))
  if (accountId === null) throw new Error("no Cashu account")
  const quote = await run.orThrow(
    createCashuTopupQuote({ mint: testMintUrl, amount: CashuAmount(1000) })
  )
  t.mint.payMintQuote(quote.quoteId)
  await run.orThrow(claimCashuTopup(quote.operationId))
  return { t, deps, accountId, published: nostr.published }
}
type Setup = Awaited<ReturnType<typeof setup>>

const balance = async (deps: Setup["deps"]) =>
  sumAvailableByMint(await deps.cashuShardStore.loadProofs()).get(
    testMintUrl
  ) ?? 0

const loadWithdrawals = async (deps: Setup["deps"], accountId: AccountId) =>
  (await deps.evolu.loadQuery(withdrawalsByAccountQuery(accountId, 50))).map(
    toWithdrawalView
  )

const pubkey = getPublicKey(generateSecretKey())
const recipient: CashuSendRecipient = {
  pubkey,
  npub: `npub1${pubkey.slice(0, 10)}`,
  address: "hynek@linky.fit",
}

describe("Linky contact withdrawal (withdraw/0015)", () => {
  test("quotes the amount asked for, or the whole balance less the fee", async () => {
    const { t, deps } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const fixed = await run.orThrow(
      quoteCashuSend({
        mint: testMintUrl,
        recipient,
        amountSats: PositiveInteger(250),
      })
    )
    expect(fixed).toMatchObject({ amountSats: 250, withdrawAll: false })
    const all = await run.orThrow(
      quoteCashuSend({ mint: testMintUrl, recipient })
    )
    expect(all.withdrawAll).toBe(true)
    expect(all.amountSats + all.cost.maxFee).toBe(1000)
  })

  test("records the withdrawal, hands the token over and books the movement", async () => {
    const { t, deps, accountId, published } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    const quote = await run.orThrow(
      quoteCashuSend({
        mint: testMintUrl,
        recipient,
        amountSats: PositiveInteger(250),
      })
    )
    const result = await run.orThrow(
      executeCashuSendWithdrawal({ accountId, deviceId: null, quote })
    )
    expect(result.totalSpent).toBeGreaterThanOrEqual(250)
    expect(await balance(deps)).toBe(1000 - result.totalSpent)
    expect(published.length).toBeGreaterThanOrEqual(1)

    await expect
      .poll(() => loadWithdrawals(deps, accountId))
      .toEqual([
        expect.objectContaining({
          id: result.withdrawalId,
          amountSats: 250,
          target: expect.objectContaining({
            kind: "cashuSend",
            mintUrl: testMintUrl,
            recipientPubkey: pubkey,
            recipientAddress: "hynek@linky.fit",
            sendOperationId: expect.any(String),
          }),
          state: expect.objectContaining({
            status: "done",
            debitedSats: result.totalSpent,
            feeSats: result.totalSpent - 250,
          }),
        }),
      ])
  })

  test("fails with nothing gone when no relay takes the token", async () => {
    const { t, deps, accountId } = await setup(false)
    await using _ = t
    await using run = testCreateRun(deps)
    const quote = await run.orThrow(
      quoteCashuSend({
        mint: testMintUrl,
        recipient,
        amountSats: PositiveInteger(250),
      })
    )
    const result = await run(
      executeCashuSendWithdrawal({ accountId, deviceId: null, quote })
    )
    expect(result).toMatchObject({
      ok: false,
      error: { type: "CashuTokenNotDelivered" },
    })
    // The swap's fee is gone to the mint; the token's sats are back.
    expect(await balance(deps)).toBeGreaterThanOrEqual(1000 - quote.cost.maxFee)
    expect(
      (await deps.cashuShardStore.loadOperations()).find(
        (operation) => operation.kind === "send"
      )?.status
    ).toBe("returned")
    await expect
      .poll(() => loadWithdrawals(deps, accountId))
      .toEqual([
        expect.objectContaining({
          state: expect.objectContaining({
            status: "failed",
            reason: "rejected",
          }),
        }),
      ])
  })

  test("leaves the withdrawal pending when an undelivered token cannot be returned", async () => {
    const { t, deps, accountId } = await setup(false)
    await using _ = t
    await using run = testCreateRun(deps)
    const quote = await run.orThrow(
      quoteCashuSend({
        mint: testMintUrl,
        recipient,
        amountSats: PositiveInteger(250),
      })
    )
    const depsWithoutOperation = {
      ...deps,
      cashuShardStore: {
        ...deps.cashuShardStore,
        loadOperation: async () => null,
      },
    }
    await using runWithoutOperation = testCreateRun(depsWithoutOperation)

    const result = await runWithoutOperation(
      executeCashuSendWithdrawal({ accountId, deviceId: null, quote })
    )
    expect(result).toMatchObject({
      ok: false,
      error: { type: "CashuSendNotPending" },
    })
    await expect
      .poll(() => loadWithdrawals(deps, accountId))
      .toEqual([
        expect.objectContaining({
          state: expect.objectContaining({ status: "pending" }),
        }),
      ])
  })
})

describe("settling a Linky contact withdrawal a crash left pending (withdraw/0016)", () => {
  const thisDevice = createRowId<"Device">()

  /** What a crash after the withdrawal was recorded leaves behind. */
  const strand = async (
    deps: Setup["deps"],
    accountId: AccountId,
    {
      sendOperationId = null,
      feeSats = null,
      deviceId = thisDevice,
    }: {
      readonly sendOperationId?: CashuOperationId | null
      readonly feeSats?: number | null
      readonly deviceId?: typeof thisDevice
    } = {}
  ) => {
    const withdrawalId = createRowId<"Withdrawal">()
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: deps.evoluOwner }
      deps.evolu.upsert(
        "withdrawal",
        {
          id: withdrawalId,
          accountId,
          deviceId,
          amountSats: PositiveInteger(250),
          accountTransactionId: createRowId<"AccountTransaction">(),
          failedAt: null,
          failureReason: null,
          comment: null,
        },
        mutationOptions
      )
      deps.evolu.upsert(
        "withdrawalCashuSend",
        {
          id: withdrawalId,
          mintUrl: testMintUrl,
          sendOperationId,
          feeSats: feeSats === null ? null : NonNegativeInteger(feeSats),
          recipientPubkey: NonEmptyStringSchema.decode(pubkey),
          recipientAddress: null,
        },
        mutationOptions
      )
    })
    return withdrawalId
  }

  /** Runs the settling as the Cashu job does, `afterMs` from now. */
  const settle = async (deps: Setup["deps"], afterMs: number) => {
    await using run = testCreateRun({
      ...deps,
      deviceId: thisDevice,
      date: { now: () => new Date(Date.now() + afterMs) },
    })
    await run.ok(settlePendingCashuSends)
  }

  const later = CASHU_SEND_SETTLE_AFTER_MS + 60_000

  const stateOf = async (deps: Setup["deps"], accountId: AccountId) => {
    const [withdrawal] = await loadWithdrawals(deps, accountId)
    return withdrawal?.state
  }

  const send = async (deps: Setup["deps"]) => {
    await using run = testCreateRun(deps)
    return await run.orThrow(sendCashu({ mint: testMintUrl, amount: 250 }))
  }

  test("fails one with no send linked, on its own device once no send can still run", async () => {
    const { t, deps, accountId } = await setup()
    await using _ = t
    await strand(deps, accountId)

    await settle(deps, 60_000)
    expect(await stateOf(deps, accountId)).toMatchObject({ status: "pending" })

    await settle(deps, later)
    await expect
      .poll(() => stateOf(deps, accountId))
      .toMatchObject({ status: "failed", reason: "rejected" })
  })

  test("leaves another device's unlinked one to that device", async () => {
    const { t, deps, accountId } = await setup()
    await using _ = t
    await strand(deps, accountId, { deviceId: createRowId<"Device">() })

    await settle(deps, later)

    expect(await stateOf(deps, accountId)).toMatchObject({ status: "pending" })
  })

  test("fails one whose send was taken back", async () => {
    const { t, deps, accountId } = await setup()
    await using _ = t
    const sent = await send(deps)
    {
      await using run = testCreateRun(deps)
      await run.orThrow(returnCashuSend(sent.operationId))
    }
    await strand(deps, accountId, { sendOperationId: sent.operationId })

    await settle(deps, later)

    await expect
      .poll(() => stateOf(deps, accountId))
      .toMatchObject({ status: "failed", reason: "rejected" })
  })

  test("books one whose token the recipient redeemed, with its fee", async () => {
    const { t, deps, accountId } = await setup()
    await using _ = t
    const sent = await send(deps)
    await strand(deps, accountId, {
      sendOperationId: sent.operationId,
      feeSats: 2,
    })
    const recipientWallet = createCashuWalletDep({
      seed: CashuWalletSeed(new Uint8Array(64).fill(9)),
      deviceAccountId: "recipient" as DeviceAccountId,
      fetch: deps.fetch,
    })
    const wallet = await recipientWallet.cashuWallet.load(testMintUrl)
    await wallet.receive(sent.tokenText)

    await settle(deps, later)

    await expect
      .poll(() => stateOf(deps, accountId))
      .toMatchObject({ status: "done", debitedSats: 252, feeSats: 2 })
  })

  test("keeps one whose token nobody redeemed pending, its proofs untouched", async () => {
    const { t, deps, accountId } = await setup()
    await using _ = t
    const sent = await send(deps)
    await strand(deps, accountId, { sendOperationId: sent.operationId })

    await settle(deps, later)

    expect(await stateOf(deps, accountId)).toMatchObject({ status: "pending" })
    const handedOut = (await deps.cashuShardStore.loadProofs()).filter(
      (proof) => proof.operationId === sent.operationId
    )
    expect(handedOut.length).toBeGreaterThan(0)
    expect(handedOut.every((proof) => proof.state === "handedOut")).toBe(true)
  })
})
