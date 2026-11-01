import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"

import { hmacSha512 } from "./hmac-sha512.ts"
import { secp256k1PublicKey } from "./secp256k1-public-key.ts"

/**
 * BIP32 private-key derivation over Payky's own crypto primitives, which a
 * native platform swaps for its own (`installHmacSha512`,
 * `installSecp256k1PublicKey`). A hardened child needs only the parent's
 * private key and chain code (HMAC-SHA512 and an addition modulo the curve
 * order); a non-hardened one also the parent's public key. `HDKey.derive`
 * computes a secp256k1 public key at every level in pure JS: on Hermes those
 * cost ~80 ms per derivation, and the first one ~600 ms more while noble
 * builds its point tables, which a cold start paid several times over. This
 * computes one only where a non-hardened level needs it. The result is the
 * same key: the test compares it with `HDKey` byte for byte.
 */

// Built with BigInt() rather than as a bigint literal: CodeQL reads the
// literal as undefined and flags every comparison and sum with it.
const CURVE_ORDER = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"
)
const HARDENED_OFFSET = 0x80000000
const MASTER_HMAC_KEY = new TextEncoder().encode("Bitcoin seed")

const toBigInt = (bytes: Uint8Array): bigint => BigInt(`0x${bytesToHex(bytes)}`)
const toBytes32 = (value: bigint): Uint8Array<ArrayBuffer> =>
  hexToBytes(value.toString(16).padStart(64, "0"))

/**
 * `m/44'/1237'/0'/0/0` as child indexes, hardened ones offset by 2^31;
 * `null` for anything that is not such a path.
 */
export const parseDerivationPath = (
  path: string
): ReadonlyArray<number> | null => {
  const [root, ...levels] = path.split("/")
  if (root !== "m") return null
  const indexes: number[] = []
  for (const level of levels) {
    const match = /^(\d+)(')?$/u.exec(level)
    if (match?.[1] === undefined) return null
    const index = Number(match[1])
    if (index >= HARDENED_OFFSET) return null
    indexes.push(match[2] === undefined ? index : index + HARDENED_OFFSET)
  }
  return indexes
}

/** The private key at `indexes` below the master key of `seed`. */
export const derivePrivateKey = (
  seed: Uint8Array,
  indexes: ReadonlyArray<number>
): Uint8Array<ArrayBuffer> => {
  const master = hmacSha512(MASTER_HMAC_KEY, seed)
  let key = toBigInt(master.slice(0, 32))
  let chainCode = master.slice(32)
  if (key === 0n || key >= CURVE_ORDER) {
    throw new Error("Invalid BIP32 master key.")
  }

  for (const index of indexes) {
    const data = new Uint8Array(37)
    if (index >= HARDENED_OFFSET) {
      data.set(toBytes32(key), 1)
    } else {
      data.set(secp256k1PublicKey(toBytes32(key)))
    }
    new DataView(data.buffer).setUint32(33, index)
    const child = hmacSha512(chainCode, data)
    const tweak = toBigInt(child.slice(0, 32))
    const childKey = (tweak + key) % CURVE_ORDER
    // HDKey refuses these too; at 2^-127 odds, a derivation that hits one fails.
    if (tweak >= CURVE_ORDER || childKey === 0n) {
      throw new Error("Invalid BIP32 child key.")
    }
    key = childKey
    chainCode = child.slice(32)
  }

  return toBytes32(key)
}
