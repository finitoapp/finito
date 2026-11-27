/**
 * A point of noble's secp256k1. The wrapper replaces its multiplications on
 * the class prototype, which noble leaves unfrozen.
 */
interface NoblePoint {
  readonly assertValidity: () => void
  readonly is0: () => boolean
  readonly add: (other: this) => this
  readonly negate: () => this
  readonly toRawBytes: (isCompressed?: boolean) => Uint8Array
  multiply: (scalar: bigint) => this
  multiplyUnsafe: (scalar: bigint) => this
}

/** The static side of noble's point class. */
interface NoblePointClass<P extends NoblePoint> {
  readonly BASE: P
  readonly prototype: P
  fromHex: (hex: unknown) => P
  readonly fromAffine: (point: { readonly x: bigint; readonly y: bigint }) => P
}

/**
 * The part of `@noble/curves/secp256k1` (1.x, the copy the Spark SDK, its
 * `@scure/bip32` and `@scure/btc-signer` share) the wrapper touches.
 */
export interface NobleSecp256k1Module<P extends NoblePoint = NoblePoint> {
  readonly secp256k1: {
    readonly CURVE: { readonly p: bigint; readonly n: bigint }
    readonly Point: NoblePointClass<P>
    readonly getPublicKey: (
      secretKey: unknown,
      isCompressed?: boolean
    ) => Uint8Array
  }
  readonly schnorr: {
    readonly utils: { readonly lift_x: (x: bigint) => P }
  }
}

/** The platform's native secp256k1, as Quick Crypto's OpenSSL offers it. */
export interface Secp256k1Native {
  /**
   * ECDH with a private key: its public key `key⋅G` (uncompressed,
   * `04 ‖ x ‖ y`) and, for each point `P` given (uncompressed), the x
   * coordinate of `key⋅P`. Throws for a point off the curve.
   */
  readonly ecdh: (
    privateKey: Uint8Array,
    points: ReadonlyArray<Uint8Array>
  ) => {
    readonly publicKey: Uint8Array
    readonly sharedXs: ReadonlyArray<Uint8Array>
  }
  /** The uncompressed form of a compressed point; throws off the curve. */
  readonly decompress: (point: Uint8Array) => Uint8Array
}

const HEX_BYTES = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, "0")
)

const bytesToHex = (bytes: Uint8Array): string => {
  let hex = ""
  for (const byte of bytes) hex += HEX_BYTES[byte]
  return hex
}

const bytesToBigInt = (bytes: Uint8Array): bigint =>
  BigInt(`0x${bytesToHex(bytes)}`)

// Each pair of hex digits as a byte, or null for any other string.
const hexToBytes = (hex: string): Uint8Array | null => {
  if (hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index++) {
    const pair = hex.slice(index * 2, index * 2 + 2)
    const byte = Number.parseInt(pair, 16)
    // parseInt reads a leading digit of "1x" as 1.
    if (HEX_BYTES[byte] !== pair.toLowerCase()) return null
    bytes[index] = byte
  }
  return bytes
}

// Callers pass a scalar or coordinate below 2^256, never a negative one.
const bigIntTo32Bytes = (value: bigint): Uint8Array => {
  const bytes = hexToBytes(value.toString(16).padStart(64, "0"))
  if (bytes?.length !== 32) throw new Error("Expected a 256-bit number.")
  return bytes
}

/**
 * How many public keys `getPublicKey` remembers, enough for every leaf of a
 * wallet the Spark SDK walks at each sync.
 */
const PUBLIC_KEY_CACHE_SIZE = 4096

const isCompressedPoint = (bytes: Uint8Array): boolean =>
  bytes.length === 33 && (bytes[0] === 0x02 || bytes[0] === 0x03)

const equalBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, index) => byte === b[index])

/**
 * Spark's secp256k1 with the point operations that cost it most on Hermes
 * computed natively: multiplying a point by a scalar (behind public keys and
 * every ECDSA and Schnorr signature, verification and recovery) and decoding
 * a compressed point (`Point.fromHex`, `schnorr.utils.lift_x`). Noble does
 * them with BigInt arithmetic, and builds a table for the generator first,
 * ~5 s alone on a 32-bit payment terminal, where the Spark SDK held the JS
 * thread for ~18 s at start and again after each received payment. Noble
 * still does everything around them, so it returns its own values, and every
 * input outside the native path goes to noble, so errors stay noble's.
 *
 * `secp256k1.getPublicKey` also remembers the public keys it computed, by
 * private key, for the session: the SDK derives every leaf's key at each sync
 * and claim, each twice (`@scure/bip32` computes a child's public key, then
 * the SDK asks for it again). The private keys it holds are those the SDK
 * already keeps in memory; the nonces signing multiplies by never reach it.
 *
 * Replaces the methods on noble's point class in place, so call it once per
 * module instance.
 */
