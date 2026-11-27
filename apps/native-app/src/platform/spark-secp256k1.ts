/**
 * A point of noble's secp256k1. The wrapper replaces its multiplications on
 * the class prototype, which noble leaves unfrozen.
 */
interface NoblePoint {
  /** Projective coordinates: the affine point is (X/Z, Y/Z). */
  readonly X: bigint
  readonly Y: bigint
  readonly Z: bigint
  readonly assertValidity: () => void
  readonly toRawBytes: (isCompressed?: boolean) => Uint8Array
  toBytes: (isCompressed?: boolean) => Uint8Array
  // Method syntax: noble's own point class takes only its own points.
  add(other: this): this
  multiply: (scalar: bigint) => this
  multiplyUnsafe: (scalar: bigint) => this
}

/** The static side of noble's point class. */
interface NoblePointClass<P extends NoblePoint> {
  new (X: bigint, Y: bigint, Z: bigint): P
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

/**
 * The platform's native secp256k1, libsecp256k1 in the app
 * (`modules/finito-secp256k1`). Points are uncompressed (`04 ‖ x ‖ y`) but
 * for the one `decompress` takes, and each throws for a key, scalar or point
 * it rejects.
 */
export interface Secp256k1Native {
  /** `privateKey⋅G`. */
  readonly publicKey: (privateKey: Uint8Array) => Uint8Array
  /** `scalar⋅point`. */
  readonly multiply: (point: Uint8Array, scalar: Uint8Array) => Uint8Array
  /** `a + b`; throws for the point at infinity, too. */
  readonly add: (a: Uint8Array, b: Uint8Array) => Uint8Array
  /** A compressed point (`02`/`03` ‖ x) uncompressed. */
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

/**
 * Spark's secp256k1 with the point operations that cost it most on Hermes
 * computed natively: multiplying a point by a scalar (behind public keys and
 * every ECDSA and Schnorr signature, verification and recovery), decoding
 * a compressed point (`Point.fromHex`, `schnorr.utils.lift_x`) and adding two
 * points. Noble does them with BigInt arithmetic, and builds a table for the
 * generator first, ~5 s alone on a 32-bit payment terminal, where the Spark
 * SDK held the JS thread for ~18 s at start and again after each received
 * payment; native code takes under a millisecond for each from JS. Noble
 * still does everything around them, so it returns its own values, and every
 * input outside the native path goes to noble, so errors stay noble's.
 *
 * A point native code computed keeps its bytes, which `toBytes` and the next
 * native operation take as they are: noble would check the point against the
 * curve again, and a sum it computed itself would cost a modular inversion to
 * encode. The Spark SDK checks each leaf's key as such a sum at every sync
 * (`verifyKey` in `getLeaves`).
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
  const nobleAdd = prototype.add
  const nobleToBytes = prototype.toBytes
  const nobleFromHex = Point.fromHex
  const nobleLiftX = schnorr.utils.lift_x

  // Uncompressed bytes of the points native code returned, valid as
  // libsecp256k1 guarantees, so noble's own check is skipped.
  const nativeBytes = new WeakMap<P, Uint8Array>()

  const pointOf = (uncompressed: Uint8Array): P => {
    if (uncompressed.length !== 65 || uncompressed[0] !== 0x04)
      throw new Error("Expected an uncompressed point.")
    const point = Point.fromAffine({
      x: bytesToBigInt(uncompressed.subarray(1, 33)),
      y: bytesToBigInt(uncompressed.subarray(33, 65)),
    })
    nativeBytes.set(point, uncompressed)
    return point
  }

  // A point's uncompressed bytes without a modular inversion: one native code
  // computed, or an affine one (Z = 1), which native code then checks against
  // the curve. Null for any other, which noble's own `add` takes.
  const affineBytesOf = (point: P): Uint8Array | null => {
    const known = nativeBytes.get(point)
    if (known !== undefined) return known
    if (point.Z !== 1n) return null
    return Uint8Array.of(
      0x04,
      ...bigIntTo32Bytes(point.X),
      ...bigIntTo32Bytes(point.Y)
    )
  }

  // Whatever native code rejects goes to noble, which then throws its own
  // error or, for an input it takes, such as the point at infinity, answers.
  const natively = (compute: () => Uint8Array): P | null => {
    try {
      return pointOf(compute())
    } catch {
      return null
    }
  }

  // `scalar⋅point` natively, or null to leave it to noble: a scalar out of
  // 1..n-1 (noble rejects it or, unsafe, handles 0 itself).
  const multiplyNatively = (point: P, scalar: bigint): P | null => {
    if (typeof scalar !== "bigint" || scalar <= 0n || scalar >= CURVE.n)
      return null
    const key = bigIntTo32Bytes(scalar)
    return point === BASE
      ? natively(() => native.publicKey(key))
      : natively(() =>
          native.multiply(affineBytesOf(point) ?? point.toRawBytes(false), key)
        )
  }

  prototype.multiply = function (this: P, scalar: bigint) {
    return multiplyNatively(this, scalar) ?? nobleMultiply.call(this, scalar)
  }
  prototype.multiplyUnsafe = function (this: P, scalar: bigint) {
    return (
      multiplyNatively(this, scalar) ?? nobleMultiplyUnsafe.call(this, scalar)
    )
  }

  prototype.add = function (this: P, other: P) {
    const a = other instanceof Point ? affineBytesOf(this) : null
    const b = a === null ? null : affineBytesOf(other)
    const sum =
      a === null || b === null ? null : natively(() => native.add(a, b))
    return sum ?? nobleAdd.call(this, other)
  }

  prototype.toBytes = function (this: P, isCompressed = true) {
    const bytes =
      typeof isCompressed === "boolean" ? nativeBytes.get(this) : undefined
    if (bytes === undefined) return nobleToBytes.call(this, isCompressed)
    if (!isCompressed) return bytes.slice()
    const compressed = bytes.slice(0, 33)
    compressed[0] = 0x02 + ((bytes[64] ?? 0) & 1)
    return compressed
  }

  Point.fromHex = (hex) => {
    const bytes = typeof hex === "string" ? hexToBytes(hex) : hex
    const point =
      bytes instanceof Uint8Array && isCompressedPoint(bytes)
        ? natively(() => native.decompress(bytes))
        : null
    return point ?? nobleFromHex.call(Point, hex)
  }

  // BIP-340's lift_x: the point with an even y, which the 02 prefix picks.
  // Noble's own Schnorr verification keeps its private copy.
  const liftX = (x: bigint): P => {
    const point =
      typeof x === "bigint" && x > 0n && x < CURVE.p
        ? natively(() =>
            native.decompress(Uint8Array.of(0x02, ...bigIntTo32Bytes(x)))
          )
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
