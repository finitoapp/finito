import type { FinitoCrypto, HashName } from "./finito-crypto.ts"

/**
 * The part of Web Crypto's `crypto.subtle` the native app and its libraries
 * use, over `modules/finito-crypto`:
 *
 * - `digest` with SHA-1, SHA-256, SHA-384 and SHA-512;
 * - HMAC: `importKey("raw")`, `sign`, `verify` (`slip39-ts`, `ai`, EET's
 *   test certificates);
 * - PBKDF2: `importKey("raw")`, `deriveBits` (the PIN hash, `slip39-ts`);
 * - RSASSA-PKCS1-v1_5 with SHA-256: `importKey("spki" | "pkcs8")`, `sign`,
 *   `verify`, `generateKey`, `exportKey` (EET and its diagnostics).
 *
 * Anything else rejects with a `NotSupportedError`, as Web Crypto does for
 * an algorithm it lacks: `@lightsparkdev/core`'s node-key helpers, which the
 * Spark SDK does not call, use AES-GCM and RSA-PSS.
 */

type KeyType = "secret" | "private" | "public"

interface NativeCryptoKey {
  readonly type: KeyType
  readonly extractable: boolean
  readonly algorithm: {
    readonly name: string
    readonly hash?: { name: string }
  }
  readonly usages: ReadonlyArray<string>
}

type AlgorithmInput =
  | string
  | { readonly name: string; readonly [key: string]: unknown }

const HMAC = "HMAC"
const PBKDF2 = "PBKDF2"
const RSA = "RSASSA-PKCS1-v1_5"
const HASHES: ReadonlyArray<HashName> = [
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
]

const error = (name: string, message: string) =>
  Object.assign(new Error(message), { name })

const notSupported = (what: string) =>
  error("NotSupportedError", `${what} is not supported on this device.`)

const nameOf = (algorithm: unknown): string => {
  const name =
    typeof algorithm === "string"
      ? algorithm
      : typeof algorithm === "object" &&
          algorithm !== null &&
          "name" in algorithm
        ? algorithm.name
        : undefined
  if (typeof name !== "string") throw new TypeError("Algorithm without a name.")
  const known = [HMAC, PBKDF2, RSA, ...HASHES].find(
    (candidate) => candidate.toUpperCase() === name.toUpperCase()
  )
  return known ?? name
}

const hashOf = (hash: unknown): HashName => {
  const name = nameOf(hash)
  const known = HASHES.find((candidate) => candidate === name)
  if (known === undefined) throw notSupported(`The hash ${name}`)
  return known
}

const field = (algorithm: AlgorithmInput, key: string): unknown =>
  typeof algorithm === "object" ? algorithm[key] : undefined

const bytesOf = (data: unknown): Uint8Array => {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  throw new TypeError("Expected an ArrayBuffer or a view of one.")
}

const bufferOf = (bytes: Uint8Array): ArrayBuffer =>
  Uint8Array.from(bytes).buffer

