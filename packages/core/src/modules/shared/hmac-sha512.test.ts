import { createHmac } from "node:crypto"
import { createAppOwner } from "@evolu/common"
import { hmac } from "@noble/hashes/hmac.js"
import { sha512 } from "@noble/hashes/sha2.js"
import { afterAll, describe, expect, test } from "vitest"

import { installHmacSha512 } from "./hmac-sha512.ts"
import {
  createMasterKey,
  deriveCashuWalletSeed,
  deriveDefaultSparkWalletSecret,
  deriveEvoluOwnerId,
  deriveEvoluOwnerSecret,
} from "./key-derivation.ts"

// Node's HMAC stands in for the native app's, which has the same shape.
const nativeHmac = (key: Uint8Array, data: Uint8Array) =>
  new Uint8Array(createHmac("sha512", key).update(data).digest())

const masterKeys = Array.from({ length: 20 }, () => createMasterKey())

describe("deriveEvoluOwnerId", () => {
  test("is the id of createAppOwner(deriveEvoluOwnerSecret(masterKey))", () => {
    for (const masterKey of masterKeys) {
      expect(deriveEvoluOwnerId(masterKey)).toBe(
        createAppOwner(deriveEvoluOwnerSecret(masterKey)).id
      )
    }
  })
})

describe("installHmacSha512", () => {
  afterAll(() => {
    installHmacSha512((key, data) => hmac(sha512, key, data))
  })

  test("a native HMAC derives the same ids and secrets as noble's", () => {
    const before = masterKeys.map((masterKey) => ({
      ownerId: deriveEvoluOwnerId(masterKey),
      ownerSecret: deriveEvoluOwnerSecret(masterKey),
      spark: deriveDefaultSparkWalletSecret(masterKey),
      cashu: deriveCashuWalletSeed(masterKey),
    }))

    let calls = 0
    installHmacSha512((key, data) => {
      calls += 1
      return nativeHmac(key, data)
    })

    const after = masterKeys.map((masterKey) => ({
      ownerId: deriveEvoluOwnerId(masterKey),
      ownerSecret: deriveEvoluOwnerSecret(masterKey),
      spark: deriveDefaultSparkWalletSecret(masterKey),
      cashu: deriveCashuWalletSeed(masterKey),
    }))
    expect(after).toEqual(before)
    expect(calls).toBeGreaterThan(0)
  })
})
