import { beforeEach, describe, expect, it, vi } from "vitest"

const native = vi.hoisted(() => ({
  module: null as null | {
    readonly qrPath: (text: string) => { size: number; path: string }
  },
}))
vi.mock("expo", () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => native.module,
}))

const loadQrPath = async () => {
  vi.resetModules()
  return (await import("./qr-matrix.ts")).qrPath
}

const invoice =
  "lnbc110n1p5w4gq7pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdqqcqzzsxqyz5vqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qxpqysgq"

describe("qrPath without the native encoder", () => {
  beforeEach(() => {
    native.module = null
  })

  it("draws a square code with dark modules for a SPAYD payload", async () => {
    const qrPath = await loadQrPath()
    const { size, path } = qrPath(
      "SPD*1.0*ACC:CZ6508000000192000145399*AM:129.00*CC:CZK"
    )
    expect(size).toBeGreaterThanOrEqual(21)
    expect(path.startsWith("M")).toBe(true)
    // The top-left finder pattern starts at the origin.
    expect(path).toContain("M0 0h1v1h-1z")
  })

  it("encodes a Lightning invoice uppercase, in fewer modules", async () => {
    const qrPath = await loadQrPath()
    const { encode } = await import("uqr")
    expect(qrPath(invoice).size).toBe(
      encode(invoice.toUpperCase(), { ecc: "M", border: 0 }).size
    )
    expect(qrPath(invoice).size).toBeLessThan(
      encode(invoice, { ecc: "M", border: 0 }).size
    )
  })

  it("reuses a recent value's path and forgets the oldest past eight", async () => {
    const qrPath = await loadQrPath()
    const first = qrPath("cache-0")
    expect(qrPath("cache-0")).toBe(first)
    for (let index = 1; index <= 8; index++) qrPath(`cache-${index}`)
    expect(qrPath("cache-0")).not.toBe(first)
    expect(qrPath("cache-0")).toEqual(first)
  })
})

describe("qrPath with the native encoder", () => {
  const encoded = vi.fn((text: string) => ({ size: 21, path: `M0 0h${text}` }))

  beforeEach(() => {
    encoded.mockClear()
    native.module = { qrPath: encoded }
  })

  it("hands a Lightning invoice to it uppercase", async () => {
    const qrPath = await loadQrPath()
    expect(qrPath(invoice)).toEqual({
      size: 21,
      path: `M0 0h${invoice.toUpperCase()}`,
    })
    expect(encoded).toHaveBeenCalledWith(invoice.toUpperCase())
  })

  it("hands other ASCII text to it as it is", async () => {
    const qrPath = await loadQrPath()
    const token = "cashuBo2FteBtodHRwczovL21pbnQuZXhhbXBsZS5jb20"
    qrPath(token)
    expect(encoded).toHaveBeenCalledWith(token)
  })

  it("leaves text beyond ASCII to the JS encoder, whose bytes it keeps", async () => {
    const qrPath = await loadQrPath()
    const { size, path } = qrPath(
      "SPD*1.0*ACC:CZ6508000000192000145399*AM:129.00*CC:CZK*RN:Kavárna U Lípy"
    )
    expect(encoded).not.toHaveBeenCalled()
    expect(size).toBeGreaterThanOrEqual(21)
    expect(path).toContain("M0 0h1v1h-1z")
  })
})
