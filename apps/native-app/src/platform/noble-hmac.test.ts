import { createHmac, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { type HmacAlgorithm, type NobleHmac, wrapHmac } from "./noble-hmac.ts"

// The copies of noble the Spark SDK and Evolu resolve, as the app's bundle does.
const fromCore = createRequire(
  new URL("../../../../packages/core/package.json", import.meta.url)
)
const copies = [
  ["Spark", "@buildonspark/spark-sdk", ""],
  ["Evolu", "@evolu/common", ".js"],
].map(([name = "", origin = "", suffix = ""]) => {
  const fromOrigin = createRequire(fromCore.resolve(origin))
  const { hmac }: { hmac: NobleHmac } = fromOrigin(
    `@noble/hashes/hmac${suffix}`
  )
  const sha2 = fromOrigin(`@noble/hashes/sha2${suffix}`)
  return { name, hmac, sha2 }
})

describe.each(copies)(
  "wrapHmac over $name's noble",
  ({ hmac: nobleHmac, sha2 }) => {
    const { sha256, sha512, sha384 } = sha2
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
        return new Uint8Array(
          createHmac(algorithm, key).update(message).digest()
        )
      }
    )

    it("returns noble's HMAC-SHA256 and HMAC-SHA512 natively", () => {
      nativeCalls.length = 0
      for (const hash of [sha256, sha512]) {
        for (const size of [0, 32, 37, 200]) {
          const key = new Uint8Array(randomBytes(32))
          const message = new Uint8Array(randomBytes(size))
          expect(hmac(hash, key, message)).toEqual(
            nobleHmac(hash, key, message)
          )
        }
      }
      expect(nativeCalls).toHaveLength(8)
    })

    it("leaves other hashes and non-byte input to noble", () => {
      nativeCalls.length = 0
      const key = new Uint8Array(randomBytes(32))
      expect(hmac(sha384, key, key)).toEqual(nobleHmac(sha384, key, key))
      // Noble 1.x takes strings as UTF-8 and 2.x rejects them; either way
      // the wrapper answers as noble does.
      const attempt = (compute: () => Uint8Array) => {
        try {
          return compute()
        } catch (error) {
          return String(error)
        }
      }
      expect(attempt(() => hmac(sha256, "key", "message"))).toEqual(
        attempt(() => nobleHmac(sha256, "key", "message"))
      )
      expect(hmac.create).toBe(nobleHmac.create)
      expect(nativeCalls).toEqual([])
    })
  }
)
