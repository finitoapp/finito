import { createHmac, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { type HmacAlgorithm, type NobleHmac, wrapHmac } from "./spark-hmac.ts"

// The copy of noble the Spark SDK resolves, as the app's bundle does.
const fromCore = createRequire(
  new URL("../../../../packages/core/package.json", import.meta.url)
)
const fromSpark = createRequire(fromCore.resolve("@buildonspark/spark-sdk"))
const { hmac: nobleHmac }: { hmac: NobleHmac } = fromSpark("@noble/hashes/hmac")
const { sha256, sha512, sha384 } = fromSpark("@noble/hashes/sha2")

// Node's OpenSSL, the library behind Quick Crypto on the device.
const nativeCalls: HmacAlgorithm[] = []
const hmac = wrapHmac(
  nobleHmac,
  new Map<unknown, HmacAlgorithm>([
    [sha256, "sha256"],
    [sha512, "sha512"],
  ]),
  (algorithm, key, message) => {
    nativeCalls.push(algorithm)
    return new Uint8Array(createHmac(algorithm, key).update(message).digest())
  }
)

describe("wrapHmac", () => {
  it("returns noble's HMAC-SHA256 and HMAC-SHA512 natively", () => {
    for (const hash of [sha256, sha512]) {
      for (const size of [0, 32, 37, 200]) {
        const key = new Uint8Array(randomBytes(32))
        const message = new Uint8Array(randomBytes(size))
        expect(hmac(hash, key, message)).toEqual(nobleHmac(hash, key, message))
      }
    }
    expect(nativeCalls).toHaveLength(8)
  })

  it("leaves other hashes and string input to noble", () => {
    nativeCalls.length = 0
    const key = new Uint8Array(randomBytes(32))
    expect(hmac(sha384, key, key)).toEqual(nobleHmac(sha384, key, key))
    expect(hmac(sha256, "key", "message")).toEqual(
      nobleHmac(sha256, "key", "message")
    )
    expect(hmac.create).toBe(nobleHmac.create)
    expect(nativeCalls).toEqual([])
  })
})
