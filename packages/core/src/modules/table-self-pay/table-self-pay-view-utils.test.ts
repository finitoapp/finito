import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { base64 } from "@scure/base"
import { describe, expect, test } from "vitest"
import { verifyNostrEvent } from "../../integrations/nostr/nostr-event.ts"
import {
  createRandomText,
  createSeededRandom,
} from "../../testing/seeded-random.ts"
import { IbanSchema } from "../shared/schema.ts"
import { SelfPayReferenceSchema } from "./table-self-pay-reference-utils.ts"
import {
  createDisabledSelfPayView,
  createSelfPayViewEvent,
  decryptSelfPayContent,
  deriveSelfPayLivenessTag,
  deriveSelfPayViewSubkey,
  deriveSelfPayViewTag,
  encryptSelfPayContent,
  fitSelfPayViewIntoEvent,
  parseSelfPayContent,
  type SelfPayView,
  SelfPayViewSchema,
} from "./table-self-pay-view-utils.ts"

const viewKey = Uint8Array.from({ length: 32 }, (_, index) => index)
const signingKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1)

const tableOfLongBills = (billCount: number): SelfPayView => ({
  ...createDisabledSelfPayView("Table 12"),
  enabled: true,
  payee: "Bistro na nádraží",
  bank: {
    iban: IbanSchema.decode("CZ6508000000192000145399"),
    accountName: "Bistro",
    currency: "CZK",
    qrFormat: "spayd",
  },
  lightning: { identityPublicKey: "02".padEnd(66, "a") },
  selectionKey: "cd".repeat(32),
  bills: Array.from({ length: billCount }, (_, bill) => ({
    reference: SelfPayReferenceSchema.decode(String(1_000_000_000 + bill)),
    currency: "CZK" as const,
    total: 9_999_999,
    covered: 999_999,
    remainder: 9_000_000 + bill,
    lines: Array.from({ length: 64 }, () => ({
      key: "ABCDEFGH",
      name: "Ř".repeat(40),
      quantity: 12,
      totalAmount: 1_234_567,
      allocatedAmount: 234_567,
    })),
  })),
  confirmations: Array.from({ length: 20 }, () => ({
    pointerHash: "0123456789abcdef",
    amount: 1_234_567,
    currency: "CZK" as const,
    at: 1_780_000_000,
  })),
})

describe("self-pay content encryption", () => {
  test("round-trips text under the view key", () => {
    const content = encryptSelfPayContent(viewKey, '{"a":1}')

    expect(decryptSelfPayContent(viewKey, content)).toBe('{"a":1}')
    expect(decryptSelfPayContent(new Uint8Array(32), content)).toBe(null)
    expect(decryptSelfPayContent(viewKey, "not base64")).toBe(null)
  })

  test("tags, derives nonces and encrypts each with its own key", () => {
    const subkeys = (["tag", "nonce", "encrypt"] as const).map((name) =>
      deriveSelfPayViewSubkey(viewKey, name)
    )
    const content = base64.decode(encryptSelfPayContent(viewKey, "x"))
    const nonce = content.slice(0, 24)

    expect(new Set([viewKey, ...subkeys].map(bytesToHex)).size).toBe(4)
    expect(() =>
      xchacha20poly1305(viewKey, nonce).decrypt(content.slice(24))
    ).toThrow()
  })

  test("encrypts equal plaintext to equal bytes", () => {
    expect(encryptSelfPayContent(viewKey, "same")).toBe(
      encryptSelfPayContent(viewKey, "same")
    )
  })

  test("pads to a power of two from 1 KiB so sizes do not leak content", () => {
    const short = encryptSelfPayContent(viewKey, "x")
    const longer = encryptSelfPayContent(viewKey, "x".repeat(900))
    const beyond = encryptSelfPayContent(viewKey, "x".repeat(1500))

    expect(short.length).toBe(longer.length)
    expect(beyond.length).toBeGreaterThan(short.length * 1.9)
  })
})

