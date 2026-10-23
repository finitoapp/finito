import { bytesToHex } from "@noble/hashes/utils.js"
import type { NostrEvent } from "@payky/core/integrations/nostr/nostr-event"
import {
  createNostrRelayClient,
  type NostrRelayClient,
} from "@payky/core/integrations/nostr/nostr-relay-client"
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
