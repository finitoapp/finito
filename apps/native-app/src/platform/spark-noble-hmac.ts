import { hmac as nobleHmac } from "spark:@noble/hashes/hmac"
import { sha256, sha512 } from "spark:@noble/hashes/sha2"
import { finitoCrypto } from "./finito-crypto.ts"
import { wrapHmac } from "./noble-hmac.ts"

// What every import of the Spark SDK's `@noble/hashes/hmac` gets on Android
// (`metro.config.js`): that module, with `wrapHmac`'s native HMAC.
export * from "spark:@noble/hashes/hmac"

export const hmac = wrapHmac(
  nobleHmac,
  new Map([
    [sha256, "SHA-256"],
    [sha512, "SHA-512"],
  ]),
  (algorithm, key, message) => finitoCrypto.hmac(algorithm, key, message)
)
