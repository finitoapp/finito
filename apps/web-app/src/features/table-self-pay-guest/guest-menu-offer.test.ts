import type { SelfPayMenu } from "@payky/core/modules/menu-order/menu-order-utils"
import { IbanSchema } from "@payky/core/modules/shared/schema"
import type { SelfPayView } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { describe, expect, test } from "vitest"
import { guestOrderableMenu } from "./guest-menu-offer.ts"

const bankInCzk = {
  iban: IbanSchema.parse("CZ6508000000192000145399"),
  accountName: "Bar",
  currency: "CZK",
  qrFormat: "spayd",
} satisfies SelfPayView["bank"]

const view = (overrides: Partial<SelfPayView> = {}) =>
  ({ bank: bankInCzk, lightning: null, ...overrides }) as SelfPayView

const coffee = {
  key: "AAAAAAAA",
  name: "Coffee",
  description: null,
  unitAmount: 6500,
}

const menu = (overrides: Partial<SelfPayMenu> = {}): SelfPayMenu => ({
  v: 1,
  version: "aa".repeat(16),
  currency: "CZK",
  categories: [],
  ...overrides,
})

const inMenu = [{ name: null, items: [coffee] }]

describe("the menu the guest page offers to order from", () => {
  test("offers nothing with nothing in the menu", () => {
    expect(guestOrderableMenu(view(), menu())).toBe(null)
  })

  test("offers a menu with items the guest can pay for", () => {
    const ordering = menu({ categories: inMenu })

    expect(guestOrderableMenu(view(), ordering)).toBe(ordering)
  })

  test("offers nothing when the bank is in another currency and Lightning is not offered", () => {
    const euro = view({ bank: { ...bankInCzk, currency: "EUR" } })

    expect(guestOrderableMenu(euro, menu({ categories: inMenu }))).toBe(null)
  })

  test("offers the menu by Lightning alone", () => {
    const lightningOnly = view({
      bank: null,
      lightning: { identityPublicKey: "02".repeat(33) },
    })
    const ordering = menu({ categories: inMenu })

    expect(guestOrderableMenu(lightningOnly, ordering)).toBe(ordering)
  })
})
