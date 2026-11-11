import type {
  CategorySalesRow,
  ItemSalesRow,
  KeypadSalesRow,
  SalesSignal,
  SignalsRow,
} from "@payky/core/modules/sales-stats/sales-stats-queries"
import { orderCurrencies } from "@payky/core/modules/sales-stats/sales-stats-utils"
import type { Currency } from "@payky/core/modules/shared/schema"

/**
 * Rows split per currency, the account currency first, as the KPI tiles do.
 * Sections never add amounts across currencies.
 */
export const rowsByCurrency = <R extends { readonly currency: Currency }>(
  rows: ReadonlyArray<R>,
  accountCurrency: Currency
): ReadonlyArray<{
  readonly currency: Currency
  readonly rows: ReadonlyArray<R>
}> =>
  orderCurrencies(
    rows.map((row) => row.currency),
    accountCurrency
  ).map((currency) => ({
    currency,
    rows: rows.filter((row) => row.currency === currency),
  }))

/**
 * A heatmap cell's opacity of the chart colour: the busiest cell is solid,
 * every other in proportion with a visible floor, an empty one `0` (the
 * muted background shows instead).
 */
export const heatmapOpacity = (gross: number, max: number): number =>
  gross <= 0 || max <= 0 ? 0 : 0.15 + 0.85 * (gross / max)

export type TopItemsMetric = "quantity" | "amount"

/** One currency's items, best first by `metric`, name breaking ties. */
export const rankItems = (
  rows: ReadonlyArray<ItemSalesRow>,
  metric: TopItemsMetric
): ReadonlyArray<ItemSalesRow> =>
  [...rows].sort(
    (a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name)
  )

export interface ItemSalesSplit {
  /** What was sold, to rank. */
  readonly items: ReadonlyArray<ItemSalesRow>
  /** The discounts given, as one figure; `null` when there were none. */
  readonly discounts: {
    readonly quantity: number
    /** Below zero. */
    readonly amount: number
  } | null
}

/**
 * One currency's item rows with the discounts (items priced below zero,
 * catalog/0002) taken out of the ranking and summed into one group of their
 * own, so a discount never ranks as an item that lost money.
 */
export const splitItemSales = (
  rows: ReadonlyArray<ItemSalesRow>
): ItemSalesSplit => {
  const discountRows = rows.filter((row) => row.isDiscount === 1)
  return {
    items: rows.filter((row) => row.isDiscount !== 1),
    discounts:
      discountRows.length === 0
        ? null
        : {
            quantity: discountRows.reduce((sum, row) => sum + row.quantity, 0),
            amount: discountRows.reduce((sum, row) => sum + row.amount, 0),
          },
  }
}

export interface CategoryShare {
  readonly key: string
  /** `null` is "Uncategorized", unless `keypad`: the sales without items. */
  readonly name: string | null
  readonly keypad: boolean
  readonly amount: number
  /** Of the rows' total, 0..1. */
  readonly share: number
}

/**
 * One currency's categories and the keypad's "Without item" row, best
 * first, each with its share of their total.
 */
export const categoryShares = ({
  categoryRows,
  keypadRows,
  currency,
}: {
  readonly categoryRows: ReadonlyArray<CategorySalesRow>
  readonly keypadRows: ReadonlyArray<KeypadSalesRow>
  readonly currency: Currency
}): ReadonlyArray<CategoryShare> => {
  const rows = [
    ...categoryRows
      .filter((row) => row.currency === currency)
      .map((row) => ({
        key: row.categoryId ?? "uncategorized",
        name: row.categoryName,
        keypad: false,
        amount: row.amount,
      })),
    ...keypadRows
      .filter((row) => row.currency === currency && row.gross > 0)
      .map((row) => ({
        key: "keypad",
        name: null,
        keypad: true,
        amount: row.gross,
      })),
  ]
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  // Kept to 0..1 even if a row nets below zero: a bar is drawn as this
  // fraction of its track, and a negative width would fill the whole track.
  const shareOf = (amount: number) =>
    total <= 0 ? 0 : Math.min(1, Math.max(0, amount / total))
  return rows
    .map((row) => ({ ...row, share: shareOf(row.amount) }))
    .sort((a, b) => b.amount - a.amount)
}

/** Per currency, the account currency first, currencies with no row left out. */
export const categoryGroups = ({
  categoryRows,
  keypadRows,
  accountCurrency,
}: {
  readonly categoryRows: ReadonlyArray<CategorySalesRow>
  readonly keypadRows: ReadonlyArray<KeypadSalesRow>
  readonly accountCurrency: Currency
}): ReadonlyArray<{
  readonly currency: Currency
  readonly rows: ReadonlyArray<CategoryShare>
}> =>
  rowsByCurrency([...categoryRows, ...keypadRows], accountCurrency)
    .map(({ currency }) => ({
      currency,
      rows: categoryShares({ categoryRows, keypadRows, currency }),
    }))
    .filter((group) => group.rows.length > 0)

const signalOrder: ReadonlyArray<SalesSignal> = [
  "canceledPayment",
  "canceledBill",
  "manualIban",
]

export interface SignalFigures {
  readonly currency: Currency
  readonly signals: ReadonlyArray<{
    readonly signal: SalesSignal
    readonly count: number
    readonly amount: number
  }>
}

/**
 * Every signal per currency, in a fixed order, zero where nothing happened,
 * so "none" reads as a number too. Without any row, one set of zeros in the
 * account currency.
 */
export const signalFigures = (
  rows: ReadonlyArray<SignalsRow>,
  accountCurrency: Currency
): ReadonlyArray<SignalFigures> =>
  orderCurrencies(
    [accountCurrency, ...rows.map((row) => row.currency)],
    accountCurrency
  ).map((currency) => ({
    currency,
    signals: signalOrder.map((signal) => {
      const row = rows.find(
        (candidate) =>
          candidate.currency === currency && candidate.signal === signal
      )
      return { signal, count: row?.count ?? 0, amount: row?.amount ?? 0 }
    }),
  }))