export const wrapSecp256k1 = <P extends NoblePoint>(
  noble: NobleSecp256k1Module<P>,
  native: Secp256k1Native
) => {
  const { secp256k1, schnorr } = noble
  const { Point, CURVE } = secp256k1
  const { prototype, BASE } = Point
  const nobleMultiply = prototype.multiply
  const nobleMultiplyUnsafe = prototype.multiplyUnsafe
  const nobleFromHex = Point.fromHex
  const nobleLiftX = schnorr.utils.lift_x

  const pointOf = (uncompressed: Uint8Array): P => {
    const point = Point.fromAffine({
      x: bytesToBigInt(uncompressed.subarray(1, 33)),
      y: bytesToBigInt(uncompressed.subarray(33, 65)),
    })
    point.assertValidity()
    return point
  }

  // A point that fails natively goes to noble, which throws its own error.
  const decodeCompressed = (bytes: Uint8Array): P | null => {
    try {
      return pointOf(native.decompress(bytes))
    } catch {
      return null
    }
  }

  const xOf = (point: P): Uint8Array => point.toRawBytes(true).subarray(1)

  // `scalar⋅point` natively, or null to leave it to noble: a scalar out of
  // 1..n-1 (noble rejects it or, unsafe, handles 0 itself), the point at
  // infinity, or a point ECDH refuses, such as -G for the check below.
  const multiplyNatively = (point: P, scalar: bigint): P | null => {
    if (typeof scalar !== "bigint" || scalar <= 0n || scalar >= CURVE.n)
      return null
    const key = bigIntTo32Bytes(scalar)
    if (point === BASE) return pointOf(native.ecdh(key, []).publicKey)
    if (point.is0()) return null
    try {
      // ECDH gives only the x of k⋅P, which fits two points, Y and -Y. Of
      // Y + k⋅G and -Y + k⋅G exactly one has the x of k⋅(P + G), since
      // neither k⋅P nor k⋅G is the point at infinity in a group of prime
      // order, so that x tells which one is k⋅P.
      const {
        publicKey,
        sharedXs: [x, check],
      } = native.ecdh(key, [
        point.toRawBytes(false),
        point.add(BASE).toRawBytes(false),
      ])
      if (x === undefined || check === undefined) return null
      const kG = pointOf(publicKey)
      const even = pointOf(native.decompress(Uint8Array.of(0x02, ...x)))
      if (equalBytes(xOf(even.add(kG)), check)) return even
      const odd = even.negate()
      return equalBytes(xOf(odd.add(kG)), check) ? odd : null
    } catch {
      return null
    }
  }

  prototype.multiply = function (this: P, scalar: bigint) {
    return multiplyNatively(this, scalar) ?? nobleMultiply.call(this, scalar)
  }
  prototype.multiplyUnsafe = function (this: P, scalar: bigint) {
    return (
      multiplyNatively(this, scalar) ?? nobleMultiplyUnsafe.call(this, scalar)
    )
  }

  Point.fromHex = (hex) => {
    const bytes = typeof hex === "string" ? hexToBytes(hex) : hex
    const point =
      bytes instanceof Uint8Array && isCompressedPoint(bytes)
        ? decodeCompressed(bytes)
        : null
    return point ?? nobleFromHex.call(Point, hex)
  }

  // BIP-340's lift_x: the point with an even y, which the 02 prefix picks.
  // Noble's own Schnorr verification keeps its private copy.
  const liftX = (x: bigint): P => {
    const point =
      typeof x === "bigint" && x > 0n && x < CURVE.p
        ? decodeCompressed(Uint8Array.of(0x02, ...bigIntTo32Bytes(x)))
        : null
    return point ?? nobleLiftX(x)
  }

  // Newest last, so the first is the one to forget.
  const publicKeys = new Map<string, Uint8Array>()
  const nobleGetPublicKey = secp256k1.getPublicKey
  const getPublicKey = (secretKey: unknown, isCompressed = true) => {
    // One entry per key, whether it comes as 32 bytes (from the SDK) or as a
    // bigint (from `@scure/bip32`); any other form is left to noble.
    const id =
      secretKey instanceof Uint8Array && secretKey.length === 32
        ? bytesToHex(secretKey)
        : typeof secretKey === "bigint" && secretKey > 0n && secretKey < CURVE.n
          ? secretKey.toString(16).padStart(64, "0")
          : null
    if (id === null) return nobleGetPublicKey(secretKey, isCompressed)
    const key = `${isCompressed}:${id}`
    const cached = publicKeys.get(key)
    if (cached !== undefined) {
      publicKeys.delete(key)
      publicKeys.set(key, cached)
      return cached.slice()
    }
    // Noble throws for an invalid key, which is then never remembered.
    const publicKey = nobleGetPublicKey(secretKey, isCompressed)
    publicKeys.set(key, publicKey.slice())
    if (publicKeys.size > PUBLIC_KEY_CACHE_SIZE) {
      const [oldest] = publicKeys.keys()
      if (oldest !== undefined) publicKeys.delete(oldest)
    }
    return publicKey
  }

  return {
    secp256k1: { ...secp256k1, getPublicKey },
    schnorr: { ...schnorr, utils: { ...schnorr.utils, lift_x: liftX } },
  }
}
