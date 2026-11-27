// The noble modules of the Spark SDK and of Evolu, which `metro.config.js`
// resolves `spark:<module>` and `evolu:<module>` to for the wrappers in
// `platform/*-noble-*.ts`. Typed as far as those files use them.

declare module "spark:@noble/curves/secp256k1" {
  import type { NobleSecp256k1Module } from "./platform/spark-secp256k1.ts"

  export const secp256k1: NobleSecp256k1Module["secp256k1"]
  export const schnorr: NobleSecp256k1Module["schnorr"]
}

declare module "spark:@noble/hashes/hmac" {
  import type { NobleHmac } from "./platform/noble-hmac.ts"

  export const hmac: NobleHmac
}

declare module "spark:@noble/hashes/sha2" {
  export const sha256: unknown
  export const sha512: unknown
}

declare module "evolu:@noble/hashes/hmac.js" {
  import type { NobleHmac } from "./platform/noble-hmac.ts"

  export const hmac: NobleHmac
}

declare module "evolu:@noble/hashes/sha2.js" {
  export const sha256: unknown
  export const sha512: unknown
}
