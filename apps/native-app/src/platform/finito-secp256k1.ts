import { type NativeModule, requireOptionalNativeModule } from "expo"
import type { Secp256k1Native } from "./spark-secp256k1.ts"

/** `modules/finito-secp256k1`: libsecp256k1. */
declare class FinitoSecp256k1NativeModule
  extends NativeModule
  implements Secp256k1Native
{
  publicKey(privateKey: Uint8Array): Uint8Array
  multiply(point: Uint8Array, scalar: Uint8Array): Uint8Array
  decompress(point: Uint8Array): Uint8Array
}

/** Null in a binary built before the module existed, which keeps noble's. */
export const finitoSecp256k1: Secp256k1Native | null =
  requireOptionalNativeModule<FinitoSecp256k1NativeModule>("FinitoSecp256k1")
