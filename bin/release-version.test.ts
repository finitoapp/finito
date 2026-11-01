import { describe, expect, test } from "vitest"

import { nextReleaseVersion } from "./release-version.ts"

describe("nextReleaseVersion", () => {
  const october = new Date(2026, 9, 6)

  test("starts a month at 0", () => {
    expect(nextReleaseVersion(["v26.9.4"], october)).toBe("26.10.0")
  })

  test("follows a month's first release with 1", () => {
    expect(nextReleaseVersion(["v26.10.0"], october)).toBe("26.10.1")
  })

  test("counts on from the month's highest release", () => {
    expect(
      nextReleaseVersion(["v26.10.1", "v26.10.10", "v26.10.2"], october)
    ).toBe("26.10.11")
  })

  test("ignores tags that are not releases", () => {
    expect(
      nextReleaseVersion(["canary-22", "v26.10.3-rc", "v6.10.5"], october)
    ).toBe("26.10.0")
  })
})
