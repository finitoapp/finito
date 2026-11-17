import { expect, test } from "vitest"
import { numberFormat } from "./number-format.ts"

test("numberFormat builds one format per locale and options, and formats as Intl does", () => {
  const options = { style: "currency", currency: "CZK" } as const

  expect(numberFormat("cs-CZ", options)).toBe(
    numberFormat("cs-CZ", { style: "currency", currency: "CZK" })
  )
  expect(numberFormat("cs-CZ", options)).not.toBe(
    numberFormat("en-US", options)
  )
  expect(numberFormat("cs-CZ", options).format(120)).toBe(
    new Intl.NumberFormat("cs-CZ", options).format(120)
  )
  expect(() =>
    numberFormat("en-US", { style: "currency", currency: "X" })
  ).toThrow()
})
