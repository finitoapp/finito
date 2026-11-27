import * as noble from "spark:@noble/curves/secp256k1"
import { finitoSecp256k1 } from "./finito-secp256k1.ts"
import { wrapSecp256k1 } from "./spark-secp256k1.ts"

// What every import of the Spark SDK's `@noble/curves/secp256k1` gets on
// Android (`metro.config.js`): that module, with `wrapSecp256k1`'s native
// point operations.
export * from "spark:@noble/curves/secp256k1"

export const { secp256k1, schnorr } =
  finitoSecp256k1 === null ? noble : wrapSecp256k1(noble, finitoSecp256k1)
