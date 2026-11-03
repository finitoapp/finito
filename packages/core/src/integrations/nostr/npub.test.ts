import { nprofileEncode, npubEncode } from "nostr-tools/nip19"
import { describe, expect, test } from "vitest"
import { parseNostrPubkey } from "./npub.ts"

const pubkey = "a".repeat(64)
const npub = npubEncode(pubkey)

describe("parseNostrPubkey", () => {
  test("an npub, nprofile or hex key, bare or as a nostr: URI, names the key", () => {
    for (const text of [
      npub,
      ` ${npub} `,
      `nostr:${npub}`,
      `NOSTR:${npub.toUpperCase()}`,
      pubkey,
      pubkey.toUpperCase(),
      `nostr:${pubkey}`,
      nprofileEncode({ pubkey }),
      `nostr:${nprofileEncode({ pubkey })}`,
    ]) {
      expect(parseNostrPubkey(text)).toBe(pubkey)
    }
  })

  test("anything else is nothing", () => {
    for (const text of [
      "",
      "npub1x",
      "a".repeat(63),
      "lnbc10n1pjfakeinvoice",
      "hynek@linky.fit",
    ]) {
      expect(parseNostrPubkey(text)).toBeNull()
    }
  })
})