export const createSubtle = (native: FinitoCrypto) => {
  // Key material, kept off the key objects.
  const material = new WeakMap<NativeCryptoKey, Uint8Array>()

  const createKey = (
    key: NativeCryptoKey,
    bytes: Uint8Array
  ): NativeCryptoKey => {
    const frozen = Object.freeze(key)
    material.set(frozen, Uint8Array.from(bytes))
    return frozen
  }

  const materialOf = (key: unknown, type: KeyType, algorithm: string) => {
    const bytes =
      typeof key === "object" && key !== null
        ? material.get(key as NativeCryptoKey)
        : undefined
    const typed = key as NativeCryptoKey | undefined
    if (
      bytes === undefined ||
      typed?.type !== type ||
      typed.algorithm.name !== algorithm
    )
      throw error(
        "InvalidAccessError",
        `The key is not a ${algorithm} ${type} key.`
      )
    return { bytes, key: typed }
  }

  const hmacKeyHash = (key: NativeCryptoKey): HashName =>
    hashOf(key.algorithm.hash)

  const rsaHash = (algorithm: AlgorithmInput) => {
    if (hashOf(field(algorithm, "hash")) !== "SHA-256")
      throw notSupported(`${RSA} with another hash than SHA-256`)
  }

  return {
    digest: async (algorithm: AlgorithmInput, data: unknown) =>
      bufferOf(native.digest(hashOf(algorithm), bytesOf(data))),

    importKey: async (
      format: string,
      keyData: unknown,
      algorithm: AlgorithmInput,
      extractable: boolean,
      usages: ReadonlyArray<string>
    ) => {
      const name = nameOf(algorithm)
      const bytes = bytesOf(keyData)
      if (format === "raw" && name === HMAC) {
        const hash = { name: hashOf(field(algorithm, "hash")) }
        return createKey(
          { type: "secret", extractable, algorithm: { name, hash }, usages },
          bytes
        )
      }
      if (format === "raw" && name === PBKDF2)
        return createKey(
          { type: "secret", extractable: false, algorithm: { name }, usages },
          bytes
        )
      if ((format === "spki" || format === "pkcs8") && name === RSA) {
        rsaHash(algorithm)
        native.rsaCheckKey(format, bytes)
        return createKey(
          {
            type: format === "spki" ? "public" : "private",
            extractable,
            algorithm: { name, hash: { name: "SHA-256" } },
            usages,
          },
          bytes
        )
      }
      throw notSupported(`Importing a ${name} key as ${format}`)
    },

    exportKey: async (format: string, key: unknown) => {
      const typed = key as NativeCryptoKey
      const bytes =
        typeof key === "object" && key !== null
          ? material.get(typed)
          : undefined
      if (bytes === undefined || !typed.extractable)
        throw error("InvalidAccessError", "The key is not extractable.")
      const expected = { secret: "raw", private: "pkcs8", public: "spki" }[
        typed.type
      ]
      if (format !== expected)
        throw notSupported(`Exporting a ${typed.type} key as ${format}`)
      return bufferOf(bytes)
    },

    generateKey: async (
      algorithm: AlgorithmInput,
      extractable: boolean,
      usages: ReadonlyArray<string>
    ) => {
      if (nameOf(algorithm) !== RSA)
        throw notSupported(`Generating a ${nameOf(algorithm)} key`)
      rsaHash(algorithm)
      const modulusLength = field(algorithm, "modulusLength")
      if (typeof modulusLength !== "number")
        throw new TypeError("RSA key generation needs modulusLength.")
      const { pkcs8, spki } = native.rsaGenerate(
        modulusLength,
        bytesOf(field(algorithm, "publicExponent"))
      )
      const keyAlgorithm = { name: RSA, hash: { name: "SHA-256" } }
      return {
        // A public key is always extractable.
        publicKey: createKey(
          {
            type: "public",
            extractable: true,
            algorithm: keyAlgorithm,
            usages: usages.filter((usage) => usage === "verify"),
          },
          spki
        ),
        privateKey: createKey(
          {
            type: "private",
            extractable,
            algorithm: keyAlgorithm,
            usages: usages.filter((usage) => usage === "sign"),
          },
          pkcs8
        ),
      }
    },

    sign: async (algorithm: AlgorithmInput, key: unknown, data: unknown) => {
      const name = nameOf(algorithm)
      if (name === HMAC) {
        const { bytes, key: typed } = materialOf(key, "secret", HMAC)
        return bufferOf(native.hmac(hmacKeyHash(typed), bytes, bytesOf(data)))
      }
      if (name === RSA) {
        const { bytes } = materialOf(key, "private", RSA)
        return bufferOf(native.rsaSign(bytes, bytesOf(data)))
      }
      throw notSupported(`Signing with ${name}`)
    },

    verify: async (
      algorithm: AlgorithmInput,
      key: unknown,
      signature: unknown,
      data: unknown
    ) => {
      const name = nameOf(algorithm)
      if (name === HMAC) {
        const { bytes, key: typed } = materialOf(key, "secret", HMAC)
        const expected = native.hmac(hmacKeyHash(typed), bytes, bytesOf(data))
        const actual = bytesOf(signature)
        // Every byte compared, whatever differs first.
        let difference = expected.length ^ actual.length
        for (let index = 0; index < expected.length; index++)
          difference |= (expected[index] ?? 0) ^ (actual[index] ?? 0)
        return difference === 0
      }
      if (name === RSA) {
        const { bytes } = materialOf(key, "public", RSA)
        return native.rsaVerify(bytes, bytesOf(data), bytesOf(signature))
      }
      throw notSupported(`Verifying with ${name}`)
    },

    deriveBits: async (
      algorithm: AlgorithmInput,
      baseKey: unknown,
      length: number
    ) => {
      if (nameOf(algorithm) !== PBKDF2)
        throw notSupported(`Deriving bits with ${nameOf(algorithm)}`)
      const { bytes } = materialOf(baseKey, "secret", PBKDF2)
      const iterations = field(algorithm, "iterations")
      if (typeof iterations !== "number" || length <= 0 || length % 8 !== 0)
        throw error(
          "OperationError",
          "PBKDF2 needs iterations and whole bytes."
        )
      return bufferOf(
        await native.pbkdf2Async(
          hashOf(field(algorithm, "hash")),
          bytes,
          bytesOf(field(algorithm, "salt")),
          iterations,
          length / 8
        )
      )
    },

    deriveKey: async () => {
      throw notSupported("deriveKey")
    },
    encrypt: async () => {
      throw notSupported("encrypt")
    },
    decrypt: async () => {
      throw notSupported("decrypt")
    },
    wrapKey: async () => {
      throw notSupported("wrapKey")
    },
    unwrapKey: async () => {
      throw notSupported("unwrapKey")
    },
  }
}
