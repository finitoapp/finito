import { describe, expect, test } from "vitest"

import type { SalesByHourRow } from "./sales-stats-queries.ts"
import {
  orderCurrencies,
  salesBuckets,
  salesHeatmap,
  salesKpis,
  statsDelta,
  statsPeriodRanges,
} from "./sales-stats-utils.ts"

// Vitest runs with TZ=Europe/Prague (vite.config.ts).

const hourRow = (utcHour: string, gross = 100): SalesByHourRow => ({
  utcHour,
  currency: "CZK",
  count: 1,
  gross,
  tips: 0,
})

describe("statsPeriodRanges", () => {
  const now = new Date("2026-10-10T14:00:00+02:00") // a Saturday

  test("today runs to local midnight and compares with a week earlier up to the same time", () => {
    expect(statsPeriodRanges({ kind: "today" }, now)).toEqual({
      range: {
        fromIso: "2026-10-09T22:00:00.000Z",
        toIso: "2026-10-10T22:00:00.000Z",
      },
      comparison: {
        fromIso: "2026-10-02T22:00:00.000Z",
        toIso: "2026-10-03T12:00:00.000Z",
      },
      comparisonWhole: {
        fromIso: "2026-10-02T22:00:00.000Z",
        toIso: "2026-10-03T22:00:00.000Z",
      },
      bucket: "hour",
    })
  })

  test("yesterday compares with the same weekday a week before", () => {
    expect(statsPeriodRanges({ kind: "yesterday" }, now)).toMatchObject({
      range: {
        fromIso: "2026-10-08T22:00:00.000Z",
        toIso: "2026-10-09T22:00:00.000Z",
      },
      comparison: { fromIso: "2026-10-01T22:00:00.000Z" },
      bucket: "hour",
    })
  })

  test("7 days is today and the six before, against the 7 before that", () => {
    expect(statsPeriodRanges({ kind: "last7Days" }, now)).toEqual({
      range: {
        fromIso: "2026-10-03T22:00:00.000Z",
        toIso: "2026-10-10T22:00:00.000Z",
      },
      comparison: {
        fromIso: "2026-09-26T22:00:00.000Z",
        toIso: "2026-10-03T22:00:00.000Z",
      },
      comparisonWhole: {
        fromIso: "2026-09-26T22:00:00.000Z",
        toIso: "2026-10-03T22:00:00.000Z",
      },
      bucket: "day",
    })
  })

  test("month to date compares with the previous month up to the same moment", () => {
    expect(statsPeriodRanges({ kind: "monthToDate" }, now)).toEqual({
      range: {
        fromIso: "2026-09-30T22:00:00.000Z",
        toIso: "2026-10-10T22:00:00.000Z",
      },
      comparison: {
        fromIso: "2026-08-31T22:00:00.000Z",
        toIso: "2026-09-10T12:00:00.000Z",
      },
      comparisonWhole: {
        fromIso: "2026-08-31T22:00:00.000Z",
        toIso: "2026-09-10T22:00:00.000Z",
      },
      bucket: "day",
    })
  })

  test("custom dates are both inclusive, against the equally long span before", () => {
    expect(
      statsPeriodRanges(
        { kind: "custom", from: "2026-10-20", to: "2026-10-26" },
        now
      )
    ).toEqual({
      range: {
        fromIso: "2026-10-19T22:00:00.000Z",
        // 25 October has 25 hours: the span ends in winter time.
        toIso: "2026-10-26T23:00:00.000Z",
      },
      comparison: {
        fromIso: "2026-10-12T22:00:00.000Z",
        toIso: "2026-10-19T22:00:00.000Z",
      },
      comparisonWhole: {
        fromIso: "2026-10-12T22:00:00.000Z",
        toIso: "2026-10-19T22:00:00.000Z",
      },
      bucket: "day",
    })
    expect(
      statsPeriodRanges(
        { kind: "custom", from: "2026-03-29", to: "2026-03-29" },
        now
      )
    ).toMatchObject({
      range: {
        fromIso: "2026-03-28T23:00:00.000Z",
        toIso: "2026-03-29T22:00:00.000Z",
      },
      bucket: "hour",
    })
  })

  test("today on a DST day compares up to the same wall-clock time", () => {
    expect(
      statsPeriodRanges({ kind: "today" }, new Date("2026-10-25T12:00:00Z"))
    ).toEqual({
      range: {
        fromIso: "2026-10-24T22:00:00.000Z",
        toIso: "2026-10-25T23:00:00.000Z",
      },
      comparison: {
        fromIso: "2026-10-17T22:00:00.000Z",
        // 13:00 winter time today, 13:00 summer time a week earlier.
        toIso: "2026-10-18T11:00:00.000Z",
      },
      comparisonWhole: {
        fromIso: "2026-10-17T22:00:00.000Z",
        toIso: "2026-10-18T22:00:00.000Z",
      },
      bucket: "hour",
    })
  })
})

