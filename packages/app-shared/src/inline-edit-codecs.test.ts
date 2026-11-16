import {
  NonEmptyString255,
  PositiveInteger,
} from "@payky/core/modules/shared/schema"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  NO_OPTION,
  nonNegativeIntegerCodec,
  optionalDateCodec,
  optionalIdCodec,
  optionalPositiveIntegerCodec,
  optionalTextCodec,
  requiredTextCodec,
} from "./inline-edit-codecs.ts"

/**
 * `z.encode` runs the codec's output schema backwards, which throws on a
 * `.transform()`. Every codec here is therefore checked in both directions,
 * not only the decode one the save path exercises.
 */
describe("requiredTextCodec", () => {
  it("decodes trimmed text and rejects blanks", () => {
    expect(z.safeDecode(requiredTextCodec, "  Table 5 ").data).toBe("Table 5")
    expect(z.safeDecode(requiredTextCodec, "   ").success).toBe(false)
    expect(z.safeDecode(requiredTextCodec, "").success).toBe(false)
  })

  it("encodes back to the text the input shows", () => {
    expect(z.encode(requiredTextCodec, NonEmptyString255("Table 5"))).toBe(
      "Table 5"
    )
  })
})

describe("optionalTextCodec", () => {
  it("treats blank as not set", () => {
    expect(z.safeDecode(optionalTextCodec, "   ").data).toBeNull()
    expect(z.safeDecode(optionalTextCodec, " SKU-1 ").data).toBe("SKU-1")
  })

  it("encodes not set back to an empty input", () => {
    expect(z.encode(optionalTextCodec, null)).toBe("")
    expect(z.encode(optionalTextCodec, NonEmptyString255("SKU-1"))).toBe(
      "SKU-1"
    )
  })
})

describe("optionalIdCodec", () => {
  const codec = optionalIdCodec<"abc">()

  it("maps the no-option value to null and back", () => {
    expect(z.safeDecode(codec, NO_OPTION).data).toBeNull()
    expect(z.safeDecode(codec, "abc").data).toBe("abc")
    expect(z.encode(codec, null)).toBe(NO_OPTION)
    expect(z.encode(codec, "abc")).toBe("abc")
  })
})

describe("nonNegativeIntegerCodec and optionalDateCodec", () => {
  it("accepts digits only", () => {
    expect(z.safeDecode(nonNegativeIntegerCodec, " 12 ").data).toBe(12)
    expect(z.safeDecode(nonNegativeIntegerCodec, "1e3").success).toBe(false)
    expect(z.safeDecode(nonNegativeIntegerCodec, "").success).toBe(false)
  })

  it("treats a blank date as not set", () => {
    expect(z.safeDecode(optionalDateCodec, " ").data).toBeNull()
    expect(z.safeDecode(optionalDateCodec, "2026-10-01").success).toBe(true)
    expect(z.safeDecode(optionalDateCodec, "yesterday").success).toBe(false)
  })
})

describe("optionalPositiveIntegerCodec", () => {
  it("treats blank as not set and still rejects anything but a whole count", () => {
    expect(z.safeDecode(optionalPositiveIntegerCodec, "  ").data).toBeNull()
    expect(z.safeDecode(optionalPositiveIntegerCodec, " 4 ").data).toBe(4)
    expect(z.safeDecode(optionalPositiveIntegerCodec, "0").success).toBe(false)
    expect(z.safeDecode(optionalPositiveIntegerCodec, "1.5").success).toBe(
      false
    )
  })

  it("encodes not set back to an empty input", () => {
    expect(z.encode(optionalPositiveIntegerCodec, null)).toBe("")
    expect(z.encode(optionalPositiveIntegerCodec, PositiveInteger(4))).toBe("4")
  })
})
