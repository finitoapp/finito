import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { createTranslate } from "./i18n/translate.ts"
import { newMenuOrderAnnouncements } from "./menu-order-announcement.ts"

const t = createTranslate("en", paykyBrand)
const terrace = createIdFromString<"Table">("terrace")
const first = {
  id: createIdFromString<"MenuOrder">("order-1"),
  number: 1,
  tableId: terrace,
}
const second = {
  id: createIdFromString<"MenuOrder">("order-2"),
  number: 2,
  tableId: terrace,
}
const tables = [{ id: terrace, name: "Terrace" }]

describe("newMenuOrderAnnouncements", () => {
  test("announces nothing from the first list", () => {
    expect(
      newMenuOrderAnnouncements({
        announced: null,
        orders: [first],
        tables,
        t,
      })
    ).toEqual([])
  })

  test("announces only the orders not announced yet, by number and table", () => {
    expect(
      newMenuOrderAnnouncements({
        announced: new Set([first.id]),
        orders: [first, second],
        tables,
        t,
      })
    ).toEqual(["New order 2 · Terrace"])
  })

  test("leaves the table out when the order has none or it is gone", () => {
    expect(
      newMenuOrderAnnouncements({
        announced: new Set(),
        orders: [{ ...first, tableId: null }, second],
        tables: [],
        t,
      })
    ).toEqual(["New order 1", "New order 2"])
  })
})
