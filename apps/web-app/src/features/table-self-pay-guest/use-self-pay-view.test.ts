import type { NostrEvent } from "@payky/core/integrations/nostr/nostr-event"
import type { NostrRelayClient } from "@payky/core/integrations/nostr/nostr-relay-client"
import {
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
} from "@payky/core/modules/shared/key-derivation"
import {
  deriveSelfPayPointerHash,
  SelfPayPointerSchema,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { selfPayTestMasterKey } from "@payky/core/modules/table-self-pay/table-self-pay-test-fixtures"
import {
  createSelfPayLivenessEvent,
  createSelfPayViewEvent,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const keys = deriveTableSelfPayKeys(
  deriveTableSelfPayRoot(selfPayTestMasterKey),
  "table-3",
  0
)
const pointer = SelfPayPointerSchema.decode("K7QF2MX4TB3QAWZR5HLCE6DN3PJ4YV2G")

const viewConfirming = (
  confirmed: typeof pointer,
  version = Math.floor(Date.now() / 1000)
): NostrEvent =>
  createSelfPayViewEvent({
    signingKey: keys.signingKey,
    viewKey: keys.viewKey,
    view: {
      v: 1,
      table: "Table 3",
      enabled: true,
      payee: null,
      bank: null,
      lightning: null,
      selectionKey: null,
      menu: null,
      bills: [],
      confirmations: [
        {
          pointerHash: deriveSelfPayPointerHash(confirmed),
          amount: 275,
          currency: "CZK",
          at: Math.floor(Date.now() / 1000),
        },
      ],
    },
    version,
  })

const observeSelfPayView = async (
  answer: () => ReadonlyArray<NostrEvent>,
  { isLive = false }: { readonly isLive?: boolean } = {}
) => {
  vi.stubGlobal("window", {})
  vi.useFakeTimers()
  const { focusManager, QueryClient, QueryObserver } = await import(
    "@tanstack/react-query"
  )
  const { listenToSelfPayView, selfPayViewQueryOptions } = await import(
    "./use-self-pay-view.ts"
  )
  const { createGuestLiveRelays } = await import("./guest-live-relays.ts")
  const queryClient = new QueryClient()
  queryClient.mount()
  let queries = 0
  let subscribed: Parameters<NostrRelayClient["subscribe"]>[2] | null = null
  const relays: NostrRelayClient = {
    publish: async () => [],
    query: async () => {
      queries++
      return answer()
    },
    subscribe: (_relays, _filters, listener) => {
      subscribed = listener
      return {
        update: () => undefined,
        close: () => {
          subscribed = null
        },
      }
    },
  }
  const address = { ...keys, relays: [] }
  const optionsWhile = (live: boolean) =>
    selfPayViewQueryOptions({ address, queryClient, relays, isLive: live })
  const observer = new QueryObserver(queryClient, optionsWhile(isLive))
  const unsubscribe = observer.subscribe(() => undefined)
  const stopListening = listenToSelfPayView({
    address,
    queryClient,
    liveRelays: createGuestLiveRelays(relays),
  })
  await vi.advanceTimersByTimeAsync(0)
  return {
    focusManager,
    queries: () => queries,
    isSubscribed: () => subscribed !== null,
    push: (event: NostrEvent) => subscribed?.onEvent(event),
    setLive: (live: boolean) => observer.setOptions(optionsWhile(live)),
    shownView: () => observer.getCurrentResult().data?.view,
    stop: () => {
      stopListening()
      unsubscribe()
      queryClient.unmount()
    },
  }
}

test("stops polling and listening while the page is hidden and resumes both on return", async () => {
  const page = await observeSelfPayView(() => [])

  await vi.advanceTimersByTimeAsync(31_000)
  const whileVisible = page.queries()
  page.focusManager.setFocused(false)
  await vi.advanceTimersByTimeAsync(60_000)
  const whileHidden = page.queries() - whileVisible
  const isSubscribedWhileHidden = page.isSubscribed()
  page.focusManager.setFocused(true)
  await vi.advanceTimersByTimeAsync(0)
  const isSubscribedOnReturn = page.isSubscribed()
  page.stop()

  expect(whileVisible).toBe(7)
  expect(whileHidden).toBe(0)
  expect(isSubscribedWhileHidden).toBe(false)
  expect(page.queries()).toBe(8)
  expect(isSubscribedOnReturn).toBe(true)
})

test("asks every 30 s while a relay subscription is live and every 5 s without one", async () => {
  const page = await observeSelfPayView(() => [], { isLive: true })

  await vi.advanceTimersByTimeAsync(61_000)
  const whileLive = page.queries()
  page.setLive(false)
  await vi.advanceTimersByTimeAsync(30_000)
  page.stop()

  expect(whileLive).toBe(3)
  expect(page.queries() - whileLive).toBe(6)
})

test("shows a view the subscription pushes without asking the relays", async () => {
  const page = await observeSelfPayView(() => [], { isLive: true })
  const asked = page.queries()

  const pushed = viewConfirming(pointer)
  page.push(pushed)
  await vi.advanceTimersByTimeAsync(0)
  page.stop()

  expect(page.shownView()?.createdAt).toBe(pushed.created_at)
  expect(page.queries()).toBe(asked)
})

test("asks the relays once more before it shows a view older than the one confirmed", async () => {
  const version = Math.floor(Date.now() / 1000)
  const confirmation = createSelfPayLivenessEvent({
    signingKey: keys.signingKey,
    viewKey: keys.viewKey,
    liveness: { v: 1, viewVersion: version, rates: [] },
    now: version,
  })
  let answers = 0
  const page = await observeSelfPayView(() => {
    answers++
    const view = viewConfirming(pointer, answers === 1 ? version - 60 : version)
    return [view, confirmation]
  })

  page.stop()

  expect(page.queries()).toBe(2)
  expect(page.shownView()?.createdAt).toBe(version)
})
