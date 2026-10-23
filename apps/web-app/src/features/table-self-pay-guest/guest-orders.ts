import { NostrEventSchema } from "@payky/core/integrations/nostr/nostr-event"
import {
  FiatCurrencySchema,
  HexSchema,
} from "@payky/core/modules/shared/schema"
import {
  type SelfPayPointer,
  SelfPayPointerSchema,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { jsonCodec } from "@payky/core/zod-utils"
import { z } from "zod"

const STORAGE_KEY = "payky.selfPay.orders"
const MAX_REMEMBERED_ORDERS = 20
const ORDER_SHOWN_FOR_MS = 24 * 60 * 60 * 1000

const GuestOrderSchema = z.object({
  pointer: SelfPayPointerSchema,
  table: HexSchema(32),
  event: NostrEventSchema,
  currency: FiatCurrencySchema,
  total: z.number().int().nonnegative(),
  summary: z.string(),
  startedAt: z.number().int().nonnegative(),
})
const GuestOrdersJson = jsonCodec(z.array(GuestOrderSchema))

export type GuestOrder = z.output<typeof GuestOrderSchema>

export const readGuestOrders = (): ReadonlyArray<GuestOrder> => {
  try {
    const parsed = z.safeDecode(
      GuestOrdersJson,
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    )
    const shownSince = Date.now() - ORDER_SHOWN_FOR_MS
    return parsed.success
      ? parsed.data.filter(({ startedAt }) => startedAt > shownSince)
      : []
  } catch {
    return []
  }
}

const storeGuestOrders = (orders: GuestOrder[]): ReadonlyArray<GuestOrder> => {
  const serialized = z.encode(GuestOrdersJson, orders)
  try {
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch {}
  return orders
}

export const rememberGuestOrder = (
  orders: ReadonlyArray<GuestOrder>,
  order: GuestOrder
): ReadonlyArray<GuestOrder> =>
  storeGuestOrders(
    [...orders.filter(({ pointer }) => pointer !== order.pointer), order].slice(
      -MAX_REMEMBERED_ORDERS
    )
  )

export const forgetGuestOrder = (
  orders: ReadonlyArray<GuestOrder>,
  pointer: SelfPayPointer
): ReadonlyArray<GuestOrder> =>
  storeGuestOrders(orders.filter((order) => order.pointer !== pointer))

export const ordersAtTable = (
  orders: ReadonlyArray<GuestOrder>,
  table: string
): ReadonlyArray<GuestOrder> => orders.filter((order) => order.table === table)
