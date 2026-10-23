import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js"
import { base32nopad } from "@scure/base"
import { z } from "zod"

import {
  type NostrEvent,
  signNostrEvent,
  verifyNostrEvent,
} from "../../integrations/nostr/nostr-event.ts"
import type { NostrFilter } from "../../integrations/nostr/nostr-relay-client.ts"
import { jsonCodec } from "../../zod-utils.ts"
import type { CatalogCategoryRow } from "../catalog-category/catalog-category.ts"
import type { CatalogItemRow } from "../catalog-item/catalog-item.ts"
import { FiatCurrencySchema, HexSchema } from "../shared/schema.ts"
import {
  createSelfPaySelectionNonce,
  deriveSelfPayPointerKeys,
} from "../table-self-pay/table-self-pay-pointer-utils.ts"
import type { SelfPayPointer } from "../table-self-pay/table-self-pay-reference-utils.ts"
import {
  decryptSelfPayContent,
  deriveSelfPayLivenessTag,
  deriveSelfPayViewTag,
  encryptSelfPayContent,
  SELF_PAY_VIEW_KIND,
} from "../table-self-pay/table-self-pay-view-utils.ts"

export const MAX_ORDER_NOTE_LENGTH = 140
export const MAX_ORDER_QUANTITY = 99

const MENU_ITEM_KEY_BYTES = 5
const MENU_VERSION_BYTES = 16
const MAX_ORDER_LINES = 100
const MENU_CONTENT_BUDGET = 60 * 1024
const MENU_EXPIRATION_SECONDS = 30 * 24 * 60 * 60
const CONFIRMATION_EXPIRATION_SECONDS = 24 * 60 * 60
const CONFIRMATION_TAG_LENGTH = 16

const AmountSchema = z.number().int().nonnegative()
const MenuItemKeySchema = z.string().regex(/^[A-Z2-7]{8}$/u)

export const SelfPayMenuSchema = z.object({
  v: z.literal(1),
  version: HexSchema(MENU_VERSION_BYTES),
  currency: FiatCurrencySchema,
  categories: z.array(
    z.object({
      name: z.string().nullable(),
      items: z.array(
        z.object({
          key: MenuItemKeySchema,
          name: z.string(),
          description: z.string().nullable(),
          unitAmount: AmountSchema,
        })
      ),
    })
  ),
})
export type SelfPayMenu = z.output<typeof SelfPayMenuSchema>
export type SelfPayMenuItem = SelfPayMenu["categories"][number]["items"][number]

export const SelfPayOrderSelectionSchema = z.object({
  v: z.literal(1),
  kind: z.literal("order"),
  nonce: HexSchema(16),
  table: HexSchema(32),
  menu: HexSchema(MENU_VERSION_BYTES),
  items: z
    .array(
      z.object({
        key: MenuItemKeySchema,
        quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY),
      })
    )
    .min(1)
    .max(MAX_ORDER_LINES)
    .refine(
      (items) => new Set(items.map(({ key }) => key)).size === items.length
    )
    .readonly(),
  note: z.string().min(1).max(MAX_ORDER_NOTE_LENGTH).nullable(),
})
export type SelfPayOrderSelection = z.output<typeof SelfPayOrderSelectionSchema>

export const SelfPayOrderConfirmationSchema = z.object({
  v: z.literal(1),
  number: z.number().int().positive(),
  total: AmountSchema,
  covered: AmountSchema,
  at: z.number().int().nonnegative(),
})
export type SelfPayOrderConfirmation = z.output<
  typeof SelfPayOrderConfirmationSchema
>

export const MenuJson = jsonCodec(SelfPayMenuSchema)

export const deriveSelfPayMenuItemKey = (catalogItemId: string): string =>
  base32nopad.encode(
    sha256(utf8ToBytes(`menu-item:${catalogItemId}`)).slice(
      0,
      MENU_ITEM_KEY_BYTES
    )
  )

const deriveMenuVersion = (
  currency: SelfPayMenu["currency"],
  categories: SelfPayMenu["categories"]
) =>
  bytesToHex(
    sha256(utf8ToBytes(JSON.stringify([currency, categories]))).slice(
      0,
      MENU_VERSION_BYTES
    )
  )

