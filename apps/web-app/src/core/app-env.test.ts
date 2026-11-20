import { afterEach, describe, expect, test, vi } from "vitest"

import { apiUrl, appEnv } from "./app-env.ts"

describe("appEnv", () => {
  test("leaves the EET production endpoint unset without configuration", () => {
    expect(appEnv.VITE_PAYKY_EET_PRODUCTION_URL).toBeUndefined()
  })

  test("publishes table self-pay to several relays by default", () => {
    expect(appEnv.VITE_PAYKY_SELF_PAY_RELAYS.length).toBeGreaterThanOrEqual(3)
    expect(appEnv.VITE_PAYKY_SELF_PAY_ORIGIN).toMatch(/^https:\/\//u)
  })
})

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("calls the API of the deployment the page was served from", () => {
    vi.stubGlobal("window", { location: { origin: "https://edge.payky.me" } })

    expect(apiUrl("/api/donations")).toBe("https://edge.payky.me/api/donations")
  })

  test("calls payky.me without a page to take the origin from", () => {
    expect(apiUrl("/api/donations")).toBe("https://payky.me/api/donations")
  })
})
