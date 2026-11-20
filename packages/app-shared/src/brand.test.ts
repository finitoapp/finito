import { describe, expect, test } from "vitest"

import { brandOfSelfPayHost, finitoBrand, paykyBrand } from "./brand.ts"

describe("brandOfSelfPayHost", () => {
  test("names the brand whose guest host the page runs on", () => {
    expect(brandOfSelfPayHost("t.finito.fit")).toBe(finitoBrand)
    expect(brandOfSelfPayHost("t.payky.me")).toBe(paykyBrand)
  })

  test("names Payky on a host no brand serves, as a preview or dev server", () => {
    expect(brandOfSelfPayHost("t.payky.agora.gripe")).toBe(paykyBrand)
    expect(brandOfSelfPayHost("localhost:5173")).toBe(paykyBrand)
  })
})
