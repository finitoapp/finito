/** Noble's one-shot `hmac(hash, key, message)`, with its incremental `create`. */
export interface NobleHmac {
  (hash: unknown, key: unknown, message: unknown): Uint8Array
  readonly create: (hash: unknown, key: unknown) => unknown
}

export type HmacAlgorithm = "SHA-256" | "SHA-512"

/**
 * Noble's one-shot HMAC with SHA-256 and SHA-512 computed natively. Noble
 * hashes in pure JS, which cost a payment terminal's JS thread ~1.5 s at
 * start in the Spark SDK (the HMAC-SHA512 behind every `@scure/bip32` child
 * key, which it derives for each leaf, and the HMAC-SHA256 of ECDSA's
 * RFC 6979 nonces) and ~0.6 s in Evolu, which derives its owners by SLIP-21.
 * Any other hash, a string key or message, and the incremental `create`
 * stay noble's.
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
