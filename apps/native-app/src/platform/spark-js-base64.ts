import * as jsBase64 from "spark:js-base64"
import { finitoCrypto } from "./finito-crypto.ts"
import { decodeBase64Natively } from "./native-base64.ts"

// What every import of the Spark SDK's `js-base64` gets on Android
// (`metro.config.js`): that module, with `toUint8Array` decoding natively.
export * from "spark:js-base64"

export const toUint8Array = decodeBase64Natively(
  jsBase64.toUint8Array,
  (text) => finitoCrypto.base64Decode(text)
)

export const Base64 = { ...jsBase64.Base64, toUint8Array }
