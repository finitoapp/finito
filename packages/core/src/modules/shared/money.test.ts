import { describe, expect, test } from "vitest"
import {
  decimalAmountToMinorUnits,
  decimalPriceToMinorUnits,
  fiatMinorUnitsToSats,
  fiatToSats,
  minorUnitsToDecimalString,
  minorUnitsToFixedDecimalString,
  roundMinorUnits,
  satsToFiat,
  signedDecimalAmountToMinorUnits,
} from "./money.ts"
import { Integer } from "./schema.ts"

describe("minorUnitsToDecimalString", () => {
  test("formats a two-decimal fiat currency", () => {
    expect(
      minorUnitsToDecimalString({ value: Integer(1_250), currency: "CZK" })
    ).toBe("12.5")
  })

  test("formats an eight-decimal BTC amount down to a single sat", () => {
    expect(
      minorUnitsToDecimalString({ value: Integer(1), currency: "BTC" })
    ).toBe("0.00000001")
    expect(
      minorUnitsToDecimalString({
        value: Integer(100_000_000),
        currency: "BTC",
      })
    ).toBe("1")
  })

  test("strips trailing fraction zeros", () => {
    expect(
      minorUnitsToDecimalString({ value: Integer(1_200), currency: "CZK" })
    ).toBe("12")
  })

  test("pads a value smaller than the fraction digits with a leading zero", () => {
    expect(
      minorUnitsToDecimalString({ value: Integer(5), currency: "CZK" })
    ).toBe("0.05")
  })

  test("formats zero without a sign", () => {
    expect(
      minorUnitsToDecimalString({ value: Integer(0), currency: "CZK" })
    ).toBe("0")
  })

  test("prefixes negative values with a minus sign", () => {
    expect(
      minorUnitsToDecimalString({ value: Integer(-1_250), currency: "CZK" })
    ).toBe("-12.5")
  })
})

describe("minorUnitsToFixedDecimalString", () => {
  test("keeps every fraction digit of the currency", () => {
    expect(
      minorUnitsToFixedDecimalString({
        value: Integer(25_000),
        currency: "CZK",
      })
    ).toBe("250.00")
    expect(
      minorUnitsToFixedDecimalString({ value: Integer(5), currency: "CZK" })
    ).toBe("0.05")
    expect(
      minorUnitsToFixedDecimalString({ value: Integer(0), currency: "CZK" })
    ).toBe("0.00")
  })

  test("prefixes negative values with a minus sign", () => {
    expect(
      minorUnitsToFixedDecimalString({ value: Integer(-150), currency: "CZK" })
    ).toBe("-1.50")
  })
})

describe("decimalAmountToMinorUnits", () => {
  test("converts decimal values including a localized decimal separator", () => {
    expect(decimalAmountToMinorUnits({ currency: "CZK", value: "12.50" })).toBe(
      1_250
    )
    expect(decimalAmountToMinorUnits({ currency: "EUR", value: "0,50" })).toBe(
      50
    )
  })

  test("accepts a thousands-grouped amount in US convention (comma group, dot decimal)", () => {
    expect(
      decimalAmountToMinorUnits({ currency: "USD", value: "1,234.56" })
    ).toBe(123_456)
  })

  test("accepts a thousands-grouped amount in EU convention (dot group, comma decimal)", () => {
    expect(
      decimalAmountToMinorUnits({ currency: "CZK", value: "1.234,56" })
    ).toBe(123_456)
  })

  test("accepts a trailing decimal separator with no fraction digits yet", () => {
    expect(decimalAmountToMinorUnits({ currency: "CZK", value: "12." })).toBe(
      1_200
    )
  })

  test("rejects values with too many decimal places", () => {
    expect(
      decimalAmountToMinorUnits({ currency: "CZK", value: "12.555" })
    ).toBe(null)
  })

  test("rejects zero, negative, invalid, and unsafe amounts", () => {
    expect(decimalAmountToMinorUnits({ currency: "CZK", value: "0" })).toBe(
      null
    )
    expect(decimalAmountToMinorUnits({ currency: "CZK", value: "-5" })).toBe(
      null
    )
    expect(
      decimalAmountToMinorUnits({ currency: "CZK", value: "twenty" })
    ).toBe(null)
    expect(
      decimalAmountToMinorUnits({
        currency: "CZK",
        value: "90071992547409.92",
      })
    ).toBe(null)
  })
})

