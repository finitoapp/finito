import { err, ok, type Result } from "@evolu/common"
import { sha256 } from "@noble/hashes/sha2.js"
import { bech32, bech32m, hex } from "@scure/base"
import { decode as decodeBolt11 } from "light-bolt11-decoder"
import { defineError } from "../../error.ts"

export interface LightningInvoice {
  /** Lowercased, without a `lightning:` scheme. */
  readonly invoice: string
  readonly amountMsat: bigint | null
  /** Rounded up to whole sats, as the Spark SDK rounds it; `null` for an amountless invoice. */
  readonly amountSats: number | null
  readonly description: string | null
  readonly paymentHash: string | null
  readonly createdAt: number
  readonly expiresAt: number
  /** The recipient's Spark identity public key from the invoice's Spark fallback, if it has one. */
  readonly sparkFallbackIdentity: string | null
}

const createInvalidLightningInvoiceError = defineError(
  "InvalidLightningInvoice"
)()
export type InvalidLightningInvoiceError = ReturnType<
  typeof createInvalidLightningInvoiceError
>

const createLightningInvoiceWrongNetworkError = defineError(
  "LightningInvoiceWrongNetwork"
)()
export type LightningInvoiceWrongNetworkError = ReturnType<
  typeof createLightningInvoiceWrongNetworkError
>

export type ParseLightningInvoiceError =
  | InvalidLightningInvoiceError
  | LightningInvoiceWrongNetworkError

const stripScheme = (value: string, scheme: string): string =>
  value.toLowerCase().startsWith(scheme) ? value.slice(scheme.length) : value

const MAINNET_INVOICE_HRP = /^lnbc(\d+[munp]?)?$/
const NON_MAINNET_INVOICE_HRP = /^ln(bcrt|tbs|tb|sb)/
const DEFAULT_INVOICE_EXPIRY_SECONDS = 3600
// The short channel id the Spark SDK marks a route hint with when the hint's
// `pubkey` is the receiver's Spark identity (`bolt11-spark.ts`).
const SPARK_IDENTITY_SHORT_CHANNEL_ID = "f42400f424000001"
// The fallback-address "witness version" the SDK uses for a Spark invoice.
const SPARK_INVOICE_FALLBACK_VERSION = 31
// BOLT11 and LNURL strings run past bech32's 90-character default limit.
const BECH32_LIMIT = Number.MAX_SAFE_INTEGER

/**
 * Bytes from 5-bit words, dropping trailing padding bits like the SDK's
 * `fromWordsLenient`: a Spark fallback's padding is not always canonical,
 * which `fromWords` would reject.
 */
