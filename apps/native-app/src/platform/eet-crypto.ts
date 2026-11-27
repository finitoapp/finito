import {
  createReactNativeCrypto,
  type QuickCryptoBackend,
} from "@finitoapp/eet-client/react-native"
import { randomUUID } from "expo-crypto"
import {
  type FinitoCrypto,
  finitoCrypto,
  type HashName,
} from "./finito-crypto.ts"

/** A key eet-client imported, as the DER the native module takes. */
interface RsaKey {
  readonly der: Uint8Array
}

const pemToDer = (pem: string): Uint8Array =>
  Uint8Array.from(
    atob(pem.replace(/-----(?:BEGIN|END) [A-Z ]+-----|\s/gu, "")),
    (char) => char.charCodeAt(0)
  )

const hashName = (algorithm: string): HashName => {
  if (algorithm === "sha1") return "SHA-1"
  if (algorithm === "sha256") return "SHA-256"
  throw new Error(`Unsupported hash ${algorithm}.`)
}

// eet-client's hashes, fed in chunks and computed at once.
const chunked = (compute: (data: Uint8Array) => Uint8Array) => {
  const chunks: Uint8Array[] = []
  const hash = {
    update: (data: Uint8Array) => {
      chunks.push(Uint8Array.from(data))
      return hash
    },
    digest: () => {
      const data = new Uint8Array(
        chunks.reduce((length, chunk) => length + chunk.length, 0)
      )
      chunks.reduce((offset, chunk) => {
        data.set(chunk, offset)
        return offset + chunk.length
      }, 0)
      return compute(data)
    },
  }
  return hash
}

const assertRsaSha256 = (algorithm: string) => {
  if (algorithm !== "RSA-SHA256")
    throw new Error(`Unsupported signature ${algorithm}.`)
}

/**
 * eet-client's React Native backend, the structural subset of Quick Crypto
 * it asks for, over `modules/finito-crypto`: hashes, the PKCS#12 MAC's HMAC,
 * and RSA-SHA256 request signing and response checking. A key is imported
 * as its PEM's DER, checked natively, so a bad one fails at import as it
 * would in Quick Crypto, which this replaces.
 */
export const createEetCryptoBackend = (
  native: FinitoCrypto,
  createUuid: () => string
): QuickCryptoBackend<RsaKey, RsaKey> => ({
  createHash: (algorithm) =>
    chunked((data) => native.digest(hashName(algorithm), data)),
  createHmac: (algorithm, key) =>
    chunked((data) => native.hmac(hashName(algorithm), key, data)),
  randomUUID: createUuid,
  createPrivateKey: (pem) => {
    const der = pemToDer(pem)
    native.rsaCheckKey("pkcs8", der)
    return { der }
  },
  createPublicKey: (pem) => {
    const der = pemToDer(pem)
    native.rsaCheckKey("spki", der)
    return { der }
  },
  sign: (algorithm, data, key) => {
    assertRsaSha256(algorithm)
    return native.rsaSign(key.der, data)
  },
  verify: (algorithm, data, key, signature) => {
    assertRsaSha256(algorithm)
    return native.rsaVerify(key.der, data, signature)
  },
})

/**
 * EET's crypto on this device, passed explicitly to core's EET helpers
 * (`EetNativeCrypto`), so PKCS#12, request signing and the response check do
 * not go through the global `crypto.subtle` polyfill.
 */
export const eetNativeCrypto = createReactNativeCrypto(
  createEetCryptoBackend(finitoCrypto, randomUUID)
)
