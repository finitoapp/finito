import { describe, expect, test } from "vitest"

import { signNostrEvent } from "./nostr-event.ts"
import {
  createNostrRelayClient,
  type NostrSocket,
} from "./nostr-relay-client.ts"
import { createFakeNostrRelay } from "./nostr-relay-test-fixtures.ts"

const secretKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1)

const view = (created_at: number, content: string) =>
  signNostrEvent(secretKey, {
    created_at,
    kind: 30_078,
    tags: [["d", "table"]],
    content,
  })

const createScriptedSocket = (
  answer: (subscriptionId: string) => ReadonlyArray<ReadonlyArray<unknown>>
): NostrSocket => {
  const listeners = new Map<string, (event: { data?: unknown }) => void>()
  queueMicrotask(() => listeners.get("open")?.({}))
  return {
    addEventListener: (type, listener) => {
      listeners.set(type, listener)
    },
    close: () => undefined,
    send: (data) => {
      const [, subscriptionId] = JSON.parse(data) as [string, string]
      for (const message of answer(subscriptionId)) {
        listeners.get("message")?.({ data: JSON.stringify(message) })
      }
    },
  }
}

describe("nostr relays", () => {
  test("publishes to every relay and reads back what they keep", async () => {
    const first = createFakeNostrRelay()
    const second = createFakeNostrRelay()
    const sockets = { a: first, b: second } as const
    const urls = ["a", "b"]
    const relays = createNostrRelayClient({
      createSocket: (url) =>
        sockets[url as keyof typeof sockets].createSocket(),
    })

    expect(await relays.publish(urls, view(1, "old"))).toEqual([
      { url: "a", accepted: true },
      { url: "b", accepted: true },
    ])
    await relays.publish(urls, view(2, "new"))
    const found = await relays.query(urls, { kinds: [30_078], "#d": ["table"] })

    expect(found.map(({ content }) => content)).toEqual(["new"])
  })

  test("tells which relay refused an event", async () => {
    const open = createFakeNostrRelay()
    const full = createFakeNostrRelay()
    full.refuseEvents(true)
    const sockets = { open, full } as const
    const relays = createNostrRelayClient({
      createSocket: (url) =>
        sockets[url as keyof typeof sockets].createSocket(),
    })

    expect(await relays.publish(["open", "full"], view(1, "x"))).toEqual([
      { url: "open", accepted: true },
      { url: "full", accepted: false },
    ])
    expect(full.events()).toEqual([])
  })

  test("keeps the newest version of a replaceable event", async () => {
    const relay = createFakeNostrRelay()
    const urls = ["a"]
    const relays = createNostrRelayClient({
      createSocket: relay.createSocket,
    })

    await relays.publish(urls, view(5, "fresh"))
    await relays.publish(urls, view(3, "stale"))

    expect(relay.events().map(({ content }) => content)).toEqual(["fresh"])
  })

  test("keeps a signed event that another relay answered with forged content", async () => {
    const honest = createFakeNostrRelay()
    const forger = createFakeNostrRelay()
    const sockets = { honest, forger } as const
    const urls = ["honest", "forger"]
    const relays = createNostrRelayClient({
      createSocket: (url) =>
        sockets[url as keyof typeof sockets].createSocket(),
    })
    const signed = view(2, "new")
    honest.createSocket().send(JSON.stringify(["EVENT", signed]))
    forger
      .createSocket()
      .send(JSON.stringify(["EVENT", { ...signed, content: "forged" }]))

    const found = await relays.query(urls, { kinds: [30_078], "#d": ["table"] })

    expect(found).toEqual([signed])
  })

  test("keeps the other relays when one cannot open a socket", async () => {
    const relay = createFakeNostrRelay()
    const relays = createNostrRelayClient({
      createSocket: (url) => {
        if (url === "wss://broken.example/#x") throw new SyntaxError(url)
        return relay.createSocket()
      },
    })
    const signed = view(1, "x")
    const urls = ["wss://broken.example/#x", "wss://relay.example"]

    expect(await relays.publish(urls, signed)).toEqual([
      { url: "wss://broken.example/#x", accepted: false },
      { url: "wss://relay.example", accepted: true },
    ])
    expect(await relays.query(urls, { kinds: [30_078] })).toEqual([signed])
  })

  test("gives up on a relay that never answers", async () => {
    const urls = ["silent"]
    const relays = createNostrRelayClient({
      timeoutMs: 10,
      createSocket: () => ({
        addEventListener: () => undefined,
        close: () => undefined,
        send: () => undefined,
      }),
    })

    expect(await relays.publish(urls, view(1, "x"))).toEqual([
      { url: "silent", accepted: false },
    ])
    expect(await relays.query(urls, { kinds: [30_078] })).toEqual([])
  })

  test("ignores malformed relay messages", async () => {
    const urls = ["noisy"]
    const relays = createNostrRelayClient({
      timeoutMs: 50,
      createSocket: () => {
        const listeners = new Map<string, (event: { data?: unknown }) => void>()
        queueMicrotask(() => listeners.get("open")?.({}))
        return {
          addEventListener: (type, listener) => {
            listeners.set(type, listener)
          },
          close: () => undefined,
          send: () => {
            listeners.get("message")?.({ data: "not json" })
            listeners.get("message")?.({
              data: JSON.stringify(["EVENT", "q0", { id: "x" }]),
            })
            listeners.get("message")?.({ data: JSON.stringify(["EOSE", "q0"]) })
          },
        }
      },
    })

    expect(await relays.query(urls, { kinds: [30_078] })).toEqual([])
  })

  test("ignores a relay message larger than 256 KiB", async () => {
    const honest = createFakeNostrRelay()
    const signed = view(2, "table")
    honest.createSocket().send(JSON.stringify(["EVENT", signed]))
    const oversized = view(3, "x".repeat(256 * 1024))
    const urls = ["honest", "oversized"]
    const relays = createNostrRelayClient({
      createSocket: (url) =>
        url === "honest"
          ? honest.createSocket()
          : createScriptedSocket((subscriptionId) => [
              ["EVENT", subscriptionId, oversized],
              ["EOSE", subscriptionId],
            ]),
    })

    expect(await relays.query(urls, { kinds: [30_078] })).toEqual([signed])
  })

  test("stops waiting for a relay that refuses the query", async () => {
    const urls = ["refusing"]
    const relays = createNostrRelayClient({
      timeoutMs: 60_000,
      createSocket: () =>
        createScriptedSocket((subscriptionId) => [
          ["CLOSED", subscriptionId, "rate-limited: slow down"],
        ]),
    })

    expect(await relays.query(urls, { kinds: [30_078] })).toEqual([])
  })

  test("reads at most 50 events of a relay that keeps sending them", async () => {
    const flood = Array.from({ length: 120 }, (_, index) =>
      view(index, String(index))
    )
    const urls = ["flood"]
    const relays = createNostrRelayClient({
      timeoutMs: 60_000,
      createSocket: () =>
        createScriptedSocket((subscriptionId) =>
          flood.map((event) => ["EVENT", subscriptionId, event])
        ),
    })

    expect(await relays.query(urls, { kinds: [30_078] })).toHaveLength(50)
  })
})