const createMenu = (
  currency: SelfPayMenu["currency"],
  categories: SelfPayMenu["categories"]
): SelfPayMenu => ({
  v: 1,
  version: deriveMenuVersion(currency, categories),
  currency,
  categories,
})

export const isOfferedInMenu = (
  item: Pick<CatalogItemRow, "inMenu" | "soldOut">
): boolean => item.inMenu !== null && item.soldOut === null

export const buildSelfPayMenu = ({
  items,
  categories,
  currency,
}: {
  readonly items: ReadonlyArray<CatalogItemRow>
  readonly categories: ReadonlyArray<CatalogCategoryRow>
  readonly currency: SelfPayMenu["currency"]
}): SelfPayMenu => {
  const offered = items.filter(
    (item) => isOfferedInMenu(item) && item.currency === currency
  )
  const toMenuItem = (item: CatalogItemRow): SelfPayMenuItem => ({
    key: deriveSelfPayMenuItemKey(item.id),
    name: item.name,
    description: item.description,
    unitAmount: item.unitAmount,
  })
  const inCategories = categories.flatMap((category) => {
    const categoryItems = offered.filter(
      ({ categoryId }) => categoryId === category.id
    )
    return categoryItems.length === 0
      ? []
      : [{ name: category.name, items: categoryItems.map(toMenuItem) }]
  })
  const categoryIds = new Set(categories.map(({ id }) => id))
  const uncategorized = offered.filter(
    ({ categoryId }) => categoryId === null || !categoryIds.has(categoryId)
  )
  return createMenu(currency, [
    ...inCategories,
    ...(uncategorized.length === 0
      ? []
      : [{ name: null, items: uncategorized.map(toMenuItem) }]),
  ])
}

export const countSelfPayMenuItems = (menu: SelfPayMenu): number =>
  menu.categories.reduce((count, { items }) => count + items.length, 0)

const takeMenuItems = (
  categories: SelfPayMenu["categories"],
  count: number
): SelfPayMenu["categories"] => {
  let left = count
  return categories.flatMap((category) => {
    const items = category.items.slice(0, left)
    left -= items.length
    return items.length === 0 ? [] : [{ ...category, items }]
  })
}

export const fitSelfPayMenuIntoEvent = (menu: SelfPayMenu): SelfPayMenu => {
  const withItems = (count: number) =>
    createMenu(menu.currency, takeMenuItems(menu.categories, count))
  const fits = (candidate: SelfPayMenu) =>
    encryptSelfPayContent(new Uint8Array(32), z.encode(MenuJson, candidate))
      .length <= MENU_CONTENT_BUDGET
  if (fits(menu)) return menu
  let fitting = 0
  let tooMany = countSelfPayMenuItems(menu)
  while (tooMany - fitting > 1) {
    const middle = Math.floor((fitting + tooMany) / 2)
    if (fits(withItems(middle))) {
      fitting = middle
    } else {
      tooMany = middle
    }
  }
  return withItems(fitting)
}

export const findSelfPayMenuItem = (
  menu: SelfPayMenu,
  key: string
): SelfPayMenuItem | null =>
  menu.categories
    .flatMap(({ items }) => items)
    .find((item) => item.key === key) ?? null

export const priceSelfPayOrder = (
  menu: SelfPayMenu,
  items: SelfPayOrderSelection["items"]
): {
  readonly lines: ReadonlyArray<{
    readonly item: SelfPayMenuItem
    readonly quantity: number
    readonly totalAmount: number
  }>
  readonly total: number
} | null => {
  const lines = items.map(({ key, quantity }) => {
    const item = findSelfPayMenuItem(menu, key)
    return item === null
      ? null
      : { item, quantity, totalAmount: item.unitAmount * quantity }
  })
  if (lines.some((line) => line === null)) return null
  const priced = lines.filter((line) => line !== null)
  return {
    lines: priced,
    total: priced.reduce((sum, { totalAmount }) => sum + totalAmount, 0),
  }
}

