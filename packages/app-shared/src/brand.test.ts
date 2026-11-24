import { describe, expect, test } from "vitest"
import { finitoBrand, paykyBrand } from "./brand.ts"
import { resources } from "./i18n/resources.ts"

describe("brand languages", () => {
  test("only Finito offers Vietnamese", () => {
    expect([...finitoBrand.languages].sort()).toEqual(
      Object.keys(resources).sort()
    )
    expect(paykyBrand.languages).toEqual(["en", "cs", "sk"])
  })
})
