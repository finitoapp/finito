import { NativeModule, requireOptionalNativeModule } from "expo"
import { encode } from "uqr"

/**
 * One SVG path covering every dark module of the QR for `value`, in module
 * units (one unit per module, no quiet zone), plus the side length. Medium
 * error correction, as the web `qrcode.react` default.
 */
interface QrPath {
  readonly size: number
  readonly path: string
}

/** `modules/finito-qr`: ZXing's encoder, compiled. */
declare class FinitoQrNativeModule extends NativeModule {
  qrPath(text: string): QrPath
}

// Absent on the PWA and in a binary built before the module existed: those
// encode in JS, where choosing the mask scores all eight, 0.85-1.4 s of a
// PAX A920Pro's JS thread for a Lightning invoice.
const nativeQr = requireOptionalNativeModule<FinitoQrNativeModule>("FinitoQr")

/**
 * A bech32 string (a BOLT11 invoice, a Spark invoice) reads the same in
 * either case, and uppercase fits QR's alphanumeric mode, 5.5 bits a
 * character instead of 8: a version 18 code instead of 23 for an invoice,
 * quicker to encode and to scan.
 */
const bech32 = /^[a-z0-9]+1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,}$/

/**
 * What ZXing encodes without an ECI header, as the JS encoder does: other
 * text (a bank QR's recipient with diacritics) stays with the JS encoder,
 * so its bytes do not change.
 */
const ascii = /^[\x20-\x7e]*$/

/**
 * Recent paths by value: switching payment tabs remounts the QR, and a
 * Lightning invoice's matrix is large. ponytail: a tiny FIFO, enough for the
 * one payment on screen; the oldest entry goes first.
 */
const recent = new Map<string, QrPath>()
const recentLimit = 8

export function qrPath(value: string): QrPath {
  const cached = recent.get(value)
  if (cached !== undefined) return cached
  const computed = computeQrPath(value)
  recent.set(value, computed)
  const oldest = recent.keys().next()
  if (recent.size > recentLimit && oldest.done !== true)
    recent.delete(oldest.value)
  return computed
}

function computeQrPath(value: string): QrPath {
  const text = bech32.test(value) ? value.toUpperCase() : value
  if (nativeQr !== null && ascii.test(text)) {
    const { size, path } = nativeQr.qrPath(text)
    return { size, path }
  }
  const { data, size } = encode(text, { ecc: "M", border: 0 })
  let path = ""
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`
    })
  })
  return { size, path }
}