describe("self-pay view event", () => {
  test("carries the view under a tag relays cannot tie to a table", () => {
    const view = createDisabledSelfPayView("Table 3")
    const event = createSelfPayViewEvent({
      signingKey,
      viewKey,
      view,
      version: 1_790_000_000,
    })

    expect(verifyNostrEvent(event)).toBe(true)
    expect(event.created_at).toBe(1_790_000_000)
    expect(event.tags[0]).toEqual(["d", deriveSelfPayViewTag(viewKey)])
    expect(deriveSelfPayViewTag(viewKey)).not.toBe(
      deriveSelfPayLivenessTag(viewKey)
    )
    expect(event.content).not.toContain("Table")
    expect(
      parseSelfPayContent(SelfPayViewSchema, viewKey, event.content)
    ).toEqual(view)
  })

  test("gives the same view the same event id on every device", () => {
    const create = () =>
      createSelfPayViewEvent({
        signingKey,
        viewKey,
        view: createDisabledSelfPayView("Table 3"),
        version: 7,
      })

    expect(create().id).toBe(create().id)
  })

  test("fits two bills of 64 long-named lines into one event every default relay accepts", () => {
    const view = tableOfLongBills(2)
    const event = createSelfPayViewEvent({
      signingKey,
      viewKey,
      view: fitSelfPayViewIntoEvent(view),
      version: 1_780_000_000,
    })

    expect(fitSelfPayViewIntoEvent(view)).toEqual(view)
    expect(JSON.stringify(event).length).toBeLessThan(64 * 1024)
  })

  test("four bills of 64 lines publish under 64 KiB with the largest bills by totals", () => {
    const view = tableOfLongBills(4)
    const fitted = fitSelfPayViewIntoEvent(view)
    const event = createSelfPayViewEvent({
      signingKey,
      viewKey,
      view: fitted,
      version: 1_780_000_000,
    })

    expect(JSON.stringify(event).length).toBeLessThan(64 * 1024)
    expect(fitted.bills.map(({ lines }) => lines.length)).toEqual([
      0, 0, 64, 64,
    ])
    expect(fitted.bills.map(({ remainder }) => remainder)).toEqual(
      view.bills.map(({ remainder }) => remainder)
    )
  })

  test("leaves out the newest bills when bills by totals still do not fit", () => {
    const view = tableOfLongBills(1)
    const [bill] = view.bills
    if (bill === undefined) throw new Error("Expected a bill.")
    const crowded = {
      ...view,
      bills: Array.from({ length: 500 }, (_, index) => ({
        ...bill,
        reference: SelfPayReferenceSchema.decode(String(1_000_000_000 + index)),
        lines: [],
      })),
    }

    const fitted = fitSelfPayViewIntoEvent(crowded)

    expect(fitted.bills.length).toBeLessThan(500)
    expect(fitted.bills).toEqual(crowded.bills.slice(0, fitted.bills.length))
    expect(
      JSON.stringify(
        createSelfPayViewEvent({
          signingKey,
          viewKey,
          view: fitted,
          version: 1_780_000_000,
        })
      ).length
    ).toBeLessThan(64 * 1024)
  })

  test("rejects a view whose bank account is no IBAN", () => {
    const view = {
      ...createDisabledSelfPayView("Table 3"),
      bank: {
        iban: "CZ6508000000192000145398",
        accountName: "Bistro",
        currency: "CZK",
        qrFormat: "spayd",
      },
    }

    expect(
      parseSelfPayContent(
        SelfPayViewSchema,
        viewKey,
        encryptSelfPayContent(viewKey, JSON.stringify(view))
      )
    ).toBe(null)
  })

  test("rejects content that does not match the view schema", () => {
    expect(
      parseSelfPayContent(
        SelfPayViewSchema,
        viewKey,
        encryptSelfPayContent(viewKey, '{"v":2}')
      )
    ).toBe(null)
  })

  test("reads random content as no view", () => {
    const random = createSeededRandom(20_261_018)
    for (let run = 0; run < 5000; run++) {
      expect(
        parseSelfPayContent(
          SelfPayViewSchema,
          viewKey,
          createRandomText(random, 400)
        )
      ).toBe(null)
    }
  })
})
