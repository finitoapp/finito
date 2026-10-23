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
  findSelfPayConfirmation,
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
import { appEnv } from "@/core/app-env.ts"

const REFRESH_INTERVAL_MS = 15_000
const PAYMENT_REFRESH_INTERVAL_MS = 5000
const PAYMENT_WAIT_MS = 10 * 60 * 1000

const guestRelays = createNostrRelayClient()

const guestRelaysOf = (address: TableSelfPayAddress) =>
  selfPayRelaysToRead(address.relays, appEnv.VITE_PAYKY_SELF_PAY_RELAYS)

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

export const selfPayViewQueryOptions = ({
  address,
  queryClient,
  relays,
  awaitedPayment,
}: {
  readonly address: TableSelfPayAddress
  readonly queryClient: QueryClient
  readonly relays: NostrRelayClient
  readonly awaitedPayment: AwaitedSelfPayPayment | null
}) => {
  const keys = { publicKey: address.publicKey, viewKey: address.viewKey }
  const queryKey = ["selfPayView", bytesToHex(keys.publicKey)]
  const fetchShownView = async (): Promise<ShownSelfPayView> => {
    const events = await relays.query(
      guestRelaysOf(address),
      createSelfPayViewFilter(keys)
    )
    const shown = queryClient.getQueryData<ShownSelfPayView>(queryKey)
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
  return queryOptions({
    queryKey,
    queryFn: async (): Promise<ShownSelfPayView> => {
      const fetched = await fetchShownView()
      return fetched.liveness !== null &&
        selfPayViewConfirmedAt(fetched.view, fetched.liveness) === null
        ? await fetchShownView()
        : fetched
    },
    refetchInterval: (query) => {
      const view = query.state.data?.view?.value
      const isAwaiting =
        awaitedPayment !== null &&
        Date.now() < paymentWaitEndsAt(awaitedPayment.startedAt) &&
        (view === undefined ||
          findSelfPayConfirmation(view, awaitedPayment.pointer) === null)
      return isAwaiting ? PAYMENT_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS
    },
  })
}

export const useSelfPayView = (
  address: TableSelfPayAddress,
  awaitedPayment: AwaitedSelfPayPayment | null
) => {
  const queryClient = useQueryClient()
  return useQuery(
    selfPayViewQueryOptions({
      address,
      queryClient,
      relays: guestRelays,
      awaitedPayment,
    })
  )
}

interface ShownSelfPayMenu {
  readonly menu: SelfPayContent<SelfPayMenu> | null
  readonly liveness: SelfPayContent<SelfPayLiveness> | null
}

export const useSelfPayMenu = (
  address: TableSelfPayAddress,
  keys: NonNullable<SelfPayView["menu"]>
) => {
  const queryClient = useQueryClient()
  const queryKey = ["selfPayMenu", keys.publicKey]
  return useQuery({
    queryKey,
    queryFn: async (): Promise<ShownSelfPayMenu> => {
      const publicKey = hexToBytes(keys.publicKey)
      const readKey = hexToBytes(keys.readKey)
      const events = await guestRelays.query(
        guestRelaysOf(address),
        createSelfPayMenuFilter({ publicKey: keys.publicKey, readKey })
      )
      const shown = queryClient.getQueryData<ShownSelfPayMenu>(queryKey)
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
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  })
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
  return useQueries({
    queries: orders.map(({ pointer, startedAt }) => {
      const queryKey = ["selfPayOrderConfirmation", pointer]
      return queryOptions({
        queryKey,
        queryFn:
          async (): Promise<SelfPayContent<SelfPayOrderConfirmation> | null> => {
            const lookup = {
              menuPublicKey,
              pointer,
              selectionKey: hexToBytes(selectionKey),
            }
            const events = await guestRelays.query(
              guestRelaysOf(address),
              createSelfPayOrderConfirmationFilter(lookup)
            )
            const confirmation = openSelfPayOrderConfirmation({
              events,
              ...lookup,
            })
            return keepNewerSelfPayContent(
              queryClient.getQueryData<SelfPayContent<SelfPayOrderConfirmation> | null>(
                queryKey
              ) ?? null,
              confirmation === null
                ? null
                : { value: confirmation, createdAt: confirmation.at }
            )
          },
        refetchInterval: (query) => {
          const confirmation = query.state.data?.value
          if (
            confirmation !== undefined &&
            confirmation.covered >= confirmation.total
          )
            return false
          return Date.now() < paymentWaitEndsAt(startedAt)
            ? PAYMENT_REFRESH_INTERVAL_MS
            : REFRESH_INTERVAL_MS
        },
      })
    }),
  })
}
