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

const bytesToBigInt = (bytes: Uint8Array): bigint =>
  BigInt(
    `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  )

const bigIntTo32Bytes = (value: bigint): Uint8Array =>
  Uint8Array.from(
    value.toString(16).padStart(64, "0").match(/../g) ?? [],
    (pair) => Number.parseInt(pair, 16)
  )

const hexToBytes = (hex: string): Uint8Array | null =>
  /^(?:[0-9a-fA-F]{2})+$/.test(hex)
    ? Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
        Number.parseInt(pair, 16)
      )
    : null

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

  return {
    schnorr: { ...schnorr, utils: { ...schnorr.utils, lift_x: liftX } },
  }
}
