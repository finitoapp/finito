import { NonNegativeInteger } from "../shared/schema.ts"
import type { TaxRateRow } from "../tax-rate/tax-rate.ts"
import {
  type TaxRateId,
  TaxRatePercentage,
} from "../tax-rate/tax-rate-types.ts"
import { splitInclusiveAmount } from "../tax-rate/tax-rate-utils.ts"
import {
  type DiscountShareLine,
  deriveLineNetAmount,
  isDiscountLine,
} from "./bill-line-discount-utils.ts"
import type { BillLineSummary } from "./bill-line-summary.ts"

export interface TaxRecapRow {
  /** `null` groups lines that carry no tax rate at all. */
  readonly taxRateId: TaxRateId | null
  /** `null` only when `taxRateId` is `null`. */
  readonly name: string | null
  readonly ratePercentage: TaxRatePercentage | null
  readonly baseAmount: number
  readonly taxAmount: number
  readonly grossAmount: number
}

/**
 * Groups a bill's or a payment's net lines by their frozen `taxRateId`,
 * splitting each line's amount into base+tax at the line level (rounding per
 * line, then summing — the Czech convention, never re-derived from a
 * pre-summed group total). Rows follow `taxRates`' own `sortOrder`. A line
 * whose `taxRateId` isn't found in `taxRates` is excluded from the recap
 * entirely rather than shown as a blank row — this is reachable in this
 * local-first app when a device renders a bill before a newly-created tax
 * rate has synced from another device.
 *
 * VAT is counted from what each line came to after its share of the bill's
 * discount (catalog/0003): a line's amount is `deriveLineNetAmount`, so the
 * lines need their `discountShare` — from `allocateDiscount` for a bill's
 * live lines, as frozen in `paymentLine` for a payment's. A discount line is
 * no VAT row of its own and never part of the "no rate" group (it has no rate
 * because its amount is borne by the goods), so it is left out.
 *
 * No recap at all (`[]`) when the lines hold a discount no line bears a share
 * of — a bill without goods above zero, which cannot be paid, or a payment
 * frozen by an app that did not know discounts — or when a line nets below
 * zero, which `allocateDiscount` never produces. A recap of the goods before
 * their discount would overstate every rate.
 */
export const calculateTaxRecap = (
  lines: ReadonlyArray<
    Pick<BillLineSummary, "taxRateId" | "totalAmount"> & DiscountShareLine
  >,
  taxRates: ReadonlyArray<Pick<TaxRateRow, "id" | "name" | "rate">>
): ReadonlyArray<TaxRecapRow> => {
  if (
    lines.some(isDiscountLine) &&
    lines.every((line) => line.discountShare === null)
  ) {
    return []
  }

  const totalsByTaxRateId = new Map<
    TaxRateId | null,
    { base: number; tax: number; gross: number }
  >()

  for (const line of lines) {
    if (isDiscountLine(line)) continue
    const netAmount = deriveLineNetAmount(line)
    if (netAmount < 0) return []

    const taxRate =
      line.taxRateId === null
        ? undefined
        : taxRates.find((rate) => rate.id === line.taxRateId)
    if (line.taxRateId !== null && taxRate === undefined) continue

    const ratePercentage = taxRate?.rate ?? TaxRatePercentage(0)
    const split = splitInclusiveAmount(
      NonNegativeInteger(netAmount),
      ratePercentage
    )

    const key = line.taxRateId
    const existing = totalsByTaxRateId.get(key) ?? { base: 0, tax: 0, gross: 0 }
    totalsByTaxRateId.set(key, {
      base: existing.base + split.base,
      tax: existing.tax + split.tax,
      gross: existing.gross + netAmount,
    })
  }

  const rows: TaxRecapRow[] = []

  for (const taxRate of taxRates) {
    const sums = totalsByTaxRateId.get(taxRate.id)
    if (sums === undefined) continue

    rows.push({
      taxRateId: taxRate.id,
      name: taxRate.name,
      ratePercentage: taxRate.rate,
      baseAmount: sums.base,
      taxAmount: sums.tax,
      grossAmount: sums.gross,
    })
  }

  const noTaxSums = totalsByTaxRateId.get(null)
  if (noTaxSums !== undefined) {
    rows.push({
      taxRateId: null,
      name: null,
      ratePercentage: null,
      baseAmount: noTaxSums.base,
      taxAmount: noTaxSums.tax,
      grossAmount: noTaxSums.gross,
    })
  }

  return rows
}

/**
 * A recap scaled down to the part of its goods a payment covers: each rate's
 * gross amount becomes `grossAmount × goodsAmount / Σ grossAmount`, so the
 * rows keep the recap's proportions and add up to `goodsAmount` exactly.
 *
 * Every row first takes the whole minor units of its exact share; the units
 * still left go one each to the rows with the largest fractional remainders,
 * ties to the row earlier in the recap. Each row's gross is then split into
 * base and tax again at its own rate (`splitInclusiveAmount`), so VAT is
 * divided per rate here, not per line, and may differ by a unit from what
 * splitting the covered lines one by one would give. Rows keep their
 * `taxRateId`, `name` and `ratePercentage`.
 *
 * A recap with nothing to share (no gross amount at all) comes back as it is.
 */
export const prorateTaxRecap = (
  recap: ReadonlyArray<TaxRecapRow>,
  goodsAmount: NonNegativeInteger
): ReadonlyArray<TaxRecapRow> => {
  const recapGross = recap.reduce((sum, row) => sum + row.grossAmount, 0)
  if (recapGross <= 0) return recap

  // Exact in `bigint`, as `allocateDiscount` is: a large gross times a large
  // payment can pass `Number.MAX_SAFE_INTEGER` before it is divided back down.
  const total = BigInt(recapGross)
  const quotas = recap.map((row) => {
    const exact = BigInt(row.grossAmount) * BigInt(goodsAmount)
    return { whole: Number(exact / total), remainder: exact % total }
  })
  const left = goodsAmount - quotas.reduce((sum, quota) => sum + quota.whole, 0)
  // `sort` is stable, so equal remainders keep the recap's order.
  const extraUnitIndexes = new Set(
    quotas
      .map((quota, index) => ({ remainder: quota.remainder, index }))
      .sort((a, b) =>
        a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1
      )
      .slice(0, left)
      .map(({ index }) => index)
  )

  return recap.map((row, index): TaxRecapRow => {
    const gross = NonNegativeInteger(
      (quotas[index]?.whole ?? 0) + (extraUnitIndexes.has(index) ? 1 : 0)
    )
    const split = splitInclusiveAmount(
      gross,
      row.ratePercentage ?? TaxRatePercentage(0)
    )
    return {
      taxRateId: row.taxRateId,
      name: row.name,
      ratePercentage: row.ratePercentage,
      baseAmount: split.base,
      taxAmount: split.tax,
      grossAmount: gross,
    }
  })
}

/**
 * Whether a tax recap has any taxed line to show. Shared by `TaxRecap`
 * itself and by pages that decide whether to render a separator/heading
 * around it.
 */
export const hasTaxableLines = (
  rows: ReadonlyArray<Pick<TaxRecapRow, "taxRateId">>
): boolean => rows.some((row) => row.taxRateId !== null)
