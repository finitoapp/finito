import type { SelfPayMenu } from "@payky/core/modules/menu-order/menu-order-utils"
import { IbanSchema } from "@payky/core/modules/shared/schema"
import type { SelfPayView } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { describe, expect, test } from "vitest"
import { guestMenuOffer } from "./guest-menu-offer.ts"

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
  written: false,
  categories: [],
  ...overrides,
})

const inMenu = [{ name: null, items: [coffee] }]

describe("what the guest page offers from the menu", () => {
  test("offers nothing before writing is switched on and with nothing in the menu", () => {
    expect(guestMenuOffer(view(), menu())).toEqual({
      orderable: null,
      writable: null,
    })
  })

  test("offers only writing while writing is on alone", () => {
    const writingAlone = menu({ written: true })

    expect(guestMenuOffer(view(), writingAlone)).toEqual({
      orderable: null,
      writable: writingAlone,
    })
  })

  test("offers ordering and writing when both are on", () => {
    const both = menu({ written: true, categories: inMenu })

    expect(guestMenuOffer(view(), both)).toEqual({
      orderable: both,
      writable: both,
    })
  })

  test("offers only ordering while writing is off", () => {
    const ordering = menu({ categories: inMenu })

    expect(guestMenuOffer(view(), ordering)).toEqual({
      orderable: ordering,
      writable: null,
    })
  })

  test("offers only writing when every item in the menu is sold out", () => {
    const soldOut = menu({ written: true, categories: [] })

    expect(guestMenuOffer(view(), soldOut).writable).toBe(soldOut)
    expect(guestMenuOffer(view(), soldOut).orderable).toBe(null)
  })

  test("offers nothing when the bank is in another currency and Lightning is not offered", () => {
    const euro = view({ bank: { ...bankInCzk, currency: "EUR" } })

    expect(
      guestMenuOffer(euro, menu({ written: true, categories: inMenu }))
    ).toEqual({ orderable: null, writable: null })
  })

  test("offers writing by Lightning alone", () => {
    const lightningOnly = view({
      bank: null,
      lightning: { identityPublicKey: "02".repeat(33) },
    })
    const writing = menu({ written: true })

    expect(guestMenuOffer(lightningOnly, writing).writable).toBe(writing)
  })
})
