import { testCreateRun } from "@evolu/common"
import { GiftWrap } from "nostr-tools/kinds"
import type { Event } from "nostr-tools/pure"
import { generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { describe, expect, test } from "vitest"
import {
  CashuTokenText,
  type CashuTokenText as CashuTokenTextType,
} from "../../modules/cashu/cashu-types.ts"
import {
  deriveNostrSecretKey,
  MasterKey,
  type NostrSecretKey,
} from "../../modules/shared/key-derivation.ts"
import { decodeCashuTokenWrap } from "./nostr-cashu-inbox.ts"
import { sendCashuTokenMessage } from "./nostr-cashu-send.ts"
import type { NostrDep } from "./nostr-client.ts"

const masterKey = MasterKey("000102030405060708090a0b0c0d0e0f")
const relays = ["wss://relay.one.test", "wss://relay.two.test"]
const tokenText = CashuTokenText(`cashuB${"A".repeat(40)}`)

interface Published {
  readonly relays: ReadonlyArray<string>
  readonly event: Event
}

const createFakeNostrDep = (
  accepts: (event: Event) => boolean = () => true
) => {
  const published: Published[] = []
  const deps = {
    nostr: {
      relays,
      pool: {
        get: async () => null,
        publish: (to, event) => {
          published.push({ relays: to, event })
          return to.map(async () =>
            accepts(event) ? "ok" : "connection failure: x"
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

const runDeps = (nostr: NostrDep) => ({
  ...nostr,
  masterKey,
  date: { now: () => new Date(1_700_000_000_000) },
})

const wrapsFor = (published: ReadonlyArray<Published>, pubkey: string) =>
  published.filter(
    ({ event }) =>
      event.kind === GiftWrap &&
      event.tags.some(([name, value]) => name === "p" && value === pubkey)
  )

describe("sendCashuTokenMessage (withdraw/0015)", () => {
  test("wraps the bare token for the recipient, then for the account itself", async () => {
    const recipientSecret = generateSecretKey() as NostrSecretKey
    const recipient = getPublicKey(recipientSecret)
    const me = getPublicKey(deriveNostrSecretKey(masterKey))
    const fake = createFakeNostrDep()
    await using run = testCreateRun(runDeps(fake.deps))

    const result = await run(
      sendCashuTokenMessage({ to: recipient, tokenText })
    )
    expect(result.ok).toBe(true)

    const [toRecipient] = wrapsFor(fake.published, recipient)
    const [toMe] = wrapsFor(fake.published, me)
    expect(toRecipient?.relays).toEqual(relays)
    expect(toMe?.relays).toEqual(relays)
    expect(fake.published.indexOf(toRecipient as Published)).toBeLessThan(
      fake.published.indexOf(toMe as Published)
    )

    // What the recipient's Linky, or another Payky, reads from it.
    const message = decodeCashuTokenWrap({
      wrap: (toRecipient as Published).event,
      secretKey: recipientSecret,
    })
    expect(message).toMatchObject({
      sender: me,
      tokenText: tokenText as CashuTokenTextType,
      payload: null,
    })
    expect(result.ok && result.value.rumorId).toBe(message?.rumorId)
  })

  test("fails, without the own copy, when no relay takes the recipient's", async () => {
    const recipient = getPublicKey(generateSecretKey())
    const fake = createFakeNostrDep(() => false)
    await using run = testCreateRun(runDeps(fake.deps))

    await expect(
      run(sendCashuTokenMessage({ to: recipient, tokenText }))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "CashuTokenNotDelivered" },
    })
    expect(fake.published).toHaveLength(1)
  })
})
