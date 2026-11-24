import { describe, expect, test } from "vitest"

import { uint8ArrayToBase64 } from "./save-file.ts"

describe("uint8ArrayToBase64", () => {
  test("encodes a short byte sequence", () => {
    expect(uint8ArrayToBase64(new Uint8Array([72, 101, 108, 108, 111]))).toBe(
      "SGVsbG8="
    )
  })

  test("survives inputs spanning several chunks", () => {
    // 0x8000 is the chunk width, so this crosses the boundary three times —
    // the one thing the chunking can get wrong.
    const bytes = Uint8Array.from(
      { length: 100_000 },
      (_, index) => index % 256
    )

    const decoded = atob(uint8ArrayToBase64(bytes))

    expect(decoded.length).toBe(bytes.length)
    expect(
      Uint8Array.from(decoded, (character) => character.charCodeAt(0))
    ).toEqual(bytes)
  })
})
