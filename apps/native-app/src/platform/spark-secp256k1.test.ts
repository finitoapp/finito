import { createECDH, ECDH, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import {
  type NobleSecp256k1Module,
  type Secp256k1Native,
  wrapSecp256k1,
} from "./spark-secp256k1.ts"

// The copy of noble the Spark SDK resolves, as the app's bundle does.
const fromCore = createRequire(
  new URL("../../../../packages/core/package.json", import.meta.url)
)
const fromSpark = createRequire(fromCore.resolve("@buildonspark/spark-sdk"))

interface Point {
  readonly assertValidity: () => void
  readonly toRawBytes: (isCompressed?: boolean) => Uint8Array
  multiply: (scalar: bigint) => this
  multiplyUnsafe: (scalar: bigint) => this
}
interface Signature {
  readonly recovery: number
  readonly toCompactHex: () => string
  readonly recoverPublicKey: (hash: Uint8Array) => Point
}
interface Noble extends NobleSecp256k1Module<Point> {
  readonly secp256k1: NobleSecp256k1Module<Point>["secp256k1"] & {
    readonly getPublicKey: (key: unknown, isCompressed?: boolean) => Uint8Array
    readonly sign: (hash: Uint8Array, key: unknown) => Signature
    readonly verify: (
      signature: Signature,
      hash: Uint8Array,
      publicKey: Uint8Array
    ) => boolean
    readonly Point: NobleSecp256k1Module<Point>["secp256k1"]["Point"] & {
      readonly fromPrivateKey: (key: unknown) => Point
    }
  }
  readonly schnorr: NobleSecp256k1Module<Point>["schnorr"] & {
    readonly sign: (
      message: Uint8Array,
      key: Uint8Array,
      auxRand: Uint8Array
    ) => Uint8Array
    readonly verify: (
      signature: Uint8Array,
      message: Uint8Array,
      publicKey: Uint8Array
    ) => boolean
    readonly getPublicKey: (key: Uint8Array) => Uint8Array
  }
}
const noble: Noble = fromSpark("@noble/curves/secp256k1")
const { secp256k1 } = noble

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex")
const bigint = (bytes: Uint8Array) => BigInt(`0x${hex(bytes)}`)

// Everything noble computes for a key, the way Spark asks for it.
const compute = (
  { getPublicKey, sign, verify, Point }: Noble["secp256k1"],
  schnorr: Noble["schnorr"],
  key: Uint8Array,
  hash: Uint8Array,
  auxRand: Uint8Array
) => {
  const publicKey = getPublicKey(key)
  const signature = sign(hash, key)
  const schnorrSignature = schnorr.sign(hash, key, auxRand)
  const xOnly = schnorr.getPublicKey(key)
  return {
    publicKey: hex(publicKey),
    uncompressed: hex(getPublicKey(key, false)),
    fromBigInt: hex(getPublicKey(bigint(key))),
    fromPrivateKey: hex(Point.fromPrivateKey(key).toRawBytes()),
    decoded: hex(Point.fromHex(publicKey).toRawBytes(false)),
    lifted: hex(schnorr.utils.lift_x(bigint(xOnly)).toRawBytes()),
    signature: `${signature.toCompactHex()}/${signature.recovery}`,
    verified: verify(signature, hash, publicKey),
    recovered: hex(signature.recoverPublicKey(hash).toRawBytes()),
    schnorrSignature: hex(schnorrSignature),
    schnorrVerified: schnorr.verify(schnorrSignature, hash, xOnly),
  }
}

const cases = Array.from({ length: 10 }, () => ({
  key: new Uint8Array(randomBytes(32)),
  hash: new Uint8Array(randomBytes(32)),
  auxRand: new Uint8Array(randomBytes(32)),
}))
// Taken before wrapping, which changes noble's point class in place.
const expected = cases.map(({ key, hash, auxRand }) =>
  compute(secp256k1, noble.schnorr, key, hash, auxRand)
)

// Node's OpenSSL, the library behind Quick Crypto on the device.
const nativeCalls: string[] = []
const native: Secp256k1Native = {
  publicKey: (privateKey) => {
    nativeCalls.push("publicKey")
    const ecdh = createECDH("secp256k1")
    ecdh.setPrivateKey(privateKey)
    return new Uint8Array(ecdh.getPublicKey())
  },
  decompress: (point) => {
    nativeCalls.push("decompress")
    return new Uint8Array(
      ECDH.convertKey(point, "secp256k1", undefined, undefined, "uncompressed")
    )
  },
}
const { schnorr } = wrapSecp256k1(noble, native)
const wrappedSchnorr = { ...noble.schnorr, ...schnorr }

const n = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"
)

describe("wrapSecp256k1", () => {
  it("returns noble's keys and signatures from native point operations", () => {
    nativeCalls.length = 0
    const actual = cases.map(({ key, hash, auxRand }) =>
      compute(secp256k1, wrappedSchnorr, key, hash, auxRand)
    )
    expect(actual).toEqual(expected)
    expect(new Set(nativeCalls)).toEqual(new Set(["publicKey", "decompress"]))
  })

  it("leaves invalid input to noble, which rejects it", () => {
    const zero = new Uint8Array(32)
    const order = Uint8Array.from(Buffer.from(n.toString(16), "hex"))
    for (const key of [zero, order, 0n, n, -1n]) {
      expect(() => secp256k1.getPublicKey(key)).toThrow()
      expect(() => secp256k1.Point.fromPrivateKey(key)).toThrow()
    }
    // x = 5 has no point on secp256k1.
    const offCurve = Uint8Array.of(0x02, ...new Uint8Array(31), 5)
    expect(() => secp256k1.Point.fromHex(offCurve)).toThrow()
    expect(() => schnorr.utils.lift_x(5n)).toThrow()
    expect(() => schnorr.utils.lift_x(0n)).toThrow()
    // Noble's unsafe multiplication takes 0, which native code cannot.
    expect(() => secp256k1.Point.BASE.multiplyUnsafe(0n)).not.toThrow()
  })
})
