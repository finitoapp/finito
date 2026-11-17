import { describe, expect, test } from "vitest"
import { getRetryTicks } from "./retry-ticks.ts"

describe("getRetryTicks", () => {
  test("doubles the ticks to wait up to 15 minutes", () => {
    expect(getRetryTicks(300_000, 1)).toBe(1)
    expect(getRetryTicks(300_000, 2)).toBe(2)
    expect(getRetryTicks(300_000, 3)).toBe(3)
    expect(getRetryTicks(300_000, 10)).toBe(3)
    expect(getRetryTicks(30_000, 10)).toBe(30)
  })

  test("waits at least the next tick when the interval exceeds the cap", () => {
    expect(getRetryTicks(20 * 60_000, 5)).toBe(1)
  })
})
