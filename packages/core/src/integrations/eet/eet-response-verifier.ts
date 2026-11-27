import type { ResponseSignatureVerifier } from "@finitoapp/eet-client"

import type { DateDep } from "../../deps.ts"
import {
  type EetNativeCrypto,
  RSA_SHA256,
  readX509Certificate,
} from "./eet-certificate.ts"

export const EET_RESPONSE_SIGNER_ORGANIZATION = "Generální finanční ředitelství"

/**
 * Accepts a response signed by a currently valid certificate of the GFŘ,
 * checked with that certificate's own key. With `native`, the signature
 * check runs on eet-client's React Native verifier, pinned to that same
 * leaf; otherwise on Web Crypto.
 */
export const createEetResponseVerifier = (
  deps: DateDep,
  native?: EetNativeCrypto
): ResponseSignatureVerifier => ({
  verify: async (input) => {
    const { signature } = input
    const [leafDer] = signature.certificates
    if (leafDer === undefined) return false

    const leaf = readX509Certificate(leafDer)
    if (!leaf.ok) return false

    const now = deps.date.now()
    const { organization, validFrom, validTo, subjectPublicKeyInfo } =
      leaf.value
    if (organization !== EET_RESPONSE_SIGNER_ORGANIZATION) return false
    if (now < validFrom || now > validTo) return false

    if (native !== undefined) {
      const publicKey = native.importPublicKey(subjectPublicKeyInfo)
      if (!publicKey.ok) return false
      try {
        return await native
          .createResponseSignatureVerifier(publicKey.value, leafDer)
          .verify(input)
      } catch {
        return false
      }
    }

    try {
      const publicKey = await crypto.subtle.importKey(
        "spki",
        subjectPublicKeyInfo as BufferSource,
        RSA_SHA256,
        false,
        ["verify"]
      )
      return await crypto.subtle.verify(
        RSA_SHA256.name,
        publicKey,
        signature.signatureValue as BufferSource,
        signature.signedInfoCanonical as BufferSource
      )
    } catch {
      return false
    }
  },
})
