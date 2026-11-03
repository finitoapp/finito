import { Integer } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { formatMoney as formatMoneyRaw } from "./format-money.ts"

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
})