describe("salesBuckets", () => {
  const day = (date: string) =>
    statsPeriodRanges({ kind: "custom", from: date, to: date }, new Date())
      .range

  test("give 29 March 2026 23 hours, the gap skipped", () => {
    const buckets = salesBuckets({
      rows: [hourRow("2026-03-29T00"), hourRow("2026-03-29T01")],
      currency: "CZK",
      range: day("2026-03-29"),
      unit: "hour",
    })
    expect(buckets).toHaveLength(23)
    expect(buckets.map((bucket) => bucket.start.getHours())).not.toContain(2)
    expect(
      buckets.filter((b) => b.count > 0).map((b) => b.start.getHours())
    ).toEqual([1, 3])
  })

  test("give 25 October 2026 25 hours, 02:00 twice", () => {
    const buckets = salesBuckets({
      rows: [hourRow("2026-10-25T00", 100), hourRow("2026-10-25T01", 200)],
      currency: "CZK",
      range: day("2026-10-25"),
      unit: "hour",
    })
    expect(buckets).toHaveLength(25)
    expect(
      buckets.slice(1, 5).map((bucket) => bucket.start.getHours())
    ).toEqual([1, 2, 2, 3])
    expect(buckets.map((bucket) => bucket.gross).slice(1, 5)).toEqual([
      0, 100, 200, 0,
    ])
  })

  test("put 23:30 and 00:30 summer time on their own local days", () => {
    const range = statsPeriodRanges(
      { kind: "custom", from: "2026-06-05", to: "2026-06-07" },
      new Date()
    ).range
    // 23:30 local on 5 June is 21:30 UTC; 00:30 local on 6 June is 22:30
    // UTC, still 5 June there.
    expect(
      salesBuckets({
        rows: [hourRow("2026-06-05T21"), hourRow("2026-06-05T22", 50)],
        currency: "CZK",
        range,
        unit: "day",
      }).map(({ start, gross }) => ({ date: start.getDate(), gross }))
    ).toEqual([
      { date: 5, gross: 100 },
      { date: 6, gross: 50 },
      { date: 7, gross: 0 },
    ])
  })

  test("keep a range's partial last hour", () => {
    const { comparison } = statsPeriodRanges(
      { kind: "today" },
      new Date("2026-10-10T14:20:00+02:00")
    )
    const buckets = salesBuckets({
      rows: [hourRow("2026-10-03T12")],
      currency: "CZK",
      range: comparison,
      unit: "hour",
    })
    expect(buckets).toHaveLength(15)
    expect(buckets.at(-1)).toMatchObject({ gross: 100 })
  })

  test("keep to the one currency asked for", () => {
    expect(
      salesBuckets({
        rows: [
          hourRow("2026-06-05T10"),
          { ...hourRow("2026-06-05T10"), currency: "EUR" },
        ],
        currency: "EUR",
        range: day("2026-06-05"),
        unit: "day",
      })
    ).toMatchObject([{ count: 1, gross: 100 }])
  })
})

test("salesHeatmap places sales by local weekday, Monday first, and hour", () => {
  // Friday 5 June 2026, 10:xx and 23:xx local.
  const matrix = salesHeatmap(
    [
      hourRow("2026-06-05T08"),
      hourRow("2026-06-05T08"),
      hourRow("2026-06-05T21"),
    ],
    "CZK"
  )
  expect(matrix).toHaveLength(7)
  expect(matrix[4]?.[10]).toEqual({ count: 2, gross: 200, tips: 0 })
  expect(matrix[4]?.[23]).toEqual({ count: 1, gross: 100, tips: 0 })
  expect(matrix.flat().reduce((sum, cell) => sum + cell.count, 0)).toBe(3)
})

test("statsDelta has no ratio against nothing", () => {
  expect(statsDelta(150, 100)).toEqual({ difference: 50, ratio: 0.5 })
  expect(statsDelta(5, 0)).toEqual({ difference: 5, ratio: null })
})

test("orderCurrencies puts the account currency first", () => {
  expect(orderCurrencies(["USD", "EUR", "CZK", "EUR"], "EUR")).toEqual([
    "EUR",
    "CZK",
    "USD",
  ])
})

test("salesKpis averages gross per sale, 0 without sales", () => {
  expect(
    salesKpis({
      hourRows: [{ ...hourRow("2026-06-05T08", 1_000), count: 3, tips: 100 }],
      refundRows: [],
      overpaymentTips: [],
      accountCurrency: "CZK",
    })
  ).toMatchObject([{ averageSale: 333, salesCount: 3, tips: 100 }])
  expect(
    salesKpis({
      hourRows: [],
      refundRows: [],
      overpaymentTips: [],
      accountCurrency: "CZK",
    })
  ).toEqual([])
})
