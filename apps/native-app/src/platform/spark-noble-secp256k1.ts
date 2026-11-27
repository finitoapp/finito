import { Buffer, createECDH, ECDH } from "react-native-quick-crypto"
import * as noble from "spark-noble-secp256k1"
import { wrapSecp256k1 } from "./spark-secp256k1.ts"

// What every import of the Spark SDK's `@noble/curves/secp256k1` gets on
// Android (`metro.config.js`): that module, with `wrapSecp256k1`'s native
// point operations. `spark-noble-secp256k1` is the module itself, which Metro
// resolves as the SDK does.
export * from "spark-noble-secp256k1"

export const { schnorr } = wrapSecp256k1(noble, {
  publicKey: (privateKey) => {
    const ecdh = createECDH("secp256k1")
    ecdh.setPrivateKey(Buffer.from(privateKey))
    // A string only when an encoding is asked for, which none is.
    const point = ecdh.getPublicKey()
    if (typeof point === "string") throw new Error("Expected key bytes.")
    return new Uint8Array(point)
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
