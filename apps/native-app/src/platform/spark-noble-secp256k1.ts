import * as noble from "spark:@noble/curves/secp256k1"
import { type NativeModule, requireOptionalNativeModule } from "expo"
import { type Secp256k1Native, wrapSecp256k1 } from "./spark-secp256k1.ts"

/** `modules/finito-secp256k1`: libsecp256k1. */
declare class FinitoSecp256k1NativeModule
  extends NativeModule
  implements Secp256k1Native
{
  publicKey(privateKey: Uint8Array): Uint8Array
  multiply(point: Uint8Array, scalar: Uint8Array): Uint8Array
  decompress(point: Uint8Array): Uint8Array
}

// What every import of the Spark SDK's `@noble/curves/secp256k1` gets on
// Android (`metro.config.js`): that module, with `wrapSecp256k1`'s native
// point operations.
export * from "spark:@noble/curves/secp256k1"

const native =
  requireOptionalNativeModule<FinitoSecp256k1NativeModule>("FinitoSecp256k1")

// Absent from a binary built before the module existed: noble's own then.
export const { secp256k1, schnorr } =
  native === null ? noble : wrapSecp256k1(noble, native)
