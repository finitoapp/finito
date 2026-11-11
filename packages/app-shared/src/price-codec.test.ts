import { Integer } from "@payky/core/modules/shared/schema"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createPriceCodec } from "./catalog-item-form-schema.ts"

describe("createPriceCodec", () => {
  const codec = createPriceCodec({ currency: "CZK", discount: false })

  it("decodes a decimal amount into minor units", () => {
    expect(z.safeDecode(codec, "12.50").data).toBe(1250)
    expect(z.safeDecode(codec, "12,50").data).toBe(1250)
    expect(z.safeDecode(codec, "1").data).toBe(100)
  })

  it("rejects an amount the currency cannot hold", () => {
    expect(z.safeDecode(codec, "12.505").success).toBe(false)
    expect(z.safeDecode(codec, "abc").success).toBe(false)
    expect(z.safeDecode(codec, "-1").success).toBe(false)
    expect(z.safeDecode(codec, "").success).toBe(false)
  })

  it("decodes a zero price", () => {
    expect(z.safeDecode(codec, "0").data).toBe(0)
  })

  it("encodes minor units back to the decimal the input shows", () => {
    expect(z.encode(codec, Integer(1250))).toBe("12.5")
    expect(z.encode(codec, Integer(100))).toBe("1")
  })
})

describe("createPriceCodec for a discount", () => {
  const codec = createPriceCodec({ currency: "CZK", discount: true })

  // The sign was set when the discount was created and stays (catalog/0002):
  // the field shows and takes the amount alone.
  it("shows the amount without its sign", () => {
    expect(z.encode(codec, Integer(-1250))).toBe("12.5")
  })

  it("keeps the sign of what is typed", () => {
    expect(z.safeDecode(codec, "15").data).toBe(-1500)
  })

  it("refuses a discount of nothing and a typed sign", () => {
    expect(z.safeDecode(codec, "0").success).toBe(false)
    expect(z.safeDecode(codec, "-15").success).toBe(false)
  })
})
