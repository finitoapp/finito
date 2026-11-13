import { getNostrTag, type NostrEvent } from "./nostr-event.ts"
import {
  matchesNostrFilter,
  type NostrFilter,
  type NostrSocket,
} from "./nostr-relay-client.ts"

const isAddressable = (kind: number) => kind >= 30_000 && kind < 40_000

const addressOf = (event: NostrEvent) =>
  `${event.kind}:${event.pubkey}:${getNostrTag(event, "d") ?? ""}`

const isNewer = (candidate: NostrEvent, stored: NostrEvent) =>
  candidate.created_at > stored.created_at ||
  (candidate.created_at === stored.created_at && candidate.id < stored.id)

interface OpenRequest {
  readonly subscriptionId: string
  readonly filters: ReadonlyArray<NostrFilter>
  readonly push: (event: NostrEvent) => void
}

export const createFakeNostrRelay = () => {
  const regular = new Map<string, NostrEvent>()
  const addressable = new Map<string, NostrEvent>()
  const received: NostrEvent[] = []
  const openRequests = new Map<symbol, OpenRequest>()
  const openSockets = new Set<NostrSocket>()
  let isRefusing = false
  let isRefusingRequests = false

  const store = (event: NostrEvent) => {
    received.push(event)
    if (!isAddressable(event.kind)) {
      regular.set(event.id, event)
    } else {
      const stored = addressable.get(addressOf(event))
      if (stored !== undefined && !isNewer(event, stored)) return
      addressable.set(addressOf(event), event)
    }
    for (const request of openRequests.values()) {
      if (request.filters.some((filter) => matchesNostrFilter(event, filter))) {
        request.push(event)
      }
    }
  }

  const events = () => [...regular.values(), ...addressable.values()]

  const createSocket = (): NostrSocket => {
    const listeners = new Map<
      string,
      Array<(event: { data?: unknown }) => void>
    >()
    const emit = (type: string, data?: unknown) => {
      for (const listener of listeners.get(type) ?? []) listener({ data })
    }
    const socketRequest = Symbol("request")
    let isOpen = true
    queueMicrotask(() => emit("open"))

    const socket: NostrSocket = {
      addEventListener: (type, listener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener])
      },
      close: () => {
        if (!isOpen) return
        isOpen = false
        openRequests.delete(socketRequest)
        openSockets.delete(socket)
        emit("close")
      },
      send: (data) => {
        const [type, ...rest] = JSON.parse(data) as [string, ...unknown[]]
        queueMicrotask(() => {
          if (!isOpen) return
          if (type === "EVENT") {
            const event = rest[0] as NostrEvent
            if (isRefusing) {
              emit(
                "message",
                JSON.stringify(["OK", event.id, false, "blocked: refused"])
              )
              return
            }
            store(event)
            emit("message", JSON.stringify(["OK", event.id, true, ""]))
          }
          if (type === "CLOSE") {
            if (openRequests.get(socketRequest)?.subscriptionId === rest[0]) {
              openRequests.delete(socketRequest)
            }
          }
          if (type === "REQ") {
            const [subscriptionId, ...filters] = rest as [
              string,
              ...NostrFilter[],
            ]
            if (isRefusingRequests) {
              emit(
                "message",
                JSON.stringify(["CLOSED", subscriptionId, "blocked: refused"])
              )
              return
            }
            const found = events()
              .filter((event) =>
                filters.some((filter) => matchesNostrFilter(event, filter))
              )
              .sort((left, right) => right.created_at - left.created_at)
            for (const event of found) {
              emit("message", JSON.stringify(["EVENT", subscriptionId, event]))
            }
            emit("message", JSON.stringify(["EOSE", subscriptionId]))
            openRequests.set(socketRequest, {
              subscriptionId,
              filters,
              push: (event) =>
                queueMicrotask(() =>
                  emit(
                    "message",
                    JSON.stringify(["EVENT", subscriptionId, event])
                  )
                ),
            })
          }
        })
      },
    }
    openSockets.add(socket)
    return socket
  }

  return {
    createSocket,
    events,
    received: () => [...received],
    openRequests: () => openRequests.size,
    refuseEvents: (refuse: boolean) => {
      isRefusing = refuse
    },
    refuseRequests: (refuse: boolean) => {
      isRefusingRequests = refuse
    },
    dropConnections: () => {
      for (const socket of [...openSockets]) socket.close()
    },
  }
}
