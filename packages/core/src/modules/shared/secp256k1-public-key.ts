import { secp256k1 } from "@noble/curves/secp256k1.js"

/**
 * A secp256k1 public key as a platform's native ECDH returns it: the
 * uncompressed SEC1 point `04 ‖ x ‖ y`, 65 bytes.
 */
export type Secp256k1UncompressedPublicKey = (
  privateKey: Uint8Array
) => Uint8Array

const UNCOMPRESSED_LENGTH = 65
const UNCOMPRESSED_PREFIX = 0x04

const compress = (point: Uint8Array): Uint8Array => {
  if (
    point.length !== UNCOMPRESSED_LENGTH ||
    point[0] !== UNCOMPRESSED_PREFIX
  ) {
    throw new Error("Expected an uncompressed secp256k1 public key.")
  }
  const compressed = new Uint8Array(33)
  // 02 for an even y, 03 for an odd one.
  compressed[0] = 0x02 | ((point[UNCOMPRESSED_LENGTH - 1] ?? 0) & 1)
  compressed.set(point.subarray(1, 33), 1)
  return compressed
}

let implementation = (privateKey: Uint8Array): Uint8Array =>
  secp256k1.getPublicKey(privateKey, true)

/**
 * Computes the public keys of Payky's own key derivations (BIP32 non-hardened
 * children, the Nostr identity) on the platform's native crypto from now on.
 * Noble's pure-JS point multiplication costs tens of milliseconds each on
 * Hermes, and the first one hundreds more while it builds its point tables;
 * the settings screen paid that on the JS thread for the account's npub.
 * Browsers and Node keep noble's. Installed once at startup, as
 * `installHmacSha512` is.
 */
export const installSecp256k1PublicKey = (
  native: Secp256k1UncompressedPublicKey
): void => {
  implementation = (privateKey) => compress(native(privateKey))
}

/** The compressed SEC1 public key (`02`/`03` ‖ x, 33 bytes) of `privateKey`. */
export const secp256k1PublicKey = (privateKey: Uint8Array): Uint8Array =>
  implementation(privateKey)
