import type { Money } from "@payky/core/modules/shared/money"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { formatMoney } from "./format-money.ts"
import {
  type BillWithStats,
  elapsedSeverity,
  formatRowsSum,
  matchesTableFilter,
  sumBillRows,
} from "./pos-overview.ts"

const formatEnUs = (money: Money) => formatMoney(money, "en-US")

describe("elapsedSeverity", () => {
  test("flags a bill open for 2 h as long and 12 h as very long", () => {
    expect(elapsedSeverity(119 * 60_000)).toBe("normal")
    expect(elapsedSeverity(120 * 60_000)).toBe("long")
    expect(elapsedSeverity(12 * 60 * 60_000)).toBe("veryLong")
  })
})

describe("matchesTableFilter", () => {
  test("filters tiles by occupancy", () => {
    expect(matchesTableFilter("all", true)).toBe(true)
    expect(matchesTableFilter("occupied", true)).toBe(true)
    expect(matchesTableFilter("occupied", false)).toBe(false)
    expect(matchesTableFilter("free", false)).toBe(true)
    expect(matchesTableFilter("free", true)).toBe(false)
  })
})

describe("sumBillRows", () => {
  test("has no sum without rows", () => {
    expect(sumBillRows([])).toBeUndefined()
  })
})

describe("formatRowsSum", () => {
  const row = (paid: number, left: number, currency = "EUR") =>
    ({
      bill: { currency },
      paid: NonNegativeInteger(paid),
      left: NonNegativeInteger(left),
    }) as unknown as BillWithStats

  test("sums what is left on the rows, or what guests paid on them", () => {
    const rows = [row(4500, 10100), row(0, 500)]

    expect(formatRowsSum(rows, "left", formatEnUs)).toBe("€106.00")
    expect(formatRowsSum(rows, "paid", formatEnUs)).toBe("€45.00")
  })

  test("has no sum across currencies", () => {
    expect(
      formatRowsSum([row(0, 100), row(0, 100, "CZK")], "left", formatEnUs)
    ).toBeUndefined()
  })
})
