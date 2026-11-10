import { describe, expect, test } from "vitest"
import { paykyBrand } from "../brand.ts"
import { createTranslate } from "./translate.ts"

const t = createTranslate("en", paykyBrand)

describe("createTranslate", () => {
  test.each([
    ["a replacement pattern", "$& $` $' $1"],
    ["another param's placeholder", "{number}"],
    ["markup", "<b>pivo</b>"],
  ])(
    "fills a value of %s exactly as typed, and leaves the other params alone",
    (_name, table) => {
      expect(t("orders.announced", { number: 7, table })).toBe(
        `New order 7 · ${table}`
      )
    }
  )

  test("does not fill a param into the value of one filled before it", () => {
    expect(t("orders.announced", { number: "{table}", table: "Bar" })).toBe(
      "New order {table} · Bar"
    )
  })
})
