import { createIdFromString } from "@evolu/common"
import type { Money } from "@payky/core/modules/shared/money"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { createTranslate } from "./i18n/translate.ts"
import { newMenuOrderAnnouncements } from "./menu-order-announcement.ts"

const t = createTranslate("en", paykyBrand)
const terrace = createIdFromString<"Table">("terrace")
type AnnouncedOrder = Parameters<
  typeof newMenuOrderAnnouncements
>[0]["orders"][number]

const nothingWritten = {
  currency: "CZK",
  writtenAmount: null,
  writtenText: null,
  writtenArrived: null,
} as const
const first = {
  id: createIdFromString<"MenuOrder">("order-1"),
  number: 1,
  tableId: terrace,
  ...nothingWritten,
}
const second = {
  id: createIdFromString<"MenuOrder">("order-2"),
  number: 2,
  tableId: terrace,
  ...nothingWritten,
}
const written: AnnouncedOrder = {
  id: createIdFromString<"MenuOrder">("order-7"),
  number: 7,
  tableId: terrace,
  currency: "CZK",
  writtenAmount: 9000,
  writtenText: "2x pivo",
  writtenArrived: 9000,
}
const tables = [{ id: terrace, name: "Terrace" }]
const formatMoney = ({ value, currency }: Money) =>
  `${(value / 100).toFixed(2)} ${currency}`

describe("newMenuOrderAnnouncements", () => {
  test("announces nothing from the first list", () => {
    expect(
      newMenuOrderAnnouncements({
        announced: null,
        orders: [first],
        tables,
        t,
        formatMoney,
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
        formatMoney,
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
        formatMoney,
      })
    ).toEqual(["New order 1", "New order 2"])
  })

  const announce = (order: AnnouncedOrder) =>
    newMenuOrderAnnouncements({
      announced: new Set(),
      orders: [order],
      tables,
      t,
      formatMoney,
    })

  test("announces a written order with its table, number, amount and the guest's text", () => {
    expect(announce(written)).toEqual([
      "New order 7 · Terrace · 90.00 CZK · 2x pivo",
    ])
  })

  test("says both amounts when less arrived", () => {
    expect(
      announce({ ...written, writtenAmount: 90_000, writtenArrived: 100 })
    ).toEqual(["New order 7 · Terrace · 1.00 CZK of 900.00 CZK · 2x pivo"])
  })

  test("shortens a long text", () => {
    const [message] = announce({ ...written, writtenText: "x".repeat(140) })

    expect(message).toBe(
      `New order 7 · Terrace · 90.00 CZK · ${"x".repeat(60)}…`
    )
  })

  test("shortens a long text without breaking an emoji", () => {
    const [message] = announce({ ...written, writtenText: "🍺".repeat(70) })

    expect(message).toBe(
      `New order 7 · Terrace · 90.00 CZK · ${"🍺".repeat(60)}…`
    )
  })

  test("announces a written order without a table", () => {
    expect(announce({ ...written, tableId: null })).toEqual([
      "New order 7 · 90.00 CZK · 2x pivo",
    ])
  })

  test("shows a text of placeholders and patterns as typed", () => {
    expect(
      announce({ ...written, writtenText: "{amount} {table} $& $'" })
    ).toEqual(["New order 7 · Terrace · 90.00 CZK · {amount} {table} $& $'"])
  })

  test("keeps announcing a menu order whose catalog item was deleted as a menu order", () => {
    expect(announce(first)).toEqual(["New order 1 · Terrace"])
  })
})