const wordsToBytes = (words: ReadonlyArray<number>): Uint8Array => {
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const word of words) {
    value = ((value << 5) | word) & 0xffff
    bits += 5
    while (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}

/**
 * The bytes of a bech32 string (an `lnurl1…`), or `null` unless its checksum
 * holds: a mistyped character must not decode into some other destination.
 */
export const decodeBech32Bytes = (value: string): Uint8Array | null => {
  const decoded = bech32.decodeUnsafe(value.toLowerCase(), BECH32_LIMIT)
  return decoded ? (bech32.fromWordsUnsafe(decoded.words) ?? null) : null
}

/**
 * The identity public key of a Spark address or Spark invoice: field 1 of its
 * `SparkAddress` protobuf, which encoders write first.
 */
const sparkAddressIdentity = (address: string): string | null => {
  const decoded = bech32m.decodeUnsafe(address.toLowerCase(), BECH32_LIMIT)
  if (!decoded) return null
  const bytes = wordsToBytes(decoded.words)
  const length = bytes[1]
  if (bytes[0] !== 0x0a || length === undefined || length > 0x7f) return null
  const identity = bytes.slice(2, 2 + length)
  return identity.length === length ? hex.encode(identity) : null
}

interface FallbackAddressValue {
  readonly tagCode: number
  readonly words: string
}

const isFallbackAddressValue = (
  value: unknown
): value is FallbackAddressValue =>
  typeof value === "object" &&
  value !== null &&
  "words" in value &&
  typeof value.words === "string"

/**
 * Reads the Spark fallback the way the SDK's `decodeInvoice` does: the
 * `fallback_address` field (a Spark invoice under version 31) first, then a
 * route hint whose short channel id marks its pubkey as the Spark identity.
 */
const readSparkFallbackIdentity = (
  decoded: ReturnType<typeof decodeBolt11>
): string | null => {
  for (const section of decoded.sections) {
    if (!("name" in section) || (section.name as string) !== "fallback_address")
      continue
    const value: unknown = "value" in section ? section.value : undefined
    if (!isFallbackAddressValue(value)) continue
    const words = bech32.decodeUnsafe(value.words, BECH32_LIMIT)?.words
    if (words?.[0] !== SPARK_INVOICE_FALLBACK_VERSION) continue
    const sparkInvoice = new TextDecoder().decode(wordsToBytes(words.slice(1)))
    const identity = sparkAddressIdentity(sparkInvoice)
    if (identity !== null) return identity
  }

  for (const hints of decoded.route_hints) {
    for (const hint of hints) {
      if (hint.short_channel_id === SPARK_IDENTITY_SHORT_CHANNEL_ID) {
        return hint.pubkey
      }
    }
  }
  return null
}

const sectionValue = (
  decoded: ReturnType<typeof decodeBolt11>,
  name: string
): unknown => {
  const section = decoded.sections.find((s) => s.name === name)
  return section !== undefined && "value" in section ? section.value : undefined
}

/**
 * Decodes a mainnet BOLT11 invoice. The network comes from the whole
 * human-readable part (everything before the last `1`), so `lnbcrt…` is not
 * taken for mainnet.
 */
export const parseLightningInvoice = (
  raw: string
): Result<LightningInvoice, ParseLightningInvoiceError> => {
  const invoice = stripScheme(raw.trim(), "lightning:").toLowerCase()
  const hrp = invoice.slice(0, invoice.lastIndexOf("1"))
  if (!MAINNET_INVOICE_HRP.test(hrp)) {
    return err(
      NON_MAINNET_INVOICE_HRP.test(hrp)
        ? createLightningInvoiceWrongNetworkError()
        : createInvalidLightningInvoiceError()
    )
  }

  let decoded: ReturnType<typeof decodeBolt11>
  try {
    decoded = decodeBolt11(invoice)
  } catch {
    return err(createInvalidLightningInvoiceError())
  }

  const amountMsat = sectionValue(decoded, "amount")
  const timestamp = sectionValue(decoded, "timestamp")
  const expiry = sectionValue(decoded, "expiry")
  const description = sectionValue(decoded, "description")
  const paymentHash = sectionValue(decoded, "payment_hash")
  if (typeof timestamp !== "number") {
    return err(createInvalidLightningInvoiceError())
  }

  const msat = typeof amountMsat === "string" ? BigInt(amountMsat) : null
  return ok({
    invoice,
    amountMsat: msat,
    amountSats: msat === null ? null : Number((msat + 999n) / 1000n),
    description:
      typeof description === "string" && description !== ""
        ? description
        : null,
    paymentHash: typeof paymentHash === "string" ? paymentHash : null,
    createdAt: timestamp * 1000,
    expiresAt:
      (timestamp +
        (typeof expiry === "number"
          ? expiry
          : DEFAULT_INVOICE_EXPIRY_SECONDS)) *
      1000,
    sparkFallbackIdentity: readSparkFallbackIdentity(decoded),
  })
}

const HEX_32_BYTES = /^[0-9a-f]{64}$/

/**
 * Whether `preimage` is the proof an invoice was paid: 32 bytes of hex whose
 * SHA-256 is the invoice's `paymentHash` (lightning-address/0002).
 */
export const verifyLightningPreimage = ({
  preimage,
  paymentHash,
}: {
  readonly preimage: string
  readonly paymentHash: string
}): boolean => {
  const normalizedPreimage = preimage.trim().toLowerCase()
  const normalizedHash = paymentHash.trim().toLowerCase()
  if (
    !HEX_32_BYTES.test(normalizedPreimage) ||
    !HEX_32_BYTES.test(normalizedHash)
  ) {
    return false
  }
  return hex.encode(sha256(hex.decode(normalizedPreimage))) === normalizedHash
}
