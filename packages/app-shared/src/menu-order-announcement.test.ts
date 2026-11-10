import { createIdFromString } from "@evolu/common"
import type { Money } from "@payky/core/modules/shared/money"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { createTranslate } from "./i18n/translate.ts"
import { waitingMenuOrdersNotice } from "./menu-order-announcement.ts"

const t = createTranslate("en", paykyBrand)
const terrace = createIdFromString<"Table">("terrace")
type WaitingOrder = Parameters<
  typeof waitingMenuOrdersNotice
>[0]["orders"][number]

const nothingWritten = {
  acceptedAt: null,
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
const written: WaitingOrder = {
  id: createIdFromString<"MenuOrder">("order-7"),
  number: 7,
  tableId: terrace,
  acceptedAt: null,
  currency: "CZK",
  writtenAmount: 9000,
  writtenText: "2x pivo",
  writtenArrived: 9000,
}
const tables = [{ id: terrace, name: "Terrace" }]
const formatMoney = ({ value, currency }: Money) =>
  `${(value / 100).toFixed(2)} ${currency}`

describe("waitingMenuOrdersNotice", () => {
  const notice = (
    orders: ReadonlyArray<WaitingOrder>,
    shownTables: typeof tables = tables
  ) => waitingMenuOrdersNotice({ orders, tables: shownTables, t, formatMoney })
  const accepted = { acceptedAt: TimestampMs(1) }

  test("says nothing while no order waits for the staff", () => {
    expect(notice([])).toBeNull()
    expect(notice([{ ...first, ...accepted }])).toBeNull()
  })

  test("names the one order waiting for the staff by number and table", () => {
    expect(notice([{ ...first, ...accepted }, second])).toBe(
      "New order 2 · Terrace"
    )
  })

  test("counts the orders when more wait for the staff", () => {
    expect(notice([first, second])).toBe("Orders waiting: 2")
  })

  test("leaves the table out when the order has none or it is gone", () => {
    expect(notice([{ ...first, tableId: null }])).toBe("New order 1")
    expect(notice([first], [])).toBe("New order 1")
  })

  const announce = (order: WaitingOrder) => notice([order])

  test("announces a written order with its table, number, amount and the guest's text", () => {
    expect(announce(written)).toBe(
      "New order 7 · Terrace · 90.00 CZK · 2x pivo"
    )
  })

  test("says both amounts when less arrived", () => {
    expect(
      announce({ ...written, writtenAmount: 90_000, writtenArrived: 100 })
    ).toBe("New order 7 · Terrace · 1.00 CZK of 900.00 CZK · 2x pivo")
  })

  test("shortens a long text", () => {
    expect(announce({ ...written, writtenText: "x".repeat(140) })).toBe(
      `New order 7 · Terrace · 90.00 CZK · ${"x".repeat(60)}…`
    )
  })

  test("shortens a long text without breaking an emoji", () => {
    expect(announce({ ...written, writtenText: "🍺".repeat(70) })).toBe(
      `New order 7 · Terrace · 90.00 CZK · ${"🍺".repeat(60)}…`
    )
  })

  test("announces a written order without a table", () => {
    expect(announce({ ...written, tableId: null })).toBe(
      "New order 7 · 90.00 CZK · 2x pivo"
    )
  })

  test("shows a text of placeholders and patterns as typed", () => {
    expect(
      announce({ ...written, writtenText: "{amount} {table} $& $'" })
    ).toBe("New order 7 · Terrace · 90.00 CZK · {amount} {table} $& $'")
  })

  test("keeps announcing a menu order whose catalog item was deleted as a menu order", () => {
    expect(announce(first)).toBe("New order 1 · Terrace")
  })
})
