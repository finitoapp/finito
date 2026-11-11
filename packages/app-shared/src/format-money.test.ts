import { Integer } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import {
  formatMoneyParts,
  formatMoney as formatMoneyRaw,
} from "./format-money.ts"

/** Intl writes no-break spaces; the expectations below use plain ones. */
const formatMoney = (...args: Parameters<typeof formatMoneyRaw>) =>
  formatMoneyRaw(...args).replace(/\u00a0/gu, " ")

describe("formatMoney", () => {
  test("writes the currency's digits by default", () => {
    expect(
      formatMoney({ value: Integer(12000), currency: "CZK" }, "cs-CZ")
    ).toBe("120,00 Kč")
  })

  test("leaves a whole amount whole when asked, keeping a fraction that is there", () => {
    const whenNonZero = { fraction: "whenNonZero" } as const
    expect(
      formatMoney(
        { value: Integer(12000), currency: "CZK" },
        "cs-CZ",
        whenNonZero
      )
    ).toBe("120 Kč")
    expect(
      formatMoney(
        { value: Integer(12050), currency: "CZK" },
        "cs-CZ",
        whenNonZero
      )
    ).toBe("120,50 Kč")
    expect(
      formatMoney(
        { value: Integer(500), currency: "USD" },
        "en-US",
        whenNonZero
      )
    ).toBe("$5")
  })

  test("writes a discount below zero with its sign", () => {
    expect(
      formatMoney({ value: Integer(-1_500), currency: "CZK" }, "cs-CZ")
    ).toMatch(/^-15,00 Kč$/u)
    expect(
      formatMoney({ value: Integer(-1_500), currency: "CZK" }, "cs-CZ", {
        fraction: "whenNonZero",
      })
    ).toMatch(/^-15 Kč$/u)
  })
})

describe("formatMoneyParts", () => {
  const parts = (...args: Parameters<typeof formatMoneyParts>) => {
    const result = formatMoneyParts(...args)
    return { ...result, text: result.text.replace(/ /gu, " ") }
  }

  test("splits the unit off where the locale puts it", () => {
    expect(
      parts({ value: Integer(12000), currency: "CZK" }, "cs-CZ", {
        fraction: "whenNonZero",
      })
    ).toEqual({ number: "120", unit: "Kč", unitFirst: false, text: "120 Kč" })
    expect(
      parts({ value: Integer(500), currency: "USD" }, "en-US", {
        fraction: "whenNonZero",
      })
    ).toEqual({ number: "5", unit: "$", unitFirst: true, text: "$5" })
  })

  test("keeps the fraction and the grouping in the number", () => {
    const result = parts({ value: Integer(123450), currency: "CZK" }, "cs-CZ", {
      fraction: "whenNonZero",
    })
    expect(result.number.replace(/ /gu, " ")).toBe("1 234,50")
    expect(result.unit).toBe("Kč")
  })
})
