import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
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
  readonly negate: () => Point
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
    decodedFromHex: hex(Point.fromHex(hex(publicKey)).toRawBytes(false)),
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
const n = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"
)
const { BASE } = secp256k1.Point
// Points and scalars for a multiplication, the edges among them: 1, n - 1,
// and -G.
const products = [
  ...cases.map(({ key, hash }) => ({
    point: secp256k1.Point.fromHex(secp256k1.getPublicKey(key)),
    scalar: bigint(hash) % n || 1n,
  })),
  { point: BASE.multiply(7n), scalar: 1n },
  { point: BASE.multiply(7n), scalar: n - 1n },
  { point: BASE.negate(), scalar: 5n },
]
const multiplyAll = () =>
  products.map(({ point, scalar }) => [
    hex(point.multiply(scalar).toRawBytes()),
    hex(point.multiplyUnsafe(scalar).toRawBytes()),
  ])

// Taken before wrapping, which changes noble's point class in place.
const expected = cases.map(({ key, hash, auxRand }) =>
  compute(secp256k1, noble.schnorr, key, hash, auxRand)
)
const expectedProducts = multiplyAll()

// Another noble, 2.x, as Payky's core resolves it, for the native side:
// libsecp256k1 runs only on the device.
interface ReferencePoint {
  readonly multiply: (scalar: bigint) => ReferencePoint
  readonly toBytes: (isCompressed: boolean) => Uint8Array
}
const reference: {
  secp256k1: {
    Point: {
      BASE: ReferencePoint
      fromBytes: (bytes: Uint8Array) => ReferencePoint
    }
  }
} = fromCore("@noble/curves/secp256k1.js")
const { Point: ReferencePoint } = reference.secp256k1
const nativeCalls: string[] = []
const native: Secp256k1Native = {
  publicKey: (privateKey) => {
    nativeCalls.push("publicKey")
    return ReferencePoint.BASE.multiply(bigint(privateKey)).toBytes(false)
  },
  multiply: (point, scalar) => {
    nativeCalls.push("multiply")
    return ReferencePoint.fromBytes(point)
      .multiply(bigint(scalar))
      .toBytes(false)
  },
  decompress: (point) => {
    nativeCalls.push("decompress")
    return ReferencePoint.fromBytes(point).toBytes(false)
  },
}
const wrapped = wrapSecp256k1(noble, native)
const wrappedSecp256k1 = {
  ...secp256k1,
  getPublicKey: wrapped.secp256k1.getPublicKey,
}
const schnorr = { ...noble.schnorr, ...wrapped.schnorr }

describe("wrapSecp256k1", () => {
  it("returns noble's keys and signatures from native point operations", () => {
    nativeCalls.length = 0
    const actual = cases.map(({ key, hash, auxRand }) =>
      compute(wrappedSecp256k1, schnorr, key, hash, auxRand)
    )
    expect(actual).toEqual(expected)
    expect(new Set(nativeCalls)).toEqual(
      new Set(["publicKey", "multiply", "decompress"])
    )
  })

  it("multiplies any point natively", () => {
    nativeCalls.length = 0
    expect(multiplyAll()).toEqual(expectedProducts)
    expect(nativeCalls).toEqual(
      products.flatMap(() => ["multiply", "multiply"])
    )
  })

  it("remembers the public keys it computed", () => {
    const key = new Uint8Array(randomBytes(32))
    nativeCalls.length = 0
    const first = wrappedSecp256k1.getPublicKey(key)
    first.fill(0)
    const again = wrappedSecp256k1.getPublicKey(key)
    expect(hex(again)).toBe(hex(secp256k1.getPublicKey(key)))
    // As `@scure/bip32` passes the same key, which it remembered too.
    expect(hex(wrappedSecp256k1.getPublicKey(bigint(key)))).toBe(hex(again))
    // The first call and the reference just above.
    expect(nativeCalls).toEqual(["publicKey", "publicKey"])
  })

  it("leaves invalid input to noble, which rejects it", () => {
    const zero = new Uint8Array(32)
    const order = Uint8Array.from(Buffer.from(n.toString(16), "hex"))
    for (const key of [zero, order, 0n, n, -1n]) {
      expect(() => wrappedSecp256k1.getPublicKey(key)).toThrow()
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

it("names the module and its functions the same in JS and Kotlin", () => {
  const read = (file: string) =>
    readFileSync(new URL(file, import.meta.url), "utf8")
  const js = read("./finito-secp256k1.ts")
  const kotlin = read(
    "../../modules/finito-secp256k1/android/src/main/java/fit/finito/secp256k1/FinitoSecp256k1Module.kt"
  )
  expect(js).toContain(
    'requireOptionalNativeModule<FinitoSecp256k1NativeModule>("FinitoSecp256k1")'
  )
  expect(kotlin).toContain('Name("FinitoSecp256k1")')
  for (const name of ["publicKey", "multiply", "decompress"]) {
    expect(js).toContain(`${name}(`)
    expect(kotlin).toContain(`Function("${name}")`)
  }
})
