import { describe, expect, test } from "vitest"

import { getNostrTag, signNostrEvent, verifyNostrEvent } from "./nostr-event.ts"

const secretKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1)
const event = signNostrEvent(secretKey, {
  created_at: 1_790_000_000,
  kind: 30_078,
  tags: [["d", "table"]],
  content: "view",
})

describe("nostr event", () => {
  test("verifies an event it signed", () => {
    expect(verifyNostrEvent(event)).toBe(true)
    expect(getNostrTag(event, "d")).toBe("table")
  })

  test.each([
    ["content", { ...event, content: "forged" }],
    ["created_at", { ...event, created_at: event.created_at + 1 }],
    ["tags", { ...event, tags: [["d", "other"]] }],
    [
      "pubkey",
      {
        ...event,
        pubkey: signNostrEvent(new Uint8Array(32).fill(9), event).pubkey,
      },
    ],
    ["sig", { ...event, sig: "0".repeat(128) }],
  ])("rejects a changed %s", (_field, forged) => {
    expect(verifyNostrEvent(forged)).toBe(false)
  })

  test("gives equal content the same id whoever signs it again", () => {
    expect(signNostrEvent(secretKey, event).id).toBe(event.id)
  })
})
