import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { WssUrl } from "../shared/schema.ts"
import {
  createTableSelfPayAddress,
  parseTableSelfPayAddress,
} from "./table-self-pay-address-utils.ts"
import {
  activeSelfPayRelays,
  listSelfPayRelays,
  parseSelfPayRelay,
  selfPayAddressRelays,
  selfPayRelaysToRead,
} from "./table-self-pay-relay-utils.ts"

const defaults = [WssUrl("wss://a.example"), WssUrl("wss://b.example")]

describe("self-pay relays", () => {
  test("a default relay is on until its row switches it off", () => {
    const relays = listSelfPayRelays(defaults, [
      { url: WssUrl("wss://b.example"), isActive: sqliteFalse },
    ])

    expect(relays).toEqual([
      { url: "wss://a.example", isActive: true, isDefault: true },
      { url: "wss://b.example", isActive: false, isDefault: true },
    ])
    expect(activeSelfPayRelays(relays)).toEqual(["wss://a.example"])
  })

  test("lists an added relay after the defaults", () => {
    const relays = listSelfPayRelays(defaults, [
      { url: WssUrl("wss://own.example"), isActive: sqliteTrue },
    ])

    expect(activeSelfPayRelays(relays)).toEqual([
      "wss://a.example",
      "wss://b.example",
      "wss://own.example",
    ])
  })

  test("publishes to the defaults when every relay is off", () => {
    const relays = listSelfPayRelays(defaults, [
      { url: WssUrl("wss://a.example"), isActive: sqliteFalse },
      { url: WssUrl("wss://b.example"), isActive: sqliteFalse },
      { url: WssUrl("wss://own.example"), isActive: sqliteFalse },
    ])

    expect(activeSelfPayRelays(relays)).toEqual(defaults)
  })

  test("a sticker names its relays only when they differ from the defaults", () => {
    expect(selfPayAddressRelays([...defaults].reverse(), defaults)).toEqual([])
    expect(selfPayAddressRelays([WssUrl("wss://a.example")], defaults)).toEqual(
      ["wss://a.example"]
    )
    expect(
      selfPayAddressRelays([...defaults, WssUrl("wss://own.example")], defaults)
    ).toEqual([...defaults, "wss://own.example"])
  })

  test("a sticker that names no relays reads the defaults", () => {
    expect(selfPayRelaysToRead([], defaults)).toEqual(defaults)
    expect(
      selfPayRelaysToRead([WssUrl("wss://own.example")], defaults)
    ).toEqual(["wss://own.example"])
  })

  test("a relay typed with capitals or without slashes reaches the sticker as itself", () => {
    const keys = { publicKey: new Uint8Array(32), viewKey: new Uint8Array(32) }
    const relays = [
      " Wss://Relay.Example.com ",
      "wss:relay.example.com/nostr",
    ].map(parseSelfPayRelay)

    expect(relays).toEqual([
      "wss://relay.example.com",
      "wss://relay.example.com/nostr",
    ])
    expect(parseSelfPayRelay("https://relay.example.com")).toBeNull()
    const address = createTableSelfPayAddress("https://t.example", {
      ...keys,
      relays: relays.flatMap((relay) => (relay === null ? [] : [relay])),
    })
    expect(parseTableSelfPayAddress(address)?.relays).toEqual(relays)
  })
})
