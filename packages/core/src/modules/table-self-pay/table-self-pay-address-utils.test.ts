import { describe, expect, test } from "vitest"
import {
  createRandomText,
  createSeededRandom,
} from "../../testing/seeded-random.ts"
import { WssUrl } from "../shared/schema.ts"

import {
  createTableSelfPayAddress,
  parseTableSelfPayAddress,
} from "./table-self-pay-address-utils.ts"

const keys = {
  publicKey: Uint8Array.from({ length: 32 }, (_, index) => index),
  viewKey: Uint8Array.from({ length: 32 }, (_, index) => 255 - index),
}
const onDefaultRelays = { ...keys, relays: [] }

describe("table self-pay address", () => {
  test("round-trips both keys through the QR address", () => {
    const address = createTableSelfPayAddress(
      "https://t.example",
      onDefaultRelays
    )

    expect(address).toMatch(/^https:\/\/t\.example\/t#1\.[\w-]{86}$/u)
    expect(parseTableSelfPayAddress(address)).toEqual(onDefaultRelays)
  })

  test("builds the address from an origin written with a trailing slash", () => {
    const address = createTableSelfPayAddress(
      "https://t.example/",
      onDefaultRelays
    )

    expect(address).toMatch(/^https:\/\/t\.example\/t#1\./u)
    expect(parseTableSelfPayAddress(address)).toEqual(onDefaultRelays)
  })

  test("names the relays after the keys only when they are not the defaults", () => {
    const relays = [
      WssUrl("wss://relay.example.com"),
      WssUrl("wss://relay.example.com:7447/nostr"),
    ]
    const address = createTableSelfPayAddress("https://t.example", {
      ...keys,
      relays,
    })

    expect(address).toMatch(
      /#1\.[\w-]{86}\.relay\.example\.com,relay\.example\.com%3A7447%2Fnostr$/u
    )
    expect(parseTableSelfPayAddress(address)).toEqual({ ...keys, relays })
  })

  test("keeps the keys in the fragment, which never reaches a server", () => {
    const url = new URL(
      createTableSelfPayAddress("https://t.example", onDefaultRelays)
    )

    expect(url.search).toBe("")
    expect(`${url.origin}${url.pathname}`).toBe("https://t.example/t")
  })

  test.each([
    ["another version", (fragment: string) => fragment.replace(/^1\./u, "2.")],
    ["a missing version", (fragment: string) => fragment.replace(/^1\./u, "")],
    ["a short payload", (fragment: string) => fragment.slice(0, -2)],
    ["a long payload", (fragment: string) => `${fragment}AA`],
    ["bad base64url", (fragment: string) => fragment.replace(/.$/u, "*")],
    ["an empty relay list", (fragment: string) => `${fragment}.`],
    ["a relay that is no URL", (fragment: string) => `${fragment}.a b`],
    ["a broken escape in a relay", (fragment: string) => `${fragment}.%E0%A4`],
  ])("rejects %s", (_name, corrupt) => {
    const address = createTableSelfPayAddress(
      "https://t.example",
      onDefaultRelays
    )
    const [base, fragment = ""] = address.split("#")

    expect(parseTableSelfPayAddress(`${base}#${corrupt(fragment)}`)).toBe(null)
  })

  test("rejects another path and text that is no address", () => {
    const address = createTableSelfPayAddress(
      "https://t.example",
      onDefaultRelays
    )

    expect(parseTableSelfPayAddress(address.replace("/t#", "/x#"))).toBe(null)
    expect(parseTableSelfPayAddress("not an address")).toBe(null)
  })

  test("reads no keys from random text in place of the keys", () => {
    const random = createSeededRandom(20_261_016)
    const address = createTableSelfPayAddress(
      "https://t.example",
      onDefaultRelays
    )
    const prefix = address.slice(0, address.lastIndexOf(".") + 1)
    for (let run = 0; run < 5000; run++) {
      expect(
        parseTableSelfPayAddress(`${prefix}${createRandomText(random, 120)}`)
      ).toBe(null)
    }
  })
})
