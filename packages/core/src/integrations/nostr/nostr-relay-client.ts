import { z } from "zod"

import { jsonCodec } from "../../zod-utils.ts"

import {
  getNostrTag,
  type NostrEvent,
  NostrEventSchema,
  verifyNostrEvent,
} from "./nostr-event.ts"

const DEFAULT_TIMEOUT_MS = 5000
const LATE_RELAY_GRACE_MS = 1000
const MAX_MESSAGE_LENGTH = 256 * 1024
const MAX_EVENTS_PER_QUERY = 50
const MAX_SUBSCRIPTION_EVENTS_PER_MINUTE = 120
const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000

export interface NostrFilter {
  readonly kinds?: ReadonlyArray<number>
  readonly authors?: ReadonlyArray<string>
  readonly "#d"?: ReadonlyArray<string>
}

export const matchesNostrFilter = (event: NostrEvent, filter: NostrFilter) =>
  (filter.kinds?.includes(event.kind) ?? true) &&
  (filter.authors?.includes(event.pubkey) ?? true) &&
  (filter["#d"]?.includes(getNostrTag(event, "d") ?? "") ?? true)

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
  readonly subscribe: (
    relays: ReadonlyArray<string>,
    filters: ReadonlyArray<NostrFilter>,
    listener: {
      readonly onEvent: (event: NostrEvent) => void
      readonly onLive: (liveRelays: number) => void
    }
  ) => NostrSubscription
}

export interface NostrSubscription {
  readonly update: (filters: ReadonlyArray<NostrFilter>) => void
  readonly close: () => void
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
  signal,
}: {
  readonly openSocket: () => NostrSocket
  readonly request: ReadonlyArray<unknown>
  readonly onMessage: (message: RelayMessage) => boolean
  readonly timeoutMs: number
  readonly signal?: AbortSignal
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
    signal?.addEventListener("abort", finish)
    socket.addEventListener("open", () => socket.send(JSON.stringify(request)))
    socket.addEventListener("message", ({ data }) => {
      if (isFinished) return
      const message = parseRelayMessage(data)
      if (message !== null && onMessage(message)) finish()
    })
    socket.addEventListener("error", finish)
    socket.addEventListener("close", finish)
  })

const untilLateRelayGrace = async (
  exchanges: (onAnswer: () => void) => ReadonlyArray<Promise<void>>
): Promise<void> => {
  const grace = Promise.withResolvers<void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const onAnswer = () => {
    timer ??= setTimeout(grace.resolve, LATE_RELAY_GRACE_MS)
  }
  await Promise.race([Promise.all(exchanges(onAnswer)), grace.promise])
  clearTimeout(timer)
}

