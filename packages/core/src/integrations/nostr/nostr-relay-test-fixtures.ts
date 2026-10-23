import { getNostrTag, type NostrEvent } from "./nostr-event.ts"
import type { NostrFilter, NostrSocket } from "./nostr-relay-client.ts"

const isAddressable = (kind: number) => kind >= 30_000 && kind < 40_000

const addressOf = (event: NostrEvent) =>
  `${event.kind}:${event.pubkey}:${getNostrTag(event, "d") ?? ""}`

const isNewer = (candidate: NostrEvent, stored: NostrEvent) =>
  candidate.created_at > stored.created_at ||
  (candidate.created_at === stored.created_at && candidate.id < stored.id)

const matches = (event: NostrEvent, filter: NostrFilter) =>
  (filter.kinds?.includes(event.kind) ?? true) &&
  (filter.authors?.includes(event.pubkey) ?? true) &&
  (filter["#d"]?.includes(getNostrTag(event, "d") ?? "") ?? true)

export const createFakeNostrRelay = () => {
  const regular = new Map<string, NostrEvent>()
  const addressable = new Map<string, NostrEvent>()
  const received: NostrEvent[] = []
  let isRefusing = false

  const store = (event: NostrEvent) => {
    received.push(event)
    if (!isAddressable(event.kind)) {
      regular.set(event.id, event)
      return
    }
    const stored = addressable.get(addressOf(event))
    if (stored === undefined || isNewer(event, stored)) {
      addressable.set(addressOf(event), event)
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
    let isOpen = true
    queueMicrotask(() => emit("open"))

    return {
      addEventListener: (type, listener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener])
      },
      close: () => {
        if (!isOpen) return
        isOpen = false
        emit("close")
      },
      send: (data) => {
        const [type, ...rest] = JSON.parse(data) as [string, ...unknown[]]
        queueMicrotask(() => {
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
          if (type === "REQ") {
            const [subscriptionId, filter] = rest as [string, NostrFilter]
            const found = events()
              .filter((event) => matches(event, filter))
              .sort((left, right) => right.created_at - left.created_at)
            for (const event of found) {
              emit("message", JSON.stringify(["EVENT", subscriptionId, event]))
            }
            emit("message", JSON.stringify(["EOSE", subscriptionId]))
          }
        })
      },
    }
  }

  return {
    createSocket,
    events,
    received: () => [...received],
    refuseEvents: (refuse: boolean) => {
      isRefusing = refuse
    },
  }
}
