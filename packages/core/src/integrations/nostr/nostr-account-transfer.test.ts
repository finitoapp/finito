import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import type { SubscribeManyParams } from "nostr-tools/abstract-pool"
import { type Filter, matchFilter } from "nostr-tools/filter"
import { encrypt, getConversationKey } from "nostr-tools/nip44"
import {
  type Event,
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { MasterKey } from "../../modules/shared/key-derivation.ts"
import { type PairUri, parsePairUri } from "../../modules/shared/payky-uri.ts"
import { NonEmptyString255, WssUrl } from "../../modules/shared/schema.ts"

import {
  computeHelloProof,
  computeTransferCode,
  createTransferPayload,
  PAYKY_PAIR_KIND,
  QR_LIFETIME_MS,
  startTransferSource,
  startTransferTarget,
  type TransferPayload,
  TransferPayloadSchema,
  type TransferSourceState,
  type TransferTargetState,
} from "./nostr-account-transfer.ts"
import type { NostrDep } from "./nostr-client.ts"

const relay = "wss://relay.test"

const payload: TransferPayload = {
  masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
  accountName: NonEmptyString255("Shop"),
  transports: [
    WssUrl("wss://evolu.example"),
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the stored placeholder.
    WssUrl("wss://live.example/${appOwnerId}"),
  ],
}

/**
 * One in-memory relay. `relayFilter` sees every published event and drops
 * it by returning false — a relay that suppresses or injects.
 */
const createRelay = ({
  relayFilter = () => true,
}: {
  readonly relayFilter?: (event: Event) => boolean
} = {}) => {
  const published: Event[] = []
  const subscriptions: {
    readonly filter: Filter
    readonly params: SubscribeManyParams
    closed: boolean
  }[] = []
  const deliver = (event: Event) => {
    for (const subscription of subscriptions) {
      if (!subscription.closed && matchFilter(subscription.filter, event)) {
        setTimeout(() => {
          if (!subscription.closed) subscription.params.onevent?.(event)
        }, 0)
      }
    }
  }
  const deps = {
    nostr: {
      relays: [relay],
      pool: {
        get: async () => null,
        listConnectionStatus: () => new Map(),
        subscribeManyEose: () => ({ close: () => undefined }),
        publish: (relays, event) => {
          published.push(event)
          if (relayFilter(event)) deliver(event)
          return relays.map(async () => "ok")
        },
        subscribeMany: (_relays, filter, params) => {
          const subscription = { filter, params, closed: false }
          subscriptions.push(subscription)
          return {
            close: () => {
              subscription.closed = true
            },
          }
        },
      },
    },
    date: { now: () => new Date() },
  } satisfies NostrDep & { date: { now: () => Date } }
  const sentTo = (from: string, to: string) =>
    published.filter(
      (event) =>
        event.pubkey === from &&
        event.tags.some(([name, value]) => name === "p" && value === to)
    )
  return { deps, published, deliver, sentTo }
}
type Relay = ReturnType<typeof createRelay>

/** A message as a party with `secretKey` would publish it. */
const craft = (secretKey: Uint8Array, to: string, content: string): Event =>
  finalizeEvent(
    {
      kind: PAYKY_PAIR_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", to]],
      content: encrypt(content, getConversationKey(secretKey, to)),
    },
    secretKey
  )

const flush = () => vi.advanceTimersByTimeAsync(1)

const startSource = (network: Relay) => {
  const states: TransferSourceState[] = []
  const session = startTransferSource(network.deps, {
    payload,
    onState: (state) => states.push(state),
  })
  const first = states[0]
  if (first?.phase !== "waiting") throw new Error("No QR")
  const pair = parsePairUri(first.uri)
  if (!pair.ok) throw new Error("Bad QR")
  return {
    session,
    states,
    pair: pair.value,
    last: () => states.at(-1),
  }
}

const startTarget = (network: Relay, pair: PairUri) => {
  const states: TransferTargetState[] = []
  const session = startTransferTarget(network.deps, {
    pair,
    onState: (state) => states.push(state),
  })
  const targetPubkey = () => {
    const hello = network.published.find(
      (event) =>
        event.tags.some(([, value]) => value === pair.pk) &&
        event.pubkey !== pair.pk
    )
    if (hello === undefined) throw new Error("No hello")
    return hello.pubkey
  }
  return { session, states, targetPubkey, last: () => states.at(-1) }
}

/** A `hello` from a fresh key, valid or not. */
const sendHello = (
  network: Relay,
  pair: PairUri,
  { validProof = true }: { readonly validProof?: boolean } = {}
) => {
  const secretKey = generateSecretKey()
  const pubkey = getPublicKey(secretKey)
  const proof = validProof
    ? computeHelloProof(hexToBytes(pair.s), pair.pk, pubkey)
    : "00".repeat(32)
  network.deliver(
    craft(secretKey, pair.pk, JSON.stringify({ t: "hello", proof }))
  )
  return { secretKey, pubkey }
}

const codeOf = (states: ReadonlyArray<TransferTargetState>) => {
  const state = states.find((candidate) => candidate.phase === "code")
  if (state?.phase !== "code") throw new Error("No code shown")
  return state.code
}

const wrongCode = (code: string) => (code === "000000" ? "111111" : "000000")

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("transfer code", () => {
  const secret = hexToBytes("000102030405060708090a0b0c0d0e0f")
  const source = getPublicKey(hexToBytes("01".repeat(32)))
  const target = getPublicKey(hexToBytes("02".repeat(32)))

  test("is fixed for raw-byte inputs", () => {
    expect(computeHelloProof(secret, source, target)).toMatchInlineSnapshot(
      `"45a2081281aca988cb107e7087bc2fae6d7534c435b4319581dd85746423d19a"`
    )
    expect(computeTransferCode(secret, source, target)).toMatchInlineSnapshot(
      `"272931"`
    )
  })

  test("depends on the session secret and on which key is the source", () => {
    const code = computeTransferCode(secret, source, target)

    expect(computeTransferCode(new Uint8Array(16), source, target)).not.toBe(
      code
    )
    expect(computeTransferCode(secret, target, source)).not.toBe(code)
    expect(computeHelloProof(secret, target, source)).not.toBe(
      computeHelloProof(secret, source, target)
    )
  })
})

describe("transfer payload", () => {
  test("rejects a non-wss transport and more than eight", () => {
    const base = { masterKey: payload.masterKey, accountName: "Shop" }

    expect(
      TransferPayloadSchema.safeParse({
        ...base,
        transports: ["https://evolu.example"],
      }).success
    ).toBe(false)
    expect(
      TransferPayloadSchema.safeParse({
        ...base,
        transports: Array.from({ length: 9 }, (_, i) => `wss://r${i}.example`),
      }).success
    ).toBe(false)
  })

  test("collapses duplicate transports", () => {
    expect(
      TransferPayloadSchema.parse({
        masterKey: payload.masterKey,
        accountName: "Shop",
        transports: ["wss://a.example", "wss://a.example"],
      }).transports
    ).toEqual(["wss://a.example"])
  })
})

describe("createTransferPayload", () => {
  test("sends each wss transport once, at most eight, and nothing else", () => {
    const transports = [
      { url: "wss://a.example" },
      { url: "https://not-a-relay.example" },
      { url: "wss://a.example" },
      ...Array.from({ length: 9 }, (_, i) => ({ url: `wss://r${i}.example` })),
    ]
    const sent = createTransferPayload({
      masterKey: payload.masterKey,
      name: "Shop",
      transports,
    })
    expect(sent.accountName).toBe("Shop")
    expect(sent.transports).toEqual([
      "wss://a.example",
      ...Array.from({ length: 7 }, (_, i) => `wss://r${i}.example`),
    ])
    expect(TransferPayloadSchema.parse(sent)).toEqual(sent)
  })
})

describe("account transfer session", () => {
  test("transfers exactly the payload to the device whose code was typed", async () => {
    const network = createRelay()
    const source = startSource(network)
    const target = startTarget(network, source.pair)
    await flush()

    expect(source.last()?.phase).toBe("locked")
    source.session.submitCode(codeOf(target.states))
    await flush()
    await flush()

    expect(target.last()).toEqual({ phase: "received", payload })
    expect(source.last()).toEqual({ phase: "done", acked: true })
  })

  test("accepts the code with a space and after one typo", async () => {
    const network = createRelay()
    const source = startSource(network)
    const target = startTarget(network, source.pair)
    await flush()

    source.session.submitCode(wrongCode(codeOf(target.states)))
    expect(source.last()).toMatchObject({
      phase: "locked",
      attemptsLeft: 2,
      mismatch: true,
    })
    const code = codeOf(target.states)
    source.session.submitCode(`${code.slice(0, 3)} ${code.slice(3)}`)
    await flush()
    await flush()

    expect(target.last()?.phase).toBe("received")
  })

  test("three wrong codes abort without a payload", async () => {
    const network = createRelay()
    const source = startSource(network)
    const target = startTarget(network, source.pair)
    await flush()
    const wrong = wrongCode(codeOf(target.states))

    for (let attempt = 0; attempt < 3; attempt++) {
      source.session.submitCode(wrong)
    }
    await flush()

    expect(source.last()).toEqual({ phase: "failed", reason: "codeMismatch" })
    expect(target.last()).toEqual({ phase: "failed", reason: "codeMismatch" })
    expect(source.states.some((state) => state.phase === "sending")).toBe(false)
  })

  test("the target shows no code before ready", async () => {
    // A relay that delivers the hello but never the source's answer.
    const sourceRelay = createRelay()
    const source = startSource(sourceRelay)
    const target = startTarget(
      createRelay({ relayFilter: () => false }),
      source.pair
    )
    await flush()

    expect(target.states).toEqual([{ phase: "connecting" }])
  })

  test("a second device with a valid hello aborts both as conflict", async () => {
    const network = createRelay()
    const source = startSource(network)
    const target = startTarget(network, source.pair)
    await flush()
    const forger = sendHello(network, source.pair, { validProof: false })
    const other = sendHello(network, source.pair)
    await flush()

    expect(source.last()).toEqual({ phase: "failed", reason: "conflict" })
    expect(target.last()).toEqual({ phase: "failed", reason: "conflict" })
    expect(network.sentTo(source.pair.pk, other.pubkey)).toHaveLength(1)
    expect(network.sentTo(source.pair.pk, forger.pubkey)).toHaveLength(0)
    expect(source.states.some((state) => state.phase === "sending")).toBe(false)
  })

  test("a hello with a wrong proof neither locks nor conflicts", async () => {
    const network = createRelay()
    const source = startSource(network)
    sendHello(network, source.pair, { validProof: false })
    await flush()
    expect(source.last()?.phase).toBe("waiting")

    const target = startTarget(network, source.pair)
    await flush()
    source.session.submitCode(codeOf(target.states))
    await flush()
    await flush()

    expect(target.last()?.phase).toBe("received")
  })

  test("a relay that swaps the hello for its own, without s, gets nothing", async () => {
    let sourcePubkey = ""
    const network = createRelay({
      relayFilter: (event) =>
        event.pubkey === sourcePubkey ||
        !event.tags.some(([, value]) => value === sourcePubkey),
    })
    const source = startSource(network)
    sourcePubkey = source.pair.pk
    const target = startTarget(network, source.pair)
    const attacker = sendHello(network, source.pair, { validProof: false })
    await flush()

    expect(source.last()?.phase).toBe("waiting")
    expect(network.sentTo(source.pair.pk, attacker.pubkey)).toHaveLength(0)
    expect(target.states).toEqual([{ phase: "connecting" }])
  })

  test("a relay that knows s and swaps the hello locks the source onto itself, and the phone shows no code", async () => {
    let sourcePubkey = ""
    const network = createRelay({
      relayFilter: (event) =>
        event.pubkey === sourcePubkey ||
        !event.tags.some(([, value]) => value === sourcePubkey),
    })
    const source = startSource(network)
    sourcePubkey = source.pair.pk
    const target = startTarget(network, source.pair)
    const attacker = sendHello(network, source.pair)
    await flush()

    expect(source.last()?.phase).toBe("locked")
    expect(network.sentTo(sourcePubkey, attacker.pubkey)).toHaveLength(1)
    expect(network.sentTo(sourcePubkey, target.targetPubkey())).toHaveLength(0)
    expect(target.states).toEqual([{ phase: "connecting" }])
  })

  test("the target ignores ready and payload not signed by the QR's key", async () => {
    const network = createRelay()
    const sourceKey = generateSecretKey()
    const pair: PairUri = {
      pk: getPublicKey(sourceKey),
      s: bytesToHex(new Uint8Array(16).fill(7)),
      r: [WssUrl(relay)],
    }
    const target = startTarget(network, pair)
    await flush()
    const stranger = generateSecretKey()
    const to = target.targetPubkey()
    network.deliver(craft(stranger, to, JSON.stringify({ t: "ready" })))
    network.deliver(
      craft(stranger, to, JSON.stringify({ t: "payload", data: payload }))
    )
    await flush()
    expect(target.states).toEqual([{ phase: "connecting" }])

    network.deliver(craft(sourceKey, to, JSON.stringify({ t: "ready" })))
    await flush()
    network.deliver(
      craft(stranger, to, JSON.stringify({ t: "payload", data: payload }))
    )
    await flush()
    expect(target.last()?.phase).toBe("code")
  })

  test("the target ignores a payload before ready and an abort after the payload", async () => {
    const network = createRelay()
    const sourceKey = generateSecretKey()
    const pair: PairUri = {
      pk: getPublicKey(sourceKey),
      s: bytesToHex(new Uint8Array(16).fill(7)),
      r: [WssUrl(relay)],
    }
    const target = startTarget(network, pair)
    await flush()
    const to = target.targetPubkey()
    const send = (message: unknown) =>
      network.deliver(craft(sourceKey, to, JSON.stringify(message)))

    send({ t: "payload", data: payload })
    await flush()
    expect(target.states).toEqual([{ phase: "connecting" }])

    send({ t: "ready" })
    await flush()
    send({ t: "payload", data: payload })
    await flush()
    send({ t: "abort", reason: "cancelled" })
    await flush()

    expect(target.last()).toEqual({ phase: "received", payload })
  })

  test("an invalid payload ends the target without anything to add", async () => {
    const network = createRelay()
    const sourceKey = generateSecretKey()
    const pair: PairUri = {
      pk: getPublicKey(sourceKey),
      s: bytesToHex(new Uint8Array(16).fill(7)),
      r: [WssUrl(relay)],
    }
    const target = startTarget(network, pair)
    await flush()
    const to = target.targetPubkey()
    network.deliver(craft(sourceKey, to, JSON.stringify({ t: "ready" })))
    await flush()
    network.deliver(
      craft(
        sourceKey,
        to,
        JSON.stringify({
          t: "payload",
          data: { ...payload, transports: ["https://x.example"] },
        })
      )
    )
    await flush()

    expect(target.last()).toEqual({ phase: "failed", reason: "invalid" })
  })

  test("a valid hello after the lock is a conflict, after the payload it is ignored", async () => {
    const network = createRelay()
    const source = startSource(network)
    const target = startTarget(network, source.pair)
    await flush()
    source.session.submitCode(codeOf(target.states))
    await flush()
    sendHello(network, source.pair)
    await flush()
    await flush()

    expect(source.last()).toEqual({ phase: "done", acked: true })
  })

  test("the source ignores ack and abort from anyone but the locked device", async () => {
    const network = createRelay()
    const source = startSource(network)
    const stranger = generateSecretKey()
    const fromStranger = (message: unknown) =>
      network.deliver(craft(stranger, source.pair.pk, JSON.stringify(message)))
    fromStranger({ t: "abort", reason: "cancelled" })
    fromStranger({ t: "ack" })
    await flush()
    expect(source.last()?.phase).toBe("waiting")

    const target = startTarget(network, source.pair)
    await flush()
    fromStranger({ t: "abort", reason: "cancelled" })
    await flush()
    expect(source.last()?.phase).toBe("locked")
    expect(target.last()?.phase).toBe("code")
  })

  test("the source drops messages of the wrong direction and undecryptable content", async () => {
    const network = createRelay()
    const source = startSource(network)
    const stranger = generateSecretKey()
    network.deliver(
      craft(
        stranger,
        source.pair.pk,
        JSON.stringify({ t: "payload", data: payload })
      )
    )
    network.deliver(craft(stranger, source.pair.pk, "not json"))
    network.deliver({
      ...craft(stranger, source.pair.pk, "{}"),
      content: "garbage",
    })
    await flush()

    expect(source.states).toHaveLength(1)
  })

  test("the same hello delivered twice does not abort", async () => {
    const network = createRelay()
    const source = startSource(network)
    const target = startTarget(network, source.pair)
    await flush()
    const hello = network.sentTo(target.targetPubkey(), source.pair.pk)[0]
    if (hello === undefined) throw new Error("No hello")
    network.deliver({ ...hello })
    await flush()

    expect(source.last()?.phase).toBe("locked")
  })

  test("after the QR expires the source stops listening", async () => {
    const network = createRelay()
    const source = startSource(network)
    await vi.advanceTimersByTimeAsync(QR_LIFETIME_MS)
    expect(source.last()).toEqual({ phase: "expired" })

    const target = startTarget(network, source.pair)
    await flush()
    expect(network.sentTo(source.pair.pk, target.targetPubkey())).toHaveLength(
      0
    )
  })

  test("a missing ack ends in sent, not failure", async () => {
    let dropAcks = false
    let sourcePubkey = ""
    const network = createRelay({
      relayFilter: (event) =>
        !dropAcks || !event.tags.some(([, value]) => value === sourcePubkey),
    })
    const source = startSource(network)
    sourcePubkey = source.pair.pk
    const target = startTarget(network, source.pair)
    await flush()
    dropAcks = true
    source.session.submitCode(codeOf(target.states))
    await vi.advanceTimersByTimeAsync(30_000)

    expect(target.last()?.phase).toBe("received")
    expect(source.last()).toEqual({ phase: "done", acked: false })
  })
})
