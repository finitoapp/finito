import { createIdFromString } from "@evolu/common"
import type { Money } from "@payky/core/modules/shared/money"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { createTranslate } from "./i18n/translate.ts"
import {
  toServeOrderMoney,
  waitingMenuOrdersNotice,
} from "./menu-order-announcement.ts"

const t = createTranslate("en", paykyBrand)
const terrace = createIdFromString<"Table">("terrace")
type WaitingOrder = Parameters<
  typeof waitingMenuOrdersNotice
>[0]["orders"][number]

const first = {
  id: createIdFromString<"MenuOrder">("order-1"),
  number: 1,
  tableId: terrace,
  acceptedAt: null,
}
const second = {
  id: createIdFromString<"MenuOrder">("order-2"),
  number: 2,
  tableId: terrace,
  acceptedAt: null,
}
const tables = [{ id: terrace, name: "Terrace" }]

describe("waitingMenuOrdersNotice", () => {
  const notice = (
    orders: ReadonlyArray<WaitingOrder>,
    shownTables: typeof tables = tables
  ) => waitingMenuOrdersNotice({ orders, tables: shownTables, t })
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
})

describe("toServeOrderMoney", () => {
  const money = (value: number): Money => ({
    value: value as Money["value"],
    currency: "USD",
  })
  const format = ({ value }: Money) => `$${(value / 100).toFixed(2)}`

  test("shows what the order costs once its money covers it", () => {
    expect(
      toServeOrderMoney(
        { isFullyPaid: true, paid: money(23_300), total: money(23_300) },
        t,
        format
      )
    ).toBe("$233.00")
  })

  test("says how much arrived of what the order costs when it does not", () => {
    expect(
      toServeOrderMoney(
        { isFullyPaid: false, paid: money(5000), total: money(16_500) },
        t,
        format
      )
    ).toBe("$50.00 of $165.00 paid")
  })
})
