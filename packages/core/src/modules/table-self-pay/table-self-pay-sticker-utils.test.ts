import { describe, expect, test } from "vitest"

import {
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
  MasterKey,
} from "../shared/key-derivation.ts"
import { WssUrl } from "../shared/schema.ts"
import { createTableSelfPayAddress } from "./table-self-pay-address-utils.ts"
import { checkTableSelfPaySticker } from "./table-self-pay-sticker-utils.ts"
import { selfPayTestMasterKey } from "./table-self-pay-test-fixtures.ts"

const root = deriveTableSelfPayRoot(selfPayTestMasterKey)
const tables = [
  { id: "table-5", name: "Table 5", selfPayEpoch: 2 },
  { id: "table-6", name: "Table 6", selfPayEpoch: null },
]

const origin = "https://t.example"

const sticker = (
  tableRoot: Uint8Array,
  tableId: string,
  epoch: number,
  relays: ReadonlyArray<WssUrl> = []
) =>
  createTableSelfPayAddress(origin, {
    ...deriveTableSelfPayKeys(tableRoot, tableId, epoch),
    relays,
  })

describe("checkTableSelfPaySticker", () => {
  test("names the table of a current sticker", () => {
    expect(
      checkTableSelfPaySticker({
        scanned: sticker(root, "table-5", 2),
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "current", tableName: "Table 5" })
    expect(
      checkTableSelfPaySticker({
        scanned: sticker(root, "table-6", 0),
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "current", tableName: "Table 6" })
  })

  test("recognises an earlier sticker of a table", () => {
    expect(
      checkTableSelfPaySticker({
        scanned: sticker(root, "table-5", 1),
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "earlier", tableName: "Table 5" })
  })

  test("asks for a new sticker once the relays it names changed", () => {
    const ownRelays = [WssUrl("wss://own.example")]

    expect(
      checkTableSelfPaySticker({
        scanned: sticker(root, "table-5", 2),
        origins: [origin],
        addressRelays: ownRelays,
        tables,
        root,
      })
    ).toEqual({ kind: "relaysChanged", tableName: "Table 5" })
    expect(
      checkTableSelfPaySticker({
        scanned: sticker(root, "table-5", 2, ownRelays),
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "relaysChanged", tableName: "Table 5" })
    expect(
      checkTableSelfPaySticker({
        scanned: sticker(root, "table-5", 2, ownRelays),
        origins: [origin],
        addressRelays: ownRelays,
        tables,
        root,
      })
    ).toEqual({ kind: "current", tableName: "Table 5" })
  })

  test("reports a sticker someone else made as foreign", () => {
    const otherRoot = deriveTableSelfPayRoot(
      MasterKey("ffffffffffffffffffffffffffffffff")
    )
    const ours = deriveTableSelfPayKeys(root, "table-5", 2)
    const withOurPublicKey = createTableSelfPayAddress(origin, {
      publicKey: ours.publicKey,
      viewKey: new Uint8Array(32),
      relays: [],
    })

    expect(
      checkTableSelfPaySticker({
        scanned: sticker(otherRoot, "table-5", 2),
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "foreign" })
    expect(
      checkTableSelfPaySticker({
        scanned: withOurPublicKey,
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "foreign" })
  })

  test("names the table of a sticker on another brand's guest host", () => {
    const otherBrandOrigin = "https://t.other.example"
    const otherBrandSticker = createTableSelfPayAddress(otherBrandOrigin, {
      ...deriveTableSelfPayKeys(root, "table-5", 2),
      relays: [],
    })

    expect(
      checkTableSelfPaySticker({
        scanned: otherBrandSticker,
        origins: [origin, otherBrandOrigin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "current", tableName: "Table 5" })
  })

  test("reports our keys behind another address as foreign", () => {
    const lookalike = createTableSelfPayAddress("https://t.example.evil", {
      ...deriveTableSelfPayKeys(root, "table-5", 2),
      relays: [],
    })

    expect(
      checkTableSelfPaySticker({
        scanned: lookalike,
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "foreign" })
  })

  test("tells a code that is no table sticker apart", () => {
    expect(
      checkTableSelfPaySticker({
        scanned: "8594000000017",
        origins: [origin],
        addressRelays: [],
        tables,
        root,
      })
    ).toEqual({ kind: "notTableCode" })
  })
})
