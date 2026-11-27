/** Noble's one-shot `hmac(hash, key, message)`, with its incremental `create`. */
export interface NobleHmac {
  (hash: unknown, key: unknown, message: unknown): Uint8Array
  readonly create: (hash: unknown, key: unknown) => unknown
}

export type HmacAlgorithm = "sha256" | "sha512"

/**
 * Spark's one-shot HMAC with SHA-256 and SHA-512 computed natively: the
 * HMAC-SHA512 behind every `@scure/bip32` child key, which the Spark SDK
 * derives for each leaf, and the HMAC-SHA256 of ECDSA's RFC 6979 nonces.
 * Noble hashes in pure JS, which cost the Spark SDK ~1.5 s of a payment
 * terminal's JS thread at start. Any other hash, a string key or message,
 * and the incremental `create` stay noble's.
 */
export const wrapHmac = (
  nobleHmac: NobleHmac,
  algorithms: ReadonlyMap<unknown, HmacAlgorithm>,
  native: (
    algorithm: HmacAlgorithm,
    key: Uint8Array,
    message: Uint8Array
  ) => Uint8Array
): NobleHmac =>
  Object.assign(
    (hash: unknown, key: unknown, message: unknown) => {
      const algorithm = algorithms.get(hash)
      return algorithm !== undefined &&
        key instanceof Uint8Array &&
        message instanceof Uint8Array
        ? native(algorithm, key, message)
        : nobleHmac(hash, key, message)
    },
    { create: nobleHmac.create }
  )
