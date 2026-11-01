import { createECDH } from "node:crypto"
import { secp256k1 } from "@noble/curves/secp256k1.js"
import { getPublicKey } from "nostr-tools/pure"
import { afterAll, describe, expect, test } from "vitest"

import { getNostrIdentity } from "../../integrations/nostr/nostr-client.ts"
import { createMasterKey, deriveNostrSecretKey } from "./key-derivation.ts"
import {
  installSecp256k1PublicKey,
  secp256k1PublicKey,
} from "./secp256k1-public-key.ts"

// Node's ECDH stands in for Quick Crypto's, which has the same shape and,
// like Node's by default, returns the uncompressed point.
const nativePublicKey = (privateKey: Uint8Array) => {
  const ecdh = createECDH("secp256k1")
  ecdh.setPrivateKey(privateKey)
  return new Uint8Array(ecdh.getPublicKey())
}

const masterKeys = Array.from({ length: 20 }, () => createMasterKey())

describe("installSecp256k1PublicKey", () => {
  afterAll(() => {
    installSecp256k1PublicKey((privateKey) =>
      secp256k1.getPublicKey(privateKey, false)
    )
  })

  test("a native ECDH derives the same Nostr keys and identity as noble's", () => {
    const before = masterKeys.map((masterKey) => ({
      secretKey: deriveNostrSecretKey(masterKey),
      identity: getNostrIdentity(masterKey),
    }))
    for (const { secretKey, identity } of before) {
      expect(identity.pubkey).toBe(getPublicKey(secretKey))
    }

    let calls = 0
    installSecp256k1PublicKey((privateKey) => {
      calls += 1
      return nativePublicKey(privateKey)
    })

    const after = masterKeys.map((masterKey) => ({
      secretKey: deriveNostrSecretKey(masterKey),
      identity: getNostrIdentity(masterKey),
    }))
    expect(after).toEqual(before)
    expect(calls).toBeGreaterThan(0)
  })

  test("refuses a native key that is not an uncompressed point", () => {
    installSecp256k1PublicKey((privateKey) =>
      secp256k1.getPublicKey(privateKey, true)
    )
    expect(() => secp256k1PublicKey(new Uint8Array(32).fill(1))).toThrow(
      "Expected an uncompressed secp256k1 public key."
    )
  })
})
