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
import type { AwaitedSelfPayPayment } from "./use-self-pay-view.ts"

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
  awaitedPayment: AwaitedSelfPayPayment | null
) => {
  vi.stubGlobal("window", {})
  vi.useFakeTimers()
  const { focusManager, QueryClient, QueryObserver } = await import(
    "@tanstack/react-query"
  )
  const { selfPayViewQueryOptions } = await import("./use-self-pay-view.ts")
  const queryClient = new QueryClient()
  queryClient.mount()
  let queries = 0
  const relays: NostrRelayClient = {
    publish: async () => [],
    query: async () => {
      queries++
      return answer()
    },
  }
  const observer = new QueryObserver(
    queryClient,
    selfPayViewQueryOptions({
      address: { ...keys, relays: [] },
      queryClient,
      relays,
      awaitedPayment,
    })
  )
  const unsubscribe = observer.subscribe(() => undefined)
  return {
    focusManager,
    queries: () => queries,
    shownView: () => observer.getCurrentResult().data?.view,
    stop: () => {
      unsubscribe()
      queryClient.unmount()
    },
  }
}

test("stops polling the relays while the page is hidden and refreshes on return", async () => {
  const page = await observeSelfPayView(() => [], null)

  await vi.advanceTimersByTimeAsync(31_000)
  const whileVisible = page.queries()
  page.focusManager.setFocused(false)
  await vi.advanceTimersByTimeAsync(60_000)
  const whileHidden = page.queries() - whileVisible
  page.focusManager.setFocused(true)
  await vi.advanceTimersByTimeAsync(0)
  page.stop()

  expect(whileVisible).toBe(3)
  expect(whileHidden).toBe(0)
  expect(page.queries()).toBe(4)
})

test("asks every 5 s while a started payment waits, and every 15 s once it is confirmed", async () => {
  let confirmed = false
  const page = await observeSelfPayView(
    () => (confirmed ? [viewConfirming(pointer)] : []),
    { pointer, startedAt: Date.now() }
  )

  await vi.advanceTimersByTimeAsync(31_000)
  const whileWaiting = page.queries()
  confirmed = true
  await vi.advanceTimersByTimeAsync(5000)
  const untilConfirmed = page.queries()
  await vi.advanceTimersByTimeAsync(60_000)
  page.stop()

  expect(whileWaiting).toBe(7)
  expect(untilConfirmed).toBe(8)
  expect(page.queries() - untilConfirmed).toBe(4)
})

test("asks every 15 s again once a payment waited 10 minutes", async () => {
  const page = await observeSelfPayView(() => [], {
    pointer,
    startedAt: Date.now(),
  })

  await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 5000)
  const afterWaiting = page.queries()
  await vi.advanceTimersByTimeAsync(60_000)
  page.stop()

  expect(page.queries() - afterWaiting).toBe(4)
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
  }, null)

  await vi.advanceTimersByTimeAsync(0)
  page.stop()

  expect(page.queries()).toBe(2)
  expect(page.shownView()?.createdAt).toBe(version)
})
