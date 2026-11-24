import { describe, expect, test } from "vitest"

import {
  defaultDeviceName,
  getPreferredDeviceLanguage,
} from "./device-utils.ts"

const offered = ["en", "cs", "sk"] as const

describe("getPreferredDeviceLanguage", () => {
  test("matches Czech locale variants", () => {
    expect(getPreferredDeviceLanguage("cs", offered)).toBe("cs")
    expect(getPreferredDeviceLanguage("cs-CZ", offered)).toBe("cs")
  })

  test("matches Slovak locale variants", () => {
    expect(getPreferredDeviceLanguage("sk", offered)).toBe("sk")
    expect(getPreferredDeviceLanguage("sk-SK", offered)).toBe("sk")
  })

  test("matches a language only where the app offers it", () => {
    expect(getPreferredDeviceLanguage("vi-VN", [...offered, "vi"])).toBe("vi")
    expect(getPreferredDeviceLanguage("vi-VN", offered)).toBe("en")
  })

  test("falls back to English for any other locale", () => {
    expect(getPreferredDeviceLanguage("en", offered)).toBe("en")
    expect(getPreferredDeviceLanguage("en-US", offered)).toBe("en")
    expect(getPreferredDeviceLanguage("de-DE", offered)).toBe("en")
    expect(getPreferredDeviceLanguage("", offered)).toBe("en")
  })
})

describe("defaultDeviceName", () => {
  test("names a device by its maker and model", () => {
    expect(
      defaultDeviceName({
        vendor: "samsung",
        model: "SM-A546B",
        browserName: null,
        osName: "Android",
      })
    ).toBe("Samsung SM-A546B")
    expect(
      defaultDeviceName({
        vendor: "Apple",
        model: "Apple iPhone",
        browserName: "Safari",
        osName: "iOS",
      })
    ).toBe("Apple iPhone")
  })

  test("names a device without a model by its browser and system", () => {
    expect(
      defaultDeviceName({
        vendor: undefined,
        model: undefined,
        browserName: "Chrome",
        osName: "macOS",
      })
    ).toBe("Chrome · macOS")
  })

  test("leaves a device it knows nothing about to the random name", () => {
    expect(
      defaultDeviceName({
        vendor: null,
        model: null,
        browserName: null,
        osName: null,
      })
    ).toBeNull()
  })
})
