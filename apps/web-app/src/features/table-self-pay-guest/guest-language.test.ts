import { describe, expect, test } from "vitest"

import { resolveGuestLanguage } from "./guest-language.tsx"

describe("resolveGuestLanguage", () => {
  test("opens in Czech for a browser that prefers Czech", () => {
    expect(resolveGuestLanguage(null, ["cs-CZ", "en-US"])).toBe("cs")
  })

  test("opens in English for a browser that prefers only German", () => {
    expect(resolveGuestLanguage(null, ["de-DE", "de"])).toBe("en")
  })

  test("opens in the language the guest picked before, whatever the browser prefers", () => {
    expect(resolveGuestLanguage(JSON.stringify("sk"), ["cs-CZ"])).toBe("sk")
  })

  test("falls back to the browser when the stored language is not offered", () => {
    expect(resolveGuestLanguage(JSON.stringify("de"), ["cs-CZ"])).toBe("cs")
    expect(resolveGuestLanguage("not json", ["cs-CZ"])).toBe("cs")
  })
})
