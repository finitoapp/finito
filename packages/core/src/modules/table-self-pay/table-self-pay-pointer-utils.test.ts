import { bytesToHex } from "@noble/hashes/utils.js"
import { describe, expect, test } from "vitest"

import { signNostrEvent } from "../../integrations/nostr/nostr-event.ts"
import { deriveSelfPaySelectionKey } from "../shared/key-derivation.ts"
import {
  createSelfPaySelectionEvent,
  createSelfPaySelectionFilter,
  createSelfPayShareSelectionText,
  deriveSelfPayPointerKeys,
  openSelfPaySelection,
  SelfPayShareSelectionSchema,
} from "./table-self-pay-pointer-utils.ts"
import {
  deriveBillSelfPayReference,
  formatSelfPayBankMessage,
} from "./table-self-pay-reference-utils.ts"
import { selfPayTestRoot } from "./table-self-pay-test-fixtures.ts"
import {
  decryptSelfPayContent,
  encryptSelfPayContent,
  SELF_PAY_VIEW_KIND,
  type SelfPayViewBill,
} from "./table-self-pay-view-utils.ts"

const selectionKey = deriveSelfPaySelectionKey(selfPayTestRoot)
const reference = deriveBillSelfPayReference("bill-1")
const createdAt = 1_790_000_000
const base32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

const billOf = (lineCount: number): SelfPayViewBill => ({
  reference,
  currency: "CZK",
  total: lineCount * 4500,
  covered: 0,
  remainder: lineCount * 4500,
  lines: Array.from({ length: lineCount }, (_, index) => ({
    key: `LINE${[3, 2, 1, 0].map((digit) => base32[Math.floor(index / 32 ** digit) % 32]).join("")}`,
    name: `Beer ${index}`,
    quantity: 3,
    totalAmount: 4500,
    allocatedAmount: 0,
  })),
})

const unitOfEveryLine = (bill: SelfPayViewBill) =>
  createSelfPayShareSelectionText({
    bill,
    split: {
      kind: "lines",
      fractions: bill.lines.map(({ key }) => ({
        key,
        numerator: 1,
        denominator: 3,
      })),
    },
  })

const open = (
  events: Parameters<typeof openSelfPaySelection>[0]["events"],
  pointer: Parameters<typeof openSelfPaySelection>[0]["pointer"],
  key = selectionKey
) =>
  openSelfPaySelection({
    events,
    pointer,
    selectionKey: key,
    schema: SelfPayShareSelectionSchema,
  })

describe("self-pay pointer", () => {
  test("names a selection of any size in 32 characters and a 35-character message", () => {
    const bill = billOf(200)
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText: unitOfEveryLine(bill),
      selectionKey,
      createdAt,
    })

    expect(pointer).toMatch(/^[A-Z2-7]{32}$/u)
    expect(formatSelfPayBankMessage({ pointer })).toHaveLength(35)
    expect(open([event], pointer)?.split).toMatchObject({
      kind: "lines",
      fractions: expect.arrayContaining([
        expect.objectContaining({ numerator: 1, denominator: 3 }),
      ]),
    })
  })

  test("gives two guests who pick the same share different pointers", () => {
    const text = () =>
      createSelfPayShareSelectionText({
        bill: billOf(2),
        split: { kind: "fractionOfBill", denominator: 2 },
      })
    const first = createSelfPaySelectionEvent({
      selectionText: text(),
      selectionKey,
      createdAt,
    })
    const second = createSelfPaySelectionEvent({
      selectionText: text(),
      selectionKey,
      createdAt,
    })

    expect(first.pointer).not.toBe(second.pointer)
  })

  test("ignores a different selection published under the pointer after paying", () => {
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText: unitOfEveryLine(billOf(2)),
      selectionKey,
      createdAt,
    })
    const { signingKey, readKey } = deriveSelfPayPointerKeys(
      pointer,
      selectionKey
    )
    const swapped = signNostrEvent(signingKey, {
      created_at: createdAt + 60,
      kind: SELF_PAY_VIEW_KIND,
      tags: [["d", ""]],
      content: encryptSelfPayContent(readKey, unitOfEveryLine(billOf(20))),
    })

    expect(open([swapped], pointer)).toBe(null)
    expect(open([swapped, event], pointer)?.split).toMatchObject({
      kind: "lines",
    })
  })

  test("is found only under its own key, however many events others publish", () => {
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText: unitOfEveryLine(billOf(2)),
      selectionKey,
      createdAt,
    })
    const randomHex = () =>
      bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
    const junk = [
      ...Array.from({ length: 1000 }, () => ({
        ...event,
        id: randomHex(),
        pubkey: randomHex(),
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        ...event,
        id: randomHex(),
        created_at: createdAt + index + 1,
        content: `forged ${index}`,
      })),
    ]

    expect(createSelfPaySelectionFilter(pointer, selectionKey)).toEqual({
      kinds: [SELF_PAY_VIEW_KIND],
      authors: [event.pubkey],
    })
    expect(open([...junk, event], pointer)).not.toBe(null)
  })

  test("tells a relay nothing about the table, the bill or the amounts", () => {
    const text = unitOfEveryLine(billOf(2))
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText: text,
      selectionKey,
      createdAt,
    })

    expect(event.tags.map(([name]) => name)).toEqual(["d", "expiration"])
    expect(event.content).not.toContain(reference)
    expect(event.content).not.toContain(pointer)
    expect(decryptSelfPayContent(selectionKey, event.content)).toBe(null)
  })

  test("cannot be found or read from the pointer alone, as a bank sees it", () => {
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText: unitOfEveryLine(billOf(2)),
      selectionKey,
      createdAt,
    })
    const guessedKey = new TextEncoder().encode(pointer.padEnd(32, "0"))

    expect(
      createSelfPaySelectionFilter(pointer, guessedKey).authors
    ).not.toContain(event.pubkey)
    expect(open([event], pointer, guessedKey)).toBe(null)
  })
})