export const createNostrRelayClient = ({
  createSocket = (url) => new WebSocket(url),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  readonly createSocket?: (url: string) => NostrSocket
  readonly timeoutMs?: number
} = {}): NostrRelayClient => ({
  publish: async (relays, event) => {
    const accepted = new Set<string>()
    await untilLateRelayGrace((onAnswer) =>
      relays.map((url) =>
        exchangeWithRelay({
          openSocket: () => createSocket(url),
          request: ["EVENT", event],
          onMessage: (message) => {
            if (message[0] !== "OK" || message[1] !== event.id) return false
            if (message[2]) accepted.add(url)
            onAnswer()
            return true
          },
          timeoutMs,
        })
      )
    )
    return relays.map((url) => ({ url, accepted: accepted.has(url) }))
  },
  query: async (relays, filter) => {
    const events = new Map<string, NostrEvent>()
    const lateRelays = new AbortController()
    await untilLateRelayGrace((onAnswer) =>
      relays.map((url, index) => {
        const subscriptionId = `q${index}`
        let received = 0
        return exchangeWithRelay({
          openSocket: () => createSocket(url),
          request: ["REQ", subscriptionId, filter],
          onMessage: (message) => {
            if (message[1] !== subscriptionId) return false
            if (message[0] !== "EVENT") {
              if (message[0] === "EOSE") onAnswer()
              return message[0] === "EOSE" || message[0] === "CLOSED"
            }
            received++
            if (verifyNostrEvent(message[2])) {
              events.set(message[2].id, message[2])
            }
            if (received < MAX_EVENTS_PER_QUERY) return false
            onAnswer()
            return true
          },
          timeoutMs,
          signal: lateRelays.signal,
        })
      })
    )
    lateRelays.abort()
    return [...events.values()]
  },
  subscribe: (relays, initialFilters, { onEvent, onLive }) => {
    let filters = initialFilters
    let isClosed = false
    let requests = 0
    const delivered = new Set<string>()
    const liveRelays = new Set<string>()
    const setLive = (url: string, isLive: boolean) => {
      if (liveRelays.has(url) === isLive) return
      if (isLive) liveRelays.add(url)
      else liveRelays.delete(url)
      onLive(liveRelays.size)
    }

    const connectTo = (url: string) => {
      let socket: NostrSocket | null = null
      let isOpen = false
      let subscriptionId = ""
      let retries = 0
      let isFlooding = false
      let eventTimes: ReadonlyArray<number> = []
      let answerTimer: ReturnType<typeof setTimeout> | undefined
      let retryTimer: ReturnType<typeof setTimeout> | undefined

      const request = () => {
        if (socket === null || !isOpen) return
        if (subscriptionId !== "") {
          socket.send(JSON.stringify(["CLOSE", subscriptionId]))
        }
        requests++
        subscriptionId = `s${requests}`
        socket.send(JSON.stringify(["REQ", subscriptionId, ...filters]))
      }
      const disconnect = () => {
        clearTimeout(answerTimer)
        const closing = socket
        socket = null
        isOpen = false
        subscriptionId = ""
        closing?.close()
        setLive(url, false)
      }
      const retry = () => {
        disconnect()
        if (isClosed || isFlooding) return
        retryTimer = setTimeout(
          connect,
          Math.min(FIRST_RETRY_MS * 2 ** retries, MAX_RETRY_MS)
        )
        retries++
      }
      const isOverEventLimit = () => {
        const now = Date.now()
        eventTimes = [...eventTimes.filter((at) => now - at < 60_000), now]
        return eventTimes.length > MAX_SUBSCRIPTION_EVENTS_PER_MINUTE
      }
      const receive = (message: RelayMessage) => {
        if (message[1] !== subscriptionId) return
        switch (message[0]) {
          case "EOSE":
            clearTimeout(answerTimer)
            retries = 0
            setLive(url, true)
            return
          case "CLOSED":
            retry()
            return
          case "EVENT": {
            if (isOverEventLimit()) {
              isFlooding = true
              disconnect()
              return
            }
            const event = message[2]
            if (delivered.has(event.id) || !verifyNostrEvent(event)) return
            delivered.add(event.id)
            onEvent(event)
            return
          }
          case "OK":
            return
        }
      }
      const connect = () => {
        let opened: NostrSocket
        try {
          opened = createSocket(url)
        } catch {
          return
        }
        socket = opened
        answerTimer = setTimeout(retry, timeoutMs)
        opened.addEventListener("open", () => {
          if (socket !== opened) return
          isOpen = true
          request()
        })
        opened.addEventListener("message", ({ data }) => {
          if (socket !== opened) return
          const message = parseRelayMessage(data)
          if (message !== null) receive(message)
        })
        const onDrop = () => {
          if (socket === opened) retry()
        }
        opened.addEventListener("error", onDrop)
        opened.addEventListener("close", onDrop)
      }

      connect()
      return {
        request,
        close: () => {
          clearTimeout(retryTimer)
          disconnect()
        },
      }
    }

    const connections = relays.map(connectTo)
    return {
      update: (next) => {
        filters = next
        for (const connection of connections) connection.request()
      },
      close: () => {
        isClosed = true
        for (const connection of connections) connection.close()
      },
    }
  },
})
