import * as noble from "spark:@noble/curves/secp256k1"
import { Buffer, createECDH, ECDH } from "react-native-quick-crypto"
import { wrapSecp256k1 } from "./spark-secp256k1.ts"

// What every import of the Spark SDK's `@noble/curves/secp256k1` gets on
// Android (`metro.config.js`): that module, with `wrapSecp256k1`'s native
// point operations.
export * from "spark:@noble/curves/secp256k1"

export const { schnorr } = wrapSecp256k1(noble, {
  ecdh: (privateKey, points) => {
    const ecdh = createECDH("secp256k1")
    ecdh.setPrivateKey(Buffer.from(privateKey))
    // A string only when an encoding is asked for, which none is.
    const publicKey = ecdh.getPublicKey()
    if (typeof publicKey === "string") throw new Error("Expected key bytes.")
    return {
      publicKey: new Uint8Array(publicKey),
      sharedXs: points.map(
        (point) => new Uint8Array(ecdh.computeSecret(Buffer.from(point)))
      ),
    }
  },
  decompress: (point) => {
    const uncompressed = ECDH.convertKey(
      Buffer.from(point),
      "secp256k1",
      undefined,
      undefined,
      "uncompressed"
    )
    if (typeof uncompressed === "string") throw new Error("Expected key bytes.")
    return new Uint8Array(uncompressed)
  },
})
