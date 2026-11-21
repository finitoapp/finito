import { bech32 } from "@scure/base"
import { describe, expect, test } from "vitest"
import {
  lnurlToLightningAddress,
  parseLightningAddress,
} from "./lightning-address-utils.ts"

describe("parseLightningAddress", () => {
  test("trims and lowercases an address", () => {
    expect(parseLightningAddress("  Shop@GetAlby.com ")).toBe(
      "shop@getalby.com"
    )
  })

  test("drops a lightning: scheme", () => {
    expect(parseLightningAddress("lightning:shop@blink.sv")).toBe(
      "shop@blink.sv"
    )
  })

  test("rejects what is not an address", () => {
    expect(parseLightningAddress("shop")).toBeNull()
    expect(parseLightningAddress("shop@localhost")).toBeNull()
    expect(parseLightningAddress("lnbc10n1…")).toBeNull()
  })
})

describe("lnurlToLightningAddress", () => {
  const lnurl = (url: string) =>
    bech32.encode("lnurl", bech32.toWords(new TextEncoder().encode(url)), false)

  test("decodes a LUD-16 URL to its address", () => {
    expect(
      lnurlToLightningAddress(lnurl("https://x.com/.well-known/lnurlp/Shop"))
    ).toBe("shop@x.com")
  })

  test("rejects a malformed escape instead of throwing", () => {
    expect(
      lnurlToLightningAddress(lnurl("https://x.com/.well-known/lnurlp/%zz"))
    ).toBeNull()
  })
})
