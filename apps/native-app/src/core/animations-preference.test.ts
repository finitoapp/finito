import { describe, expect, test } from "vitest"
import {
  defaultAnimations,
  resolveReduceMotion,
} from "./animations-preference.ts"

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

describe("defaultAnimations", () => {
  test("a card terminal starts without animations", () => {
    // PAX A920Pro and NEXGO N92, whose brand is "alps".
    expect(defaultAnimations("PAX")).toBe("off")
    expect(defaultAnimations("NEXGO")).toBe("off")
  })

  test("any other device follows the system", () => {
    expect(defaultAnimations("asus")).toBe("system")
    expect(defaultAnimations("")).toBe("system")
  })
})
