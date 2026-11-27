import { describe, expect, test } from "vitest"
import { resolveReduceMotion } from "./animations-preference.ts"

describe("resolveReduceMotion", () => {
  test("follows the system's reduce-motion setting by default", () => {
    expect(resolveReduceMotion("system", false)).toBe(false)
    expect(resolveReduceMotion("system", true)).toBe(true)
  })

  test("on animates and off does not, whatever the system says", () => {
    expect(resolveReduceMotion("on", true)).toBe(false)
    expect(resolveReduceMotion("off", false)).toBe(true)
  })
})
