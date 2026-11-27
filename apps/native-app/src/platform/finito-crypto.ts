import { type NativeModule, requireNativeModule } from "expo"

/** The hashes `modules/finito-crypto` takes, named as Web Crypto names them. */
export type HashName = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"

/**
 * `modules/finito-crypto`: hashes, HMAC, PBKDF2 and RSA PKCS#1 v1.5 with
 * SHA-256 from Android's own crypto provider, and base64 decoding,
 * synchronous. Each throws for
 * input the provider rejects.
 */
export interface FinitoCrypto {
  digest(hash: HashName, data: Uint8Array): Uint8Array
  hmac(hash: HashName, key: Uint8Array, data: Uint8Array): Uint8Array
  pbkdf2(
    hash: HashName,
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    length: number
  ): Uint8Array
  /** `pbkdf2` off the JS thread. */
  pbkdf2Async(
    hash: HashName,
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    length: number
  ): Promise<Uint8Array>
  /** Standard base64 to bytes; throws for anything else, URL-safe included. */
  base64Decode(text: string): Uint8Array
  rsaSign(pkcs8: Uint8Array, data: Uint8Array): Uint8Array
  rsaVerify(spki: Uint8Array, data: Uint8Array, signature: Uint8Array): boolean
  /** Throws unless `der` is an RSA key in `format`. */
  rsaCheckKey(format: "pkcs8" | "spki", der: Uint8Array): void
  rsaGenerate(
    modulusLength: number,
    publicExponent: Uint8Array
  ): { readonly pkcs8: Uint8Array; readonly spki: Uint8Array }
}

declare class FinitoCryptoNativeModule
  extends NativeModule
  implements FinitoCrypto
{
  digest(hash: HashName, data: Uint8Array): Uint8Array
  hmac(hash: HashName, key: Uint8Array, data: Uint8Array): Uint8Array
  pbkdf2(
    hash: HashName,
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    length: number
  ): Uint8Array
  /** `pbkdf2` off the JS thread. */
  pbkdf2Async(
    hash: HashName,
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    length: number
  ): Promise<Uint8Array>
  base64Decode(text: string): Uint8Array
  rsaSign(pkcs8: Uint8Array, data: Uint8Array): Uint8Array
  rsaVerify(spki: Uint8Array, data: Uint8Array, signature: Uint8Array): boolean
  rsaCheckKey(format: "pkcs8" | "spki", der: Uint8Array): void
  rsaGenerate(
    modulusLength: number,
    publicExponent: Uint8Array
  ): { readonly pkcs8: Uint8Array; readonly spki: Uint8Array }
}

// Every Android binary carries the module; the PWA has its own `.web` files.
export const finitoCrypto: FinitoCrypto =
  requireNativeModule<FinitoCryptoNativeModule>("FinitoCrypto")
