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
import { createSelfPaySelectionEvent } from "../table-self-pay/table-self-pay-pointer-utils.ts"
import { deriveSelfPayViewTag } from "../table-self-pay/table-self-pay-view-utils.ts"
import {
  buildSelfPayMenu,
  countSelfPayMenuItems,
  createSelfPayMenuEvent,
  createSelfPayWrittenSelectionText,
  deriveSelfPayMenuItemKey,
  fitSelfPayMenuIntoEvent,
  isWrittenAmountInRange,
  priceSelfPayOrder,
  SelfPayMenuSchema,
  SelfPayOrderIntentSchema,
  SelfPayWrittenSelectionSchema,
  WrittenOrderTextSchema,
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
  buildSelfPayMenu({ items, categories: [], currency: "CZK", written: false })

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

describe("what a guest writes", () => {
  test.each([
    ["255 units", "x".repeat(255)],
    ["emoji and the joiner compound emoji need", "🍺🍺 a 👨‍👩‍👧"],
    ["the variation selector an emoji needs", "❤️"],
    ["a space inside", "2x pivo, párek"],
    ["markup and placeholders, as characters", "<b>pivo</b> {amount} $&"],
  ])("takes %s", (_name, text) => {
    expect(WrittenOrderTextSchema.safeParse(text).success).toBe(true)
  })

  test.each([
    ["256 units", "x".repeat(256)],
    ["128 emoji, which count as two each", "🍺".repeat(128)],
    ["nothing", ""],
    ["only spaces", "   "],
    ["a leading space", " pivo"],
    ["a trailing space", "pivo "],
    ["a line break", "pivo\nzaplaceno"],
    ["a line separator", "pivo\u2028zaplaceno"],
    ["a paragraph separator", "pivo\u2029zaplaceno"],
    ["a right-to-left override", "pivo\u202Eonevalpaz"],
    ["a zero-width space", "pi\u200Bvo"],
    ["a null character", "pivo\u0000"],
    ["only a blank letter", "\u3164"],
    ["a blank braille pattern", "pi\u2800vo"],
    ["a soft hyphen", "pi\u00ADvo"],
    ["a lone surrogate", "pivo\uD83C"],
    ["an invisible tag", "pivo\u{E0041}"],
  ])("refuses %s", (_name, text) => {
    expect(WrittenOrderTextSchema.safeParse(text).success).toBe(false)
  })

  test("names an amount from the self-pay minimum up to what a QR payment carries", () => {
    expect(isWrittenAmountInRange(99, "CZK")).toBe(false)
    expect(isWrittenAmountInRange(100, "CZK")).toBe(true)
    expect(isWrittenAmountInRange(999_999_999, "CZK")).toBe(true)
    expect(isWrittenAmountInRange(1_000_000_000, "CZK")).toBe(false)
  })

  const selectionText = (text: string, amount: number) =>
    createSelfPayWrittenSelectionText({
      tablePublicKey: "aa".repeat(32),
      menu: { version: "bb".repeat(16) },
      text,
      amount,
    })

  test("reads as a written order, and an order's reader refuses nothing else", () => {
    const parsed = SelfPayOrderIntentSchema.parse(
      JSON.parse(selectionText("2x pivo", 9000))
    )

    expect(parsed).toMatchObject({
      kind: "written",
      text: "2x pivo",
      amount: 9000,
    })
  })

  test.each([
    ["no amount", 0],
    ["an amount that is not whole", 90.5],
    ["more than a QR payment carries", 1_000_000_000],
  ])("does not read a selection with %s", (_name, amount) => {
    expect(
      SelfPayWrittenSelectionSchema.safeParse(
        JSON.parse(selectionText("2x pivo", amount))
      ).success
    ).toBe(false)
  })

  test("names a different pointer when one character of the text changes", () => {
    const context = {
      selectionKey: new Uint8Array(32),
      createdAt: 1_000_000,
    }
    const pointerOf = (selectionText: string) =>
      createSelfPaySelectionEvent({ selectionText, ...context }).pointer
    const nonceless = (text: string) =>
      JSON.stringify({
        ...JSON.parse(selectionText(text, 9000)),
        nonce: "cc".repeat(16),
      })

    expect(pointerOf(nonceless("2x pivo"))).not.toBe(
      pointerOf(nonceless("3x pivo"))
    )
  })
})
