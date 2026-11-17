import { describe, expect, test } from "vitest"

import {
  defaultDeviceName,
  getPreferredDeviceLanguage,
} from "./device-utils.ts"

describe("getPreferredDeviceLanguage", () => {
  test("matches Czech locale variants", () => {
    expect(getPreferredDeviceLanguage("cs")).toBe("cs")
    expect(getPreferredDeviceLanguage("cs-CZ")).toBe("cs")
  })

  test("matches Slovak locale variants", () => {
    expect(getPreferredDeviceLanguage("sk")).toBe("sk")
    expect(getPreferredDeviceLanguage("sk-SK")).toBe("sk")
  })

  test("falls back to English for any other locale", () => {
    expect(getPreferredDeviceLanguage("en")).toBe("en")
    expect(getPreferredDeviceLanguage("en-US")).toBe("en")
    expect(getPreferredDeviceLanguage("de-DE")).toBe("en")
    expect(getPreferredDeviceLanguage("")).toBe("en")
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