describe("decimalPriceToMinorUnits", () => {
  test("takes a zero price, which an amount to charge refuses", () => {
    expect(decimalPriceToMinorUnits({ currency: "CZK", value: "0" })).toBe(0)
    expect(decimalPriceToMinorUnits({ currency: "CZK", value: "0,00" })).toBe(0)
    expect(decimalAmountToMinorUnits({ currency: "CZK", value: "0" })).toBe(
      null
    )
  })

  test("reads a positive price the way an amount is read", () => {
    expect(
      decimalPriceToMinorUnits({ currency: "CZK", value: " 1.234,5 " })
    ).toBe(123_450)
  })

  test("rejects a sign, invalid text and more fraction digits than the currency has", () => {
    expect(decimalPriceToMinorUnits({ currency: "CZK", value: "-5" })).toBe(
      null
    )
    expect(decimalPriceToMinorUnits({ currency: "CZK", value: "" })).toBe(null)
    expect(decimalPriceToMinorUnits({ currency: "CZK", value: "free" })).toBe(
      null
    )
    expect(decimalPriceToMinorUnits({ currency: "CZK", value: "1.234" })).toBe(
      null
    )
  })
})

describe("fiatToSats", () => {
  test("converts at the given rate", () => {
    // 1 BTC costs 2,000,000 CZK, so 20,000 CZK is 0.01 BTC.
    expect(fiatToSats({ fiatAmount: 20_000, exchangeRate: 2_000_000 })).toBe(
      1_000_000
    )
  })

  test("floors at one sat instead of rounding down to an amountless invoice", () => {
    // 0.01 CZK at this rate is 0.1 sats, which Math.round takes to zero.
    // Beware 0.5 sats as a test input: Math.round(0.5) is already 1, so it
    // passes whether or not the floor is there.
    expect(fiatToSats({ fiatAmount: 0.01, exchangeRate: 10_000_000 })).toBe(1)
  })

  test("rounds to the nearest sat", () => {
    expect(fiatToSats({ fiatAmount: 0.026, exchangeRate: 2_000_000 })).toBe(1)
    expect(fiatToSats({ fiatAmount: 0.031, exchangeRate: 2_000_000 })).toBe(2)
  })
})

describe("fiatMinorUnitsToSats", () => {
  test("divides by the currency's own minor-unit factor", () => {
    expect(
      fiatMinorUnitsToSats({
        amount: 2_000_000,
        currency: "CZK",
        exchangeRate: 2_000_000,
      })
    ).toBe(1_000_000)
  })

  test("keeps the one-sat floor for the smallest chargeable amount", () => {
    expect(
      fiatMinorUnitsToSats({
        amount: 1,
        currency: "CZK",
        exchangeRate: 10_000_000,
      })
    ).toBe(1)
  })
})

describe("satsToFiat", () => {
  test("inverts fiatToSats for an amount above the floor", () => {
    const fiatAmount = 20_000
    const exchangeRate = 2_000_000
    expect(
      satsToFiat({
        sats: fiatToSats({ fiatAmount, exchangeRate }),
        exchangeRate,
      })
    ).toBe(fiatAmount)
  })
})

describe("signedDecimalAmountToMinorUnits", () => {
  test("keeps the sign and zero, which a typed amount refuses", () => {
    expect(
      signedDecimalAmountToMinorUnits({ currency: "CZK", value: "-199,50" })
    ).toBe(-19_950)
    expect(
      signedDecimalAmountToMinorUnits({ currency: "CZK", value: "0" })
    ).toBe(0)
    expect(
      signedDecimalAmountToMinorUnits({ currency: "CZK", value: "-0" })
    ).toBe(0)
  })

  test("rounds a JSON number to the currency's fraction digits", () => {
    expect(
      signedDecimalAmountToMinorUnits({ currency: "EUR", value: 199.5 })
    ).toBe(19_950)
    expect(
      signedDecimalAmountToMinorUnits({ currency: "BTC", value: 0.5 })
    ).toBe(50_000_000)
  })

  test("refuses grouping and more fraction digits than the currency has", () => {
    for (const value of ["1,234.56", "1 234,56", "199.555", "abc", ""]) {
      expect(signedDecimalAmountToMinorUnits({ currency: "CZK", value })).toBe(
        null
      )
    }
  })
})

describe("roundMinorUnits", () => {
  test("rounds a half away from zero, a negative amount the mirror of its positive twin", () => {
    expect(roundMinorUnits(2.5)).toBe(3)
    expect(roundMinorUnits(-2.5)).toBe(-3)
    expect(roundMinorUnits(1_399.3)).toBe(1_399)
    expect(roundMinorUnits(-1_399.3)).toBe(-1_399)
    expect(roundMinorUnits(2_000.000_000_000_2)).toBe(2_000)
  })

  test("never hands back a negative zero", () => {
    expect(Object.is(roundMinorUnits(-0.2), 0)).toBe(true)
    expect(Object.is(roundMinorUnits(0), 0)).toBe(true)
  })

  test("still refuses an amount that is not a number", () => {
    expect(() => roundMinorUnits(Number.NaN)).toThrow()
  })
})
