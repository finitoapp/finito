import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  monetaCheckIntervalCodec,
  parseMonetaToken,
} from "./moneta-plugin-form.ts"

describe("parseMonetaToken", () => {
  it("drops whitespace a copy from the bank may bring along", () => {
    expect(parseMonetaToken("  abc\n123  ")).toMatchObject({
      ok: true,
      token: "abc123",
    })
  })

  it("asks for a token when blank", () => {
    expect(parseMonetaToken("   ")).toEqual({
      ok: false,
      errorKey: "settings.monetaPlugin.token.required",
    })
  })
})

describe("monetaCheckIntervalCodec", () => {
  it("takes a whole number of seconds, a minute at least", () => {
    expect(z.safeDecode(monetaCheckIntervalCodec, "60").data).toBe(60)
    expect(z.safeDecode(monetaCheckIntervalCodec, "59").success).toBe(false)
    expect(z.safeDecode(monetaCheckIntervalCodec, "1e3").success).toBe(false)
  })
})
