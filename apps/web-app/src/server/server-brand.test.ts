import { brandName, brands } from "@payky/app-shared/brand"
import { afterEach, describe, expect, test, vi } from "vitest"
import { loadServerBrandName, serverBrandNames } from "./server-brand.ts"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("server brand", () => {
  test("names each brand as the brand itself does", () => {
    expect(serverBrandNames).toEqual(
      Object.fromEntries(
        Object.entries(brands).map(([id, brand]) => [id, brandName(brand)])
      )
    )
  })

  test("serves the brand PAYKY_BRAND names, Payky when unset", () => {
    vi.stubEnv("PAYKY_BRAND", "")
    expect(loadServerBrandName()).toBe("Payky")
    vi.stubEnv("PAYKY_BRAND", "finito")
    expect(loadServerBrandName()).toBe("Finito")
  })

  test("names no app for an unknown brand", () => {
    vi.stubEnv("PAYKY_BRAND", "linky")
    expect(loadServerBrandName()).toBeNull()
  })
})
