import { decode, npubEncode } from "nostr-tools/nip19"

const HEX_PUBKEY = /^[0-9a-f]{64}$/iu

/** Whether the text is a pubkey in hex, as NIP-05 documents and events carry it. */
export const isHexPubkey = (value: string): boolean => HEX_PUBKEY.test(value)

/**
 * An npub as its hex pubkey, or `null` for anything else. Imports nothing
 * behind the `@/` alias, so the serverless functions can bundle it too.
 */
export const npubToHex = (value: string): string | null => {
  try {
    const decoded = decode(value)
    return decoded.type === "npub" ? decoded.data : null
  } catch {
    return null
  }
}

/** A hex pubkey as its npub. */
export const hexToNpub = (pubkey: string): string => npubEncode(pubkey)

/**
 * The hex pubkey any common spelling of a Nostr key names: an npub, an
 * nprofile, a hex key, each also as a `nostr:` URI (NIP-21); `null` for
 * anything else.
 */
export const parseNostrPubkey = (text: string): string | null => {
  const value = text.trim().replace(/^nostr:/iu, "")
  if (isHexPubkey(value)) return value.toLowerCase()
  try {
    const decoded = decode(value.toLowerCase())
    if (decoded.type === "npub") return decoded.data
    if (decoded.type === "nprofile") return decoded.data.pubkey
  } catch {
    return null
  }
  return null
}
