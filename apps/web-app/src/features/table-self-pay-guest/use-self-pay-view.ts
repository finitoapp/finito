import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import type { NostrEvent } from "@payky/core/integrations/nostr/nostr-event"
import {
  createNostrRelayClient,
  type NostrRelayClient,
} from "@payky/core/integrations/nostr/nostr-relay-client"
import {
  createSelfPayMenuFilter,
  createSelfPayOrderConfirmationFilter,
  openSelfPayOrderConfirmation,
  type SelfPayMenu,
  SelfPayMenuSchema,
  type SelfPayOrderConfirmation,
} from "@payky/core/modules/menu-order/menu-order-utils"
import type { TableSelfPayAddress } from "@payky/core/modules/table-self-pay/table-self-pay-address-utils"
import {
  createSelfPayViewFilter,
  keepNewerSelfPayContent,
  pickNewestSelfPayContent,
  publishSelfPaySelection,
  type SelfPayContent,
  selfPayViewConfirmedAt,
} from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import type { SelfPayPointer } from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { selfPayRelaysToRead } from "@payky/core/modules/table-self-pay/table-self-pay-relay-utils"
import {
  deriveSelfPayLivenessTag,
  deriveSelfPayViewTag,
  type SelfPayLiveness,
  SelfPayLivenessSchema,
  type SelfPayView,
  SelfPayViewSchema,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import {
  type QueryClient,
  queryOptions,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useSyncExternalStore } from "react"
import { appEnv } from "@/core/app-env.ts"
import {
  createGuestLiveRelays,
  type GuestLiveRelays,
} from "./guest-live-relays.ts"
import { ORDER_SHOWN_FOR_MS } from "./guest-orders.ts"

const REFRESH_INTERVAL_MS = 5000
const LIVE_REFRESH_INTERVAL_MS = 30_000
const PAYMENT_WAIT_MS = 10 * 60 * 1000

const guestRelays = createNostrRelayClient()
const guestLiveRelays = createGuestLiveRelays(guestRelays)

const guestRelaysOf = (address: TableSelfPayAddress) =>
  selfPayRelaysToRead(address.relays, appEnv.VITE_PAYKY_SELF_PAY_RELAYS)

const refreshIntervalOf = (isLive: boolean): number =>
  isLive ? LIVE_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS

const useGuestRelaysLive = (): boolean =>
  useSyncExternalStore(guestLiveRelays.watchLive, guestLiveRelays.isLive)

export const publishGuestSelection = (
  address: TableSelfPayAddress,
  event: NostrEvent
): Promise<boolean> =>
  publishSelfPaySelection({
    relayClient: guestRelays,
    relays: guestRelaysOf(address),
    event,
  })

export const paymentWaitEndsAt = (startedAt: number): number =>
  startedAt + PAYMENT_WAIT_MS

export interface AwaitedSelfPayPayment {
  readonly pointer: SelfPayPointer
  readonly startedAt: number
}

interface ShownSelfPayView {
  readonly view: SelfPayContent<SelfPayView> | null
  readonly liveness: SelfPayContent<SelfPayLiveness> | null
}

const selfPayViewKeysOf = (address: TableSelfPayAddress) => ({
  publicKey: address.publicKey,
  viewKey: address.viewKey,
})

const selfPayViewQueryKeyOf = (address: TableSelfPayAddress) => [
  "selfPayView",
  bytesToHex(address.publicKey),
]

const readShownView = (
  address: TableSelfPayAddress,
  shown: ShownSelfPayView | undefined,
  events: ReadonlyArray<NostrEvent>
): ShownSelfPayView => {
  const keys = selfPayViewKeysOf(address)
  return {
    view: keepNewerSelfPayContent(
      shown?.view ?? null,
      pickNewestSelfPayContent({
        ...keys,
        events,
        tag: deriveSelfPayViewTag(keys.viewKey),
        schema: SelfPayViewSchema,
      })
    ),
    liveness: keepNewerSelfPayContent(
      shown?.liveness ?? null,
      pickNewestSelfPayContent({
        ...keys,
        events,
        tag: deriveSelfPayLivenessTag(keys.viewKey),
        schema: SelfPayLivenessSchema,
      })
    ),
  }
}

export const selfPayViewQueryOptions = ({
  address,
  queryClient,
  relays,
  isLive,
}: {
  readonly address: TableSelfPayAddress
  readonly queryClient: QueryClient
  readonly relays: NostrRelayClient
  readonly isLive: boolean
}) => {
  const queryKey = selfPayViewQueryKeyOf(address)
  const fetchShownView = async (): Promise<ShownSelfPayView> => {
    const events = await relays.query(
      guestRelaysOf(address),
      createSelfPayViewFilter(selfPayViewKeysOf(address))
    )
    return readShownView(
      address,
      queryClient.getQueryData<ShownSelfPayView>(queryKey),
      events
    )
  }
  return queryOptions({
    queryKey,
    queryFn: async (): Promise<ShownSelfPayView> => {
      const fetched = await fetchShownView()
      return fetched.liveness !== null &&
        selfPayViewConfirmedAt(fetched.view, fetched.liveness) === null
        ? await fetchShownView()
        : fetched
    },
    refetchInterval: refreshIntervalOf(isLive),
  })
}

export const listenToSelfPayView = ({
  address,
  queryClient,
  liveRelays,
}: {
  readonly address: TableSelfPayAddress
  readonly queryClient: QueryClient
  readonly liveRelays: GuestLiveRelays
}): (() => void) =>
  liveRelays.listen({
    relays: guestRelaysOf(address),
    filters: [createSelfPayViewFilter(selfPayViewKeysOf(address))],
    onEvent: (event) =>
      queryClient.setQueryData<ShownSelfPayView>(
        selfPayViewQueryKeyOf(address),
        (shown) => readShownView(address, shown, [event])
      ),
  })

export const useSelfPayView = (address: TableSelfPayAddress) => {
  const queryClient = useQueryClient()
  const isLive = useGuestRelaysLive()
  useEffect(
    () =>
      listenToSelfPayView({
        address,
        queryClient,
        liveRelays: guestLiveRelays,
      }),
    [address, queryClient]
  )
  return useQuery(
    selfPayViewQueryOptions({
      address,
      queryClient,
      relays: guestRelays,
      isLive,
    })
  )
}

interface ShownSelfPayMenu {
  readonly menu: SelfPayContent<SelfPayMenu> | null
  readonly liveness: SelfPayContent<SelfPayLiveness> | null
}

const readShownMenu = (
  keys: NonNullable<SelfPayView["menu"]>,
  shown: ShownSelfPayMenu | undefined,
  events: ReadonlyArray<NostrEvent>
): ShownSelfPayMenu => {
  const publicKey = hexToBytes(keys.publicKey)
  const readKey = hexToBytes(keys.readKey)
  return {
    menu: keepNewerSelfPayContent(
      shown?.menu ?? null,
      pickNewestSelfPayContent({
        events,
        publicKey,
        viewKey: readKey,
        tag: deriveSelfPayViewTag(readKey),
        schema: SelfPayMenuSchema,
      })
    ),
    liveness: keepNewerSelfPayContent(
      shown?.liveness ?? null,
      pickNewestSelfPayContent({
        events,
        publicKey,
        viewKey: readKey,
        tag: deriveSelfPayLivenessTag(readKey),
        schema: SelfPayLivenessSchema,
      })
    ),
  }
}

export const useSelfPayMenu = (
  address: TableSelfPayAddress,
  keys: NonNullable<SelfPayView["menu"]>
) => {
  const queryClient = useQueryClient()
  const isLive = useGuestRelaysLive()
  const { publicKey, readKey } = keys
  useEffect(
    () =>
      guestLiveRelays.listen({
        relays: guestRelaysOf(address),
        filters: [
          createSelfPayMenuFilter({ publicKey, readKey: hexToBytes(readKey) }),
        ],
        onEvent: (event) =>
          queryClient.setQueryData<ShownSelfPayMenu>(
            ["selfPayMenu", publicKey],
            (shown) => readShownMenu({ publicKey, readKey }, shown, [event])
          ),
      }),
    [address, publicKey, readKey, queryClient]
  )
  const queryKey = ["selfPayMenu", publicKey]
  return useQuery({
    queryKey,
    queryFn: async (): Promise<ShownSelfPayMenu> => {
      const events = await guestRelays.query(
        guestRelaysOf(address),
        createSelfPayMenuFilter({ publicKey, readKey: hexToBytes(readKey) })
      )
      return readShownMenu(
        { publicKey, readKey },
        queryClient.getQueryData<ShownSelfPayMenu>(queryKey),
        events
      )
    },
    refetchInterval: refreshIntervalOf(isLive),
  })
}

type ShownOrderConfirmation = SelfPayContent<SelfPayOrderConfirmation> | null

interface OrderConfirmationLookup {
  readonly menuPublicKey: string
  readonly pointer: SelfPayPointer
  readonly selectionKey: Uint8Array
}

const readOrderConfirmation = (
  lookup: OrderConfirmationLookup,
  shown: ShownOrderConfirmation | undefined,
  events: ReadonlyArray<NostrEvent>
): ShownOrderConfirmation => {
  const confirmation = openSelfPayOrderConfirmation({ events, ...lookup })
  return keepNewerSelfPayContent(
    shown ?? null,
    confirmation === null
      ? null
      : { value: confirmation, createdAt: confirmation.at }
  )
}

export const useGuestOrderConfirmations = ({
  address,
  menuPublicKey,
  selectionKey,
  orders,
}: {
  readonly address: TableSelfPayAddress
  readonly menuPublicKey: string
  readonly selectionKey: string
  readonly orders: ReadonlyArray<AwaitedSelfPayPayment>
}) => {
  const queryClient = useQueryClient()
  const isLive = useGuestRelaysLive()
  useEffect(() => {
    const stopListening = orders.map(({ pointer }) => {
      const lookup = {
        menuPublicKey,
        pointer,
        selectionKey: hexToBytes(selectionKey),
      }
      return guestLiveRelays.listen({
        relays: guestRelaysOf(address),
        filters: [createSelfPayOrderConfirmationFilter(lookup)],
        onEvent: (event) =>
          queryClient.setQueryData<ShownOrderConfirmation>(
            ["selfPayOrderConfirmation", pointer],
            (shown) => readOrderConfirmation(lookup, shown, [event])
          ),
      })
    })
    return () => {
      for (const stop of stopListening) stop()
    }
  }, [address, menuPublicKey, selectionKey, orders, queryClient])
  return useQueries({
    queries: orders.map(({ pointer, startedAt }) => {
      const queryKey = ["selfPayOrderConfirmation", pointer]
      return queryOptions({
        queryKey,
        queryFn: async (): Promise<ShownOrderConfirmation> => {
          const lookup = {
            menuPublicKey,
            pointer,
            selectionKey: hexToBytes(selectionKey),
          }
          const events = await guestRelays.query(
            guestRelaysOf(address),
            createSelfPayOrderConfirmationFilter(lookup)
          )
          return readOrderConfirmation(
            lookup,
            queryClient.getQueryData<ShownOrderConfirmation>(queryKey),
            events
          )
        },
        refetchInterval: (query) => {
          const confirmation = query.state.data?.value
          if (
            confirmation?.rejected !== undefined ||
            (confirmation?.served !== undefined &&
              confirmation.covered >= confirmation.total) ||
            Date.now() >= startedAt + ORDER_SHOWN_FOR_MS
          )
            return false
          return refreshIntervalOf(isLive)
        },
      })
    }),
  })
}
