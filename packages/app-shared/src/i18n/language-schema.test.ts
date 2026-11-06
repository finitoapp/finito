import { describe, expect, test } from "vitest"
import { LanguageSchema } from "./language-schema.ts"
import { resources } from "./resources.ts"

describe("LanguageSchema", () => {
  test("accepts every language the app is translated into", () => {
    expect([...LanguageSchema.options].sort()).toEqual(
      Object.keys(resources).sort()
    )
  })

  test("refuses anything else, such as a landing link's unknown or missing language", () => {
    for (const value of ["de", "CS", "", undefined, ["cs"]]) {
      expect(LanguageSchema.safeParse(value).success).toBe(false)
    }
  })
})
