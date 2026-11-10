import { describe, expect, test } from "vitest"
import {
  createTestInvoice,
  createTestSparkInvoice,
  testSparkIdentity,
} from "../shared/lightning-invoice-test-fixtures.ts"
import { parseWithdrawDestination } from "./withdraw-destination-utils.ts"

const onchainAddress = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"

describe("parseWithdrawDestination", () => {
  test("recognizes a bare on-chain address", () => {
    expect(parseWithdrawDestination(` ${onchainAddress} `)).toEqual({
      ok: true,
      value: { kind: "onchain", address: onchainAddress },
    })
  })

  test("reads the amount of a BIP21 URI without a lightning parameter", () => {
    expect(
      parseWithdrawDestination(`bitcoin:${onchainAddress}?amount=0.0001`)
    ).toEqual({
      ok: true,
      value: { kind: "onchain", address: onchainAddress, amountSats: 10_000 },
    })
  })

  test("reads an upper-case BIP21 QR code as the lower-case address", () => {
    expect(
      parseWithdrawDestination(`BITCOIN:${onchainAddress.toUpperCase()}`)
    ).toEqual({
      ok: true,
      value: { kind: "onchain", address: onchainAddress },
    })
    expect(parseWithdrawDestination(onchainAddress.toUpperCase())).toEqual({
      ok: true,
      value: { kind: "onchain", address: onchainAddress },
    })
  })

  test("refuses a BIP21 URI with a req- parameter, even with an invoice", () => {
    const invoice = createTestInvoice({ hrp: "lnbc10u" })
    expect(
      parseWithdrawDestination(
        `bitcoin:${onchainAddress}?req-pop=1&lightning=${invoice}`
      )
    ).toMatchObject({
      ok: false,
      error: { type: "InvalidWithdrawDestination" },
    })
  })

  test("prefers the invoice of a BIP21 URI with a lightning parameter", () => {
    const invoice = createTestInvoice({ hrp: "lnbc10u" })
    const result = parseWithdrawDestination(
      `bitcoin:${onchainAddress}?amount=0.00001&lightning=${invoice}`
    )

    expect(result).toMatchObject({
      ok: true,
      value: { kind: "lightning-invoice", invoice, amountSats: 1000 },
    })
  })

  test("reads a mainnet invoice without an amount (lnbc1…)", () => {
    const invoice = createTestInvoice({ description: "Coffee" })

    expect(parseWithdrawDestination(`lightning:${invoice}`)).toEqual({
      ok: true,
      value: {
        kind: "lightning-invoice",
        invoice,
        amountMsat: null,
        amountSats: null,
        description: "Coffee",
        paymentHash: "11".repeat(32),
        createdAt: 1_780_000_000 * 1000,
        expiresAt: (1_780_000_000 + 3600) * 1000,
        sparkFallbackIdentity: null,
      },
    })
  })

  test("reads a mainnet invoice with an amount (lnbc10u1…) and its expiry", () => {
    const invoice = createTestInvoice({ hrp: "lnbc10u", expirySeconds: 600 })

    expect(parseWithdrawDestination(invoice.toUpperCase())).toMatchObject({
      ok: true,
      value: {
        amountSats: 1000,
        expiresAt: (1_780_000_000 + 600) * 1000,
      },
    })
  })

  test("rounds a millisatoshi amount up to whole sats", () => {
    expect(
      parseWithdrawDestination(createTestInvoice({ hrp: "lnbc15n" }))
    ).toMatchObject({ ok: true, value: { amountSats: 2 } })
  })

  test("rejects a regtest invoice (lnbcrt…) as the wrong network", () => {
    expect(
      parseWithdrawDestination(createTestInvoice({ hrp: "lnbcrt10u" }))
    ).toEqual({ ok: false, error: { type: "LightningInvoiceWrongNetwork" } })
  })

  test.each(["lntb10u", "lntbs10u"])(
    "rejects a %s invoice as the wrong network",
    (hrp) => {
      expect(parseWithdrawDestination(createTestInvoice({ hrp }))).toEqual({
        ok: false,
        error: { type: "LightningInvoiceWrongNetwork" },
      })
    }
  )

  test("reads the Spark identity from a Spark invoice fallback, as Payky's own invoices carry it", () => {
    const invoice = createTestInvoice({
      hrp: "lnbc10u",
      sparkFallback: { via: "fallback-address", identity: testSparkIdentity },
    })

    expect(parseWithdrawDestination(invoice)).toMatchObject({
      ok: true,
      value: { sparkFallbackIdentity: testSparkIdentity },
    })
  })

  test("reads the Spark identity from a Spark route hint", () => {
    const invoice = createTestInvoice({
      sparkFallback: { via: "route-hint", identity: testSparkIdentity },
    })

    expect(parseWithdrawDestination(invoice)).toMatchObject({
      ok: true,
      value: { sparkFallbackIdentity: testSparkIdentity },
    })
  })

  test.each(["lnbits@getalby.com", "lightning:LNurl@example.com"])(
    "recognizes a Lightning address whose name starts with ln: %s",
    (input) => {
      expect(parseWithdrawDestination(input)).toMatchObject({
        ok: true,
        value: { kind: "lightning-address" },
      })
    }
  )

  test("recognizes a Lightning address", () => {
    expect(parseWithdrawDestination("Alice@Example.com")).toEqual({
      ok: true,
      value: { kind: "lightning-address", address: "alice@example.com" },
    })
  })

  test.each([
    createTestSparkInvoice(testSparkIdentity),
    `spark:${createTestSparkInvoice(testSparkIdentity)}`,
  ])("refuses a Spark destination %#", (raw) => {
    expect(parseWithdrawDestination(raw)).toEqual({
      ok: true,
      value: { kind: "unsupported", reason: "spark" },
    })
  })

  test.each([
    "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns",
    "lightning:LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS",
    // The Lightning address LNURL below with its last character mistyped.
    "lnurl1dp68gurn8ghj7urjd9kkzmpwdejhgtewwajkcmpdddhx7amw9akxuatjd3cz7emjv4jkuetdw56qzlflnq",
  ])("refuses an LNURL that is no Lightning address %#", (raw) => {
    expect(parseWithdrawDestination(raw)).toEqual({
      ok: true,
      value: { kind: "unsupported", reason: "lnurl" },
    })
  })

  test.each([
    "lnurl1dp68gurn8ghj7urjd9kkzmpwdejhgtewwajkcmpdddhx7amw9akxuatjd3cz7emjv4jkuetdw56qzlflny",
    "lightning:lnurl1dp68gurn8ghj7urjd9kkzmpwdejhgtewwajkcmpdddhx7amw9akxuatjd3cz7emjv4jkuetdw56qzlflny",
    "LIGHTNING:LNURL1DP68GURN8GHJ7URJD9KKZMPWDEJHGTEWWAJKCMPDDDHX7AMW9AKXUATJD3CZ7EMJV4JKUETDW56QZLFLNY",
  ])(
    "reads an LNURL encoding a Lightning address as that address %#",
    (raw) => {
      expect(parseWithdrawDestination(raw)).toEqual({
        ok: true,
        value: { kind: "lightning-address", address: "greenemu4@primal.net" },
      })
    }
  )

  test("rejects text that is no destination", () => {
    expect(parseWithdrawDestination("hello")).toEqual({
      ok: false,
      error: { type: "InvalidWithdrawDestination" },
    })
  })
})
