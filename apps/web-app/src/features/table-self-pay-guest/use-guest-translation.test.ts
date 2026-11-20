import { describe, expect, test } from "vitest"

import { translateForGuest } from "./use-guest-translation.ts"

describe("translateForGuest", () => {
  test.each([
    ["a replacement pattern", "Rum $& Cola"],
    ["another param's placeholder", "{amount}"],
  ])("fills a name with %s exactly as typed", (_name, name) => {
    expect(
      translateForGuest("en", "selfPay.line.units.label", { name, amount: 5 })
    ).toBe(`Units of ${name}`)
  })
})
