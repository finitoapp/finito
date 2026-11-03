import { testCreateRun } from "@evolu/common"
import type { Event } from "nostr-tools/pure"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { describe, expect, test } from "vitest"
import {
  claimCashuTopup,
  createCashuTopupQuote,
} from "../../cashu/cashu-topup.ts"
import type { NostrDep } from "../../integrations/nostr/nostr-client.ts"
import {
  createCashuTest,
  testCashuMasterKey,
  testMintUrl,
} from "../../testing/cashu.ts"
import { saveCashuAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import { sumAvailableByMint } from "../cashu/cashu-queries.ts"
import { CashuAmount } from "../cashu/cashu-types.ts"
import { PositiveInteger } from "../shared/schema.ts"
import {
  type CashuSendRecipient,
  executeCashuSendWithdrawal,
  quoteCashuSend,
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
