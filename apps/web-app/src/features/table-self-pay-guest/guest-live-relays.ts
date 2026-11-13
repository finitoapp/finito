import type { NostrEvent } from "@payky/core/integrations/nostr/nostr-event"
import {
  matchesNostrFilter,
  type NostrFilter,
  type NostrRelayClient,
  type NostrSubscription,
} from "@payky/core/integrations/nostr/nostr-relay-client"
import { focusManager } from "@tanstack/react-query"

interface LiveListener {
  readonly relays: ReadonlyArray<string>
  readonly filters: ReadonlyArray<NostrFilter>
  readonly onEvent: (event: NostrEvent) => void
}

export const createGuestLiveRelays = (client: NostrRelayClient) => {
  const listeners = new Set<LiveListener>()
  const liveWatchers = new Set<() => void>()
  let subscription: NostrSubscription | null = null
  let subscribedRelays = ""
  let subscribedFilters = ""
  let liveRelays = 0
  let isSyncScheduled = false
  let stopWatchingFocus: (() => void) | null = null

  const setLiveRelays = (count: number) => {
    liveRelays = count
    for (const watcher of liveWatchers) watcher()
  }

  const close = () => {
    subscription?.close()
    subscription = null
    setLiveRelays(0)
  }

  const sync = () => {
    isSyncScheduled = false
    if (listeners.size === 0) {
      stopWatchingFocus?.()
      stopWatchingFocus = null
    } else {
      stopWatchingFocus ??= focusManager.subscribe(sync)
    }
    if (listeners.size === 0 || !focusManager.isFocused()) {
      close()
      return
    }
    const relays = [
      ...new Set([...listeners].flatMap(({ relays }) => relays)),
    ].sort()
    const filters = [...listeners].flatMap(({ filters }) => filters)
    const relaysKey = JSON.stringify(relays)
    const filtersKey = JSON.stringify(filters)
    if (subscription !== null && relaysKey === subscribedRelays) {
      if (filtersKey !== subscribedFilters) subscription.update(filters)
    } else {
      close()
      subscription = client.subscribe(relays, filters, {
        onEvent: (event) => {
          for (const listener of listeners) {
            if (
              listener.filters.some((filter) =>
                matchesNostrFilter(event, filter)
              )
            )
              listener.onEvent(event)
          }
        },
        onLive: setLiveRelays,
      })
    }
    subscribedRelays = relaysKey
    subscribedFilters = filtersKey
  }

  const scheduleSync = () => {
    if (isSyncScheduled) return
    isSyncScheduled = true
    queueMicrotask(sync)
  }

  return {
    listen: (listener: LiveListener): (() => void) => {
      listeners.add(listener)
      scheduleSync()
      return () => {
        listeners.delete(listener)
        scheduleSync()
      }
    },
    isLive: (): boolean => liveRelays > 0,
    watchLive: (watcher: () => void): (() => void) => {
      liveWatchers.add(watcher)
      return () => {
        liveWatchers.delete(watcher)
      }
    },
  }
}

export type GuestLiveRelays = ReturnType<typeof createGuestLiveRelays>
