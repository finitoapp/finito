import { hmac as nobleHmac } from "spark:@noble/hashes/hmac"
import { sha256, sha512 } from "spark:@noble/hashes/sha2"
import { createHmac } from "react-native-quick-crypto"
import { wrapHmac } from "./spark-hmac.ts"

// What every import of the Spark SDK's `@noble/hashes/hmac` gets on Android
// (`metro.config.js`): that module, with `wrapHmac`'s native HMAC.
export * from "spark:@noble/hashes/hmac"

export const hmac = wrapHmac(
  nobleHmac,
  new Map([
    [sha256, "sha256"],
    [sha512, "sha512"],
  ]),
  (algorithm, key, message) =>
    new Uint8Array(createHmac(algorithm, key).update(message).digest())
)
