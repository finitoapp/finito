import { hmac as nobleHmac } from "evolu:@noble/hashes/hmac.js"
import { sha256, sha512 } from "evolu:@noble/hashes/sha2.js"
import { finitoCrypto } from "./finito-crypto.ts"
import { wrapHmac } from "./noble-hmac.ts"

// What every import of Evolu's `@noble/hashes/hmac.js` gets on Android
// (`metro.config.js`), Payky's own and other packages' that share that copy
// included: that module, with `wrapHmac`'s native HMAC.
export * from "evolu:@noble/hashes/hmac.js"

export const hmac = wrapHmac(
  nobleHmac,
  new Map([
    [sha256, "SHA-256"],
    [sha512, "SHA-512"],
  ]),
  (algorithm, key, message) => finitoCrypto.hmac(algorithm, key, message)
)
