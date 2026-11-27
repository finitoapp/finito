// The Spark SDK's own noble modules, which `metro.config.js` resolves
// `spark:<module>` to for the wrappers in `platform/spark-noble-*.ts`. Typed
// as far as those files use them.

declare module "spark:@noble/curves/secp256k1" {
  import type { NobleSecp256k1Module } from "./platform/spark-secp256k1.ts"

  export const secp256k1: NobleSecp256k1Module["secp256k1"]
  export const schnorr: NobleSecp256k1Module["schnorr"]
}

declare module "spark:@noble/hashes/hmac" {
  import type { NobleHmac } from "./platform/spark-hmac.ts"

  export const hmac: NobleHmac
}

declare module "spark:@noble/hashes/sha2" {
  export const sha256: unknown
  export const sha512: unknown
}
