import { describe, expect, test } from "vitest"

import { NonNegativeInteger, TimestampMs } from "../shared/schema.ts"
import { type TaxRateId, TaxRatePercentage } from "./tax-rate-types.ts"
import {
  decimalStringToTaxRatePercentage,
  findActiveTaxRateByPercentage,
  splitInclusiveAmount,
  taxRatePercentageToDecimalString,
} from "./tax-rate-utils.ts"

describe("taxRatePercentageToDecimalString", () => {
  test("renders a whole percentage without decimals", () => {
    expect(taxRatePercentageToDecimalString(TaxRatePercentage(2100))).toBe("21")
  })

  test("renders a half-percent decimal", () => {
    expect(taxRatePercentageToDecimalString(TaxRatePercentage(1250))).toBe(
      "12.5"
    )
  })

  test("renders a two-decimal-place percentage", () => {
    expect(taxRatePercentageToDecimalString(TaxRatePercentage(1255))).toBe(
      "12.55"
    )
  })

  test("renders zero", () => {
    expect(taxRatePercentageToDecimalString(TaxRatePercentage(0))).toBe("0")
  })
})

describe("decimalStringToTaxRatePercentage", () => {
  test("parses a whole number", () => {
    expect(decimalStringToTaxRatePercentage("21")).toBe(2100)
  })

  test("parses a dot decimal", () => {
    expect(decimalStringToTaxRatePercentage("12.5")).toBe(1250)
  })

  test("parses a comma decimal", () => {
    expect(decimalStringToTaxRatePercentage("12,5")).toBe(1250)
  })

  test("rejects more than two decimal places", () => {
    expect(decimalStringToTaxRatePercentage("12.555")).toBeNull()
  })

  test("rejects a value above 100%", () => {
    expect(decimalStringToTaxRatePercentage("100.01")).toBeNull()
  })

  test("accepts exactly 100%", () => {
    expect(decimalStringToTaxRatePercentage("100")).toBe(10000)
  })

  test("rejects a negative value", () => {
    expect(decimalStringToTaxRatePercentage("-1")).toBeNull()
  })

  test("rejects non-numeric input", () => {
    expect(decimalStringToTaxRatePercentage("abc")).toBeNull()
  })
})

describe("splitInclusiveAmount", () => {
  test("splits a 21% inclusive amount", () => {
    const result = splitInclusiveAmount(
      NonNegativeInteger(12_100),
      TaxRatePercentage(2100)
    )
    expect(result.base).toBe(10_000)
    expect(result.tax).toBe(2_100)
  })

  test("base plus tax always equals the gross amount", () => {
    const result = splitInclusiveAmount(
      NonNegativeInteger(5_900),
      TaxRatePercentage(1200)
    )
    expect(result.base + result.tax).toBe(5_900)
  })

  test("a zero gross amount splits to zero", () => {
    const result = splitInclusiveAmount(
      NonNegativeInteger(0),
      TaxRatePercentage(2100)
    )
    expect(result.base).toBe(0)
    expect(result.tax).toBe(0)
  })

  test("a gross amount of 1 rounds its tax away", () => {
    const result = splitInclusiveAmount(
      NonNegativeInteger(1),
      TaxRatePercentage(2100)
    )
    expect(result.base).toBe(1)
    expect(result.tax).toBe(0)
  })

  test("a 0% rate has no tax portion", () => {
    const result = splitInclusiveAmount(
      NonNegativeInteger(5_900),
      TaxRatePercentage(0)
    )
    expect(result.base).toBe(5_900)
    expect(result.tax).toBe(0)
  })
})

describe("findActiveTaxRateByPercentage", () => {
  const rate = (
    id: string,
    percentage: number,
    deactivatedAt: number | null = null
  ) => ({
    id: id as TaxRateId,
    rate: TaxRatePercentage(percentage),
    deactivatedAt: deactivatedAt === null ? null : TimestampMs(deactivatedAt),
  })

  test("finds the active rate of exactly that percentage", () => {
    expect(
      findActiveTaxRateByPercentage(
        [rate("standard", 2100), rate("reduced", 1200)],
        TaxRatePercentage(1200)
      )
    ).toBe("reduced")
  })

  test("skips an archived rate of that percentage", () => {
    expect(
      findActiveTaxRateByPercentage(
        [rate("old", 1200, 1_700_000_000_000), rate("current", 1200)],
        TaxRatePercentage(1200)
      )
    ).toBe("current")
  })

  test("finds nothing when no active rate has that percentage", () => {
    expect(
      findActiveTaxRateByPercentage(
        [rate("standard", 2100), rate("old", 1500, 1_700_000_000_000)],
        TaxRatePercentage(1500)
      )
    ).toBeUndefined()
  })
})
