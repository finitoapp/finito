import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"

export const deriveLabeledKey = (
  keyMaterial: Uint8Array,
  label: string
): Uint8Array =>
  hkdf(sha256, keyMaterial, undefined, new TextEncoder().encode(label), 32)