export const createSelfPayOrderSelectionText = ({
  tablePublicKey,
  menu,
  items,
  note,
}: {
  readonly tablePublicKey: string
  readonly menu: Pick<SelfPayMenu, "version">
  readonly items: SelfPayOrderSelection["items"]
  readonly note: string | null
}): string =>
  JSON.stringify({
    v: 1,
    kind: "order",
    nonce: createSelfPaySelectionNonce(),
    table: tablePublicKey,
    menu: menu.version,
    items,
    note,
  } satisfies SelfPayOrderSelection)

export const createSelfPayMenuFilter = ({
  publicKey,
  readKey,
}: {
  readonly publicKey: string
  readonly readKey: Uint8Array
}): NostrFilter => ({
  kinds: [SELF_PAY_VIEW_KIND],
  authors: [publicKey],
  "#d": [deriveSelfPayViewTag(readKey), deriveSelfPayLivenessTag(readKey)],
})

export const createSelfPayMenuEvent = ({
  signingKey,
  readKey,
  menu,
  createdAt,
}: {
  readonly signingKey: Uint8Array
  readonly readKey: Uint8Array
  readonly menu: SelfPayMenu
  readonly createdAt: number
}): NostrEvent =>
  signNostrEvent(signingKey, {
    created_at: createdAt,
    kind: SELF_PAY_VIEW_KIND,
    tags: [
      ["d", deriveSelfPayViewTag(readKey)],
      ["expiration", String(createdAt + MENU_EXPIRATION_SECONDS)],
    ],
    content: encryptSelfPayContent(readKey, z.encode(MenuJson, menu)),
  })

export const deriveSelfPayOrderConfirmationTag = (
  pointer: SelfPayPointer,
  selectionKey: Uint8Array
): string =>
  base32nopad
    .encode(
      sha256(
        concatBytes(
          utf8ToBytes("payky/order-confirm/v1\0"),
          deriveSelfPayPointerKeys(pointer, selectionKey).seed
        )
      )
    )
    .slice(0, CONFIRMATION_TAG_LENGTH)

export const createSelfPayOrderConfirmationEvent = ({
  menuSigningKey,
  pointer,
  selectionKey,
  confirmation,
  createdAt,
}: {
  readonly menuSigningKey: Uint8Array
  readonly pointer: SelfPayPointer
  readonly selectionKey: Uint8Array
  readonly confirmation: SelfPayOrderConfirmation
  readonly createdAt: number
}): NostrEvent =>
  signNostrEvent(menuSigningKey, {
    created_at: createdAt,
    kind: SELF_PAY_VIEW_KIND,
    tags: [
      ["d", deriveSelfPayOrderConfirmationTag(pointer, selectionKey)],
      ["expiration", String(createdAt + CONFIRMATION_EXPIRATION_SECONDS)],
    ],
    content: encryptSelfPayContent(
      deriveSelfPayPointerKeys(pointer, selectionKey).readKey,
      JSON.stringify(confirmation)
    ),
  })

export const createSelfPayOrderConfirmationFilter = ({
  menuPublicKey,
  pointer,
  selectionKey,
}: {
  readonly menuPublicKey: string
  readonly pointer: SelfPayPointer
  readonly selectionKey: Uint8Array
}): NostrFilter => ({
  kinds: [SELF_PAY_VIEW_KIND],
  authors: [menuPublicKey],
  "#d": [deriveSelfPayOrderConfirmationTag(pointer, selectionKey)],
})

export const openSelfPayOrderConfirmation = ({
  events,
  menuPublicKey,
  pointer,
  selectionKey,
}: {
  readonly events: ReadonlyArray<NostrEvent>
  readonly menuPublicKey: string
  readonly pointer: SelfPayPointer
  readonly selectionKey: Uint8Array
}): SelfPayOrderConfirmation | null => {
  const { readKey } = deriveSelfPayPointerKeys(pointer, selectionKey)
  const newestFirst = events
    .filter(
      (event) => event.pubkey === menuPublicKey && verifyNostrEvent(event)
    )
    .sort((left, right) => right.created_at - left.created_at)
  for (const event of newestFirst) {
    const text = decryptSelfPayContent(readKey, event.content)
    if (text === null) continue
    const parsed = z.safeDecode(jsonCodec(SelfPayOrderConfirmationSchema), text)
    if (parsed.success) return parsed.data
  }
  return null
}
