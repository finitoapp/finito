/**
 * The Spark SDK's own `@noble/curves/secp256k1`, which `metro.config.js`
 * resolves this name to for `platform/spark-noble-secp256k1.ts`. Typed as far
 * as that file uses it.
 */
declare module "spark-noble-secp256k1" {
  import type { NobleSecp256k1Module } from "./platform/spark-secp256k1.ts"

  export const secp256k1: NobleSecp256k1Module["secp256k1"]
  export const schnorr: NobleSecp256k1Module["schnorr"]
}
