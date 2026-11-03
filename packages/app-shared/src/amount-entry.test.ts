import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import { describe, expect, it } from "vitest"
import {
  type AmountKeypadKey,
  applyAmountKey,
  formatAmountInput,
  formatAmountInputParts,
} from "./amount-entry.ts"

const type = (keys: string, currency: "CZK" | "BTC" = "CZK") =>
  [...keys].reduce(
    (current, key) => applyAmountKey(current, key as AmountKeypadKey, currency),
    ""
  )

describe("applyAmountKey", () => {
  it("appends digits, ignores a leading zero and deletes the last key", () => {
    expect(type("007")).toBe("7")
    expect(type("12<")).toBe("1")
    expect(type("<")).toBe("")
  })

  it("starts a decimal with 0. and accepts one separator", () => {
    expect(type(".")).toBe("0.")
    expect(type("1.2.")).toBe("1.2")
  })

  it("caps decimals at the currency's fraction digits", () => {
    expect(type("1.234")).toBe("1.23")
    expect(type("1.123456789", "BTC")).toBe("1.12345678")
  })

  it("caps the integer part at nine digits", () => {
    expect(type("1234567890")).toBe("123456789")
  })

  it("converts to minor units through money.ts", () => {
    expect(
      decimalAmountToMinorUnits({ currency: "CZK", value: type("12.5") })
    ).toBe(1250)
  })
})

describe("formatAmountInput", () => {
  it("keeps a trailing decimal separator in the locale", () => {
    expect(formatAmountInput("1234.", "CZK", "en-US")).toMatch(/^CZK\s1,234\.$/)
    expect(formatAmountInput("", "USD", "en-US")).toBe("$0")
  })
})

describe("formatAmountInputParts", () => {
  it("splits the number from the currency and says which comes first", () => {
    expect(formatAmountInputParts("1234.", "CZK", "en-US")).toEqual({
      number: "1,234.",
      unit: "CZK",
      unitFirst: true,
    })
    expect(formatAmountInputParts("", "USD", "en-US")).toEqual({
      number: "0",
      unit: "$",
      unitFirst: true,
    })
    expect(formatAmountInputParts("12.5", "CZK", "cs-CZ")).toEqual({
      number: "12,5",
      unit: "Kč",
      unitFirst: false,
    })
  })
})
