/**
 * `js-base64`'s `toUint8Array` with standard base64 decoded natively: the
 * Spark SDK's gRPC answers arrive from its native module base64-encoded, and
 * `js-base64` decodes them through `Buffer` and copies the result element by
 * element, which held a payment terminal's JS thread for ~1.3 s at start and
 * ~0.9 s after a received payment, ~100 times as long as native code (50 KB:
 * 355 ms against 3.6 ms). Whatever native decoding rejects, a URL-safe or
 * malformed string, goes to `js-base64`, which reads it as before.
 */
export const decodeBase64Natively =
  (
    jsToUint8Array: (text: string) => Uint8Array,
    nativeDecode: (text: string) => Uint8Array
  ) =>
  (text: string): Uint8Array => {
    try {
      return nativeDecode(text)
    } catch {
      return jsToUint8Array(text)
    }
  }
