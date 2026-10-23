import { bytesToHex } from "@noble/hashes/utils.js"
import { describe, expect, test } from "vitest"

import type { CatalogItemRow } from "../catalog-item/catalog-item.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import {
  deriveSelfPayMenuKeys,
  deriveTableSelfPayRoot,
  MasterKey,
} from "../shared/key-derivation.ts"
import { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
import { pickNewestSelfPayContent } from "../table-self-pay/table-self-pay-guest-utils.ts"
import { deriveSelfPayViewTag } from "../table-self-pay/table-self-pay-view-utils.ts"
import {
  buildSelfPayMenu,
  countSelfPayMenuItems,
  createSelfPayMenuEvent,
  deriveSelfPayMenuItemKey,
  fitSelfPayMenuIntoEvent,
  priceSelfPayOrder,
  SelfPayMenuSchema,
} from "./menu-order-utils.ts"

const item = (
  id: string,
  overrides: Partial<CatalogItemRow> = {}
): CatalogItemRow => ({
  id: id as CatalogItemId,
  deviceId: null,
  categoryId: null,
  name: NonEmptyString255(`Item ${id}`),
  description: null,
  internalName: null,
  internalDescription: null,
  sku: null,
  currency: "CZK",
  unitAmount: NonNegativeInteger(6500),
  sortOrder: NonNegativeInteger(0),
  scanCode: null,
  taxRateId: null,
  inMenu: 1,
  soldOut: null,
  ...overrides,
})

const menuOf = (items: ReadonlyArray<CatalogItemRow>) =>
  buildSelfPayMenu({ items, categories: [], currency: "CZK" })

describe("the menu", () => {
  test("leaves out an item nobody put in the menu, and one in another currency", () => {
    const menu = menuOf([
      item("coffee"),
      item("new", { inMenu: null }),
      item("euro", { currency: "EUR" }),
    ])

    expect(countSelfPayMenuItems(menu)).toBe(1)
  })

  test("keeps the items that fit one event, in catalog order", () => {
    const items = Array.from({ length: 2000 }, (_, index) =>
      item(`item-${index}`, {
        name: NonEmptyString255(
          `A long dish name number ${index}`.padEnd(120, "x")
        ),
        description: NonEmptyString255("y".repeat(200)),
      })
    )
    const full = menuOf(items)
    const fitted = fitSelfPayMenuIntoEvent(full)

    expect(countSelfPayMenuItems(fitted)).toBeGreaterThan(0)
    expect(countSelfPayMenuItems(fitted)).toBeLessThan(
      countSelfPayMenuItems(full)
    )
    expect(fitted.categories[0]?.items[0]?.name).toBe(
      full.categories[0]?.items[0]?.name
    )
  })

  test("is ignored when another key signed it", () => {
    const keys = deriveSelfPayMenuKeys(
      deriveTableSelfPayRoot(MasterKey("000102030405060708090a0b0c0d0e0f"))
    )
    const forger = deriveSelfPayMenuKeys(
      crypto.getRandomValues(new Uint8Array(32))
    )
    const forged = createSelfPayMenuEvent({
      signingKey: forger.signingKey,
      readKey: keys.readKey,
      menu: menuOf([item("coffee")]),
      createdAt: 2,
    })

    expect(
      pickNewestSelfPayContent({
        events: [forged],
        publicKey: keys.publicKey,
        viewKey: keys.readKey,
        tag: deriveSelfPayViewTag(keys.readKey),
        schema: SelfPayMenuSchema,
      })
    ).toBe(null)
    expect(bytesToHex(forger.publicKey)).not.toBe(bytesToHex(keys.publicKey))
  })
})

describe("pricing an order", () => {
  test("prices each item at the menu's price", () => {
    const menu = menuOf([
      item("coffee"),
      item("cake", { unitAmount: NonNegativeInteger(8900) }),
    ])

    expect(
      priceSelfPayOrder(menu, [
        { key: deriveSelfPayMenuItemKey("coffee"), quantity: 2 },
        { key: deriveSelfPayMenuItemKey("cake"), quantity: 1 },
      ])?.total
    ).toBe(21_900)
  })

  test("prices nothing when an item is not in that menu", () => {
    const menu = menuOf([item("coffee")])

    expect(
      priceSelfPayOrder(menu, [
        { key: deriveSelfPayMenuItemKey("goulash"), quantity: 1 },
      ])
    ).toBe(null)
  })
})
