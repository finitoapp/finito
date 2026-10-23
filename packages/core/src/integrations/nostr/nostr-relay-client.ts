import { z } from "zod"

import { jsonCodec } from "../../zod-utils.ts"

import {
  type NostrEvent,
  NostrEventSchema,
  verifyNostrEvent,
} from "./nostr-event.ts"

const DEFAULT_TIMEOUT_MS = 5000
const MAX_MESSAGE_LENGTH = 256 * 1024
const MAX_EVENTS_PER_QUERY = 50

export interface NostrFilter {
  readonly kinds?: ReadonlyArray<number>
  readonly authors?: ReadonlyArray<string>
  readonly "#d"?: ReadonlyArray<string>
}

export interface NostrSocket {
  readonly send: (data: string) => void
  readonly close: () => void
  readonly addEventListener: (
    type: "open" | "message" | "error" | "close",
    listener: (event: { readonly data?: unknown }) => void
  ) => void
}

export interface NostrPublishResult {
  readonly url: string
  readonly accepted: boolean
}

export interface NostrRelayClient {
  readonly publish: (
    relays: ReadonlyArray<string>,
    event: NostrEvent
  ) => Promise<ReadonlyArray<NostrPublishResult>>
  readonly query: (
    relays: ReadonlyArray<string>,
    filter: NostrFilter
  ) => Promise<ReadonlyArray<NostrEvent>>
}

export interface NostrRelayDep {
  readonly nostrRelayClient: NostrRelayClient
}

const RelayMessageSchema = z.union([
  z.tuple([z.literal("OK"), z.string(), z.boolean()]).rest(z.unknown()),
  z.tuple([z.literal("EVENT"), z.string(), NostrEventSchema]),
  z.tuple([z.literal("EOSE"), z.string()]),
  z.tuple([z.literal("CLOSED"), z.string()]).rest(z.unknown()),
])
type RelayMessage = z.output<typeof RelayMessageSchema>
const RelayMessageJson = jsonCodec(RelayMessageSchema)

const parseRelayMessage = (data: unknown): RelayMessage | null => {
  if (typeof data !== "string" || data.length > MAX_MESSAGE_LENGTH) return null
  const parsed = z.safeDecode(RelayMessageJson, data)
  return parsed.success ? parsed.data : null
}

const exchangeWithRelay = ({
  openSocket,
  request,
  onMessage,
  timeoutMs,
}: {
  readonly openSocket: () => NostrSocket
  readonly request: ReadonlyArray<unknown>
  readonly onMessage: (message: RelayMessage) => boolean
  readonly timeoutMs: number
}): Promise<void> =>
  new Promise((resolve) => {
    let socket: NostrSocket
    try {
      socket = openSocket()
    } catch {
      resolve()
      return
    }
    let isFinished = false
    const finish = () => {
      isFinished = true
      clearTimeout(timer)
      socket.close()
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    socket.addEventListener("open", () => socket.send(JSON.stringify(request)))
    socket.addEventListener("message", ({ data }) => {
      if (isFinished) return
      const message = parseRelayMessage(data)
      if (message !== null && onMessage(message)) finish()
    })
    socket.addEventListener("error", finish)
    socket.addEventListener("close", finish)
  })

export const createNostrRelayClient = ({
  createSocket = (url) => new WebSocket(url),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  readonly createSocket?: (url: string) => NostrSocket
  readonly timeoutMs?: number
} = {}): NostrRelayClient => ({
  publish: async (relays, event) =>
    await Promise.all(
      relays.map(async (url) => {
        let isAccepted = false
        await exchangeWithRelay({
          openSocket: () => createSocket(url),
          request: ["EVENT", event],
          onMessage: (message) => {
            if (message[0] !== "OK" || message[1] !== event.id) return false
            isAccepted = message[2]
            return true
          },
          timeoutMs,
        })
        return { url, accepted: isAccepted }
      })
    ),
  query: async (relays, filter) => {
    const events = new Map<string, NostrEvent>()
    await Promise.all(
      relays.map((url, index) => {
        const subscriptionId = `q${index}`
        let received = 0
        return exchangeWithRelay({
          openSocket: () => createSocket(url),
          request: ["REQ", subscriptionId, filter],
          onMessage: (message) => {
            if (message[1] !== subscriptionId) return false
            if (message[0] !== "EVENT") {
              return message[0] === "EOSE" || message[0] === "CLOSED"
            }
            received++
            if (verifyNostrEvent(message[2])) {
              events.set(message[2].id, message[2])
            }
            return received >= MAX_EVENTS_PER_QUERY
          },
          timeoutMs,
        })
      })
    )
    return [...events.values()]
  },
})
