import type {
  CategorySalesRow,
  ItemSalesRow,
  KeypadSalesRow,
  SignalsRow,
} from "@payky/core/modules/sales-stats/sales-stats-queries"
import { expect, test } from "vitest"
import {
  categoryShares,
  heatmapOpacity,
  rankItems,
  rowsByCurrency,
  signalFigures,
  splitItemSales,
} from "./stats-sections.ts"

test("rowsByCurrency splits rows per currency, the account currency first", () => {
  const rows = [
    { currency: "EUR", n: 1 },
    { currency: "CZK", n: 2 },
    { currency: "EUR", n: 3 },
  ] as const
  expect(rowsByCurrency(rows, "CZK")).toEqual([
    { currency: "CZK", rows: [rows[1]] },
    { currency: "EUR", rows: [rows[0], rows[2]] },
  ])
})

test("heatmapOpacity: empty is 0, busiest is 1, the rest above a floor", () => {
  expect(heatmapOpacity(0, 100)).toBe(0)
  expect(heatmapOpacity(0, 0)).toBe(0)
  expect(heatmapOpacity(100, 100)).toBe(1)
  expect(heatmapOpacity(1, 100)).toBeGreaterThan(0.15)
})

const item = (name: string, quantity: number, amount: number) =>
  ({
    catalogItemId: null,
    latestAt: "2026-10-01T00:00:00.000Z",
    itemId: name,
    name,
    currency: "CZK",
    quantity,
    amount,
    isDiscount: 0,
  }) as unknown as ItemSalesRow

test("rankItems orders by the chosen metric, name breaking ties", () => {
  const rows = [
    item("Tea", 10, 500),
    item("Cake", 2, 900),
    item("Beer", 2, 500),
  ]
  expect(rankItems(rows, "amount").map((row) => row.name)).toEqual([
    "Cake",
    "Beer",
    "Tea",
  ])
  expect(rankItems(rows, "quantity").map((row) => row.name)).toEqual([
    "Tea",
    "Beer",
    "Cake",
  ])
})

test("splitItemSales sums the discounts apart instead of ranking them", () => {
  const discount = (name: string, quantity: number, amount: number) =>
    ({ ...item(name, quantity, amount), isDiscount: 1 }) as ItemSalesRow
  const tea = item("Tea", 10, 500)
  const beer = item("Beer", 2, 500)

  expect(
    splitItemSales([
      tea,
      discount("Loyalty", 3, -300),
      beer,
      discount("Staff", 1, -50),
    ])
  ).toEqual({ items: [tea, beer], discounts: { quantity: 4, amount: -350 } })
  expect(splitItemSales([tea])).toEqual({ items: [tea], discounts: null })
})

test("categoryShares adds the keypad row, keeps Uncategorized, sorts by amount", () => {
  const categoryRows = [
    {
      categoryId: "drinks",
      categoryName: "Drinks",
      currency: "CZK",
      quantity: 5,
      amount: 300,
    },
    {
      categoryId: null,
      categoryName: null,
      currency: "CZK",
      quantity: 1,
      amount: 100,
    },
    {
      categoryId: "food",
      categoryName: "Food",
      currency: "EUR",
      quantity: 1,
      amount: 999,
    },
  ] as unknown as ReadonlyArray<CategorySalesRow>
  const keypadRows = [
    { currency: "CZK", count: 3, gross: 600 },
    { currency: "EUR", count: 1, gross: 0 },
  ] as unknown as ReadonlyArray<KeypadSalesRow>

  expect(categoryShares({ categoryRows, keypadRows, currency: "CZK" })).toEqual(
    [
      { key: "keypad", name: null, keypad: true, amount: 600, share: 0.6 },
      { key: "drinks", name: "Drinks", keypad: false, amount: 300, share: 0.3 },
      {
        key: "uncategorized",
        name: null,
        keypad: false,
        amount: 100,
        share: 0.1,
      },
    ]
  )
  // A currency's keypad row with nothing sold is left out.
  expect(
    categoryShares({ categoryRows, keypadRows, currency: "EUR" }).map(
      (row) => row.key
    )
  ).toEqual(["food"])
})

test("categoryShares keeps every share between none and the whole", () => {
  // Discounts are left out of the categories (catalog/0003), but a group
  // netting below zero must still draw no bar wider than the track.
  const categoryRows = [
    {
      categoryId: "drinks",
      categoryName: "Drinks",
      currency: "CZK",
      amount: 300,
    },
    { categoryId: null, categoryName: null, currency: "CZK", amount: -100 },
  ] as unknown as ReadonlyArray<CategorySalesRow>

  expect(
    categoryShares({ categoryRows, keypadRows: [], currency: "CZK" }).map(
      (row) => [row.key, row.share]
    )
  ).toEqual([
    ["drinks", 1],
    ["uncategorized", 0],
  ])
})

test("signalFigures fills every signal with zeros, the account currency always present", () => {
  const rows = [
    { signal: "manualIban", currency: "EUR", count: 1, amount: 2_000 },
    { signal: "canceledBill", currency: "CZK", count: 2, amount: 450 },
  ] as unknown as ReadonlyArray<SignalsRow>

  expect(signalFigures(rows, "CZK")).toEqual([
    {
      currency: "CZK",
      signals: [
        { signal: "canceledPayment", count: 0, amount: 0 },
        { signal: "canceledBill", count: 2, amount: 450 },
        { signal: "manualIban", count: 0, amount: 0 },
      ],
    },
    {
      currency: "EUR",
      signals: [
        { signal: "canceledPayment", count: 0, amount: 0 },
        { signal: "canceledBill", count: 0, amount: 0 },
        { signal: "manualIban", count: 1, amount: 2_000 },
      ],
    },
  ])
  expect(signalFigures([], "CZK")).toHaveLength(1)
})
