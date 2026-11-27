import { err, ok, type Result } from "@evolu/common"
import {
  parsePkcs12,
  pickPrivateKeyCertificate,
} from "@finitoapp/eet-client/pkcs12"
import type {
  EetClient,
  EetClientOptions,
  Result as EetResult,
  EetSigner,
  Pkcs12Contents,
  Pkcs12Error,
  ResponseSignatureVerifier,
} from "@finitoapp/eet-client/react-native"
import { AsnConvert } from "@peculiar/asn1-schema"
import { Certificate } from "@peculiar/asn1-x509"

import { defineError } from "../../error.ts"
import { type EetEic, EetEicSchema } from "../../modules/eet/eet-types.ts"

/**
 * eet-client's React Native crypto (`createReactNativeCrypto(backend)`),
 * which the native app passes in so EET runs on its native crypto explicitly
 * rather than on a global `crypto.subtle`. Without it, the EET helpers here
 * use Web Crypto, as the browser and Node do.
 */
export interface EetNativeCrypto {
  // Methods rather than function properties, so the backend's own key types
  // stay assignable to `unknown` here.
  parsePkcs12(
    data: Uint8Array,
    password: string
  ): Promise<EetResult<Pkcs12Contents, Pkcs12Error>>
  importPrivateKey(pkcs8: Uint8Array): EetResult<unknown, unknown>
  importPublicKey(spki: Uint8Array): EetResult<unknown, unknown>
  createSigner(certificateDer: Uint8Array, privateKey: unknown): EetSigner
  createResponseSignatureVerifier(
    publicKey: unknown,
    trustedCertificateDer: Uint8Array
  ): ResponseSignatureVerifier
  createEetClient(options: Omit<EetClientOptions, "cryptoBackend">): EetClient
}

export const RSA_SHA256 = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
} as const

const subjectAttributeOids = {
  commonName: "2.5.4.3",
  organization: "2.5.4.10",
  description: "2.5.4.13",
} as const

export interface X509CertificateFields {
  readonly commonName: string | null
  readonly organization: string | null
  readonly description: string | null
  readonly validFrom: Date
  readonly validTo: Date
  readonly subjectPublicKeyInfo: Uint8Array
}

export interface EetCertificateFile {
  readonly eic: EetEic
  readonly description: string | null
  readonly validFrom: Date
  readonly validTo: Date
  readonly certificateDer: Uint8Array
  readonly privateKeyPkcs8: Uint8Array
}

const createEetCertificateUnreadableError = defineError(
  "EetCertificateUnreadableError"
)()
export type EetCertificateUnreadableError = ReturnType<
  typeof createEetCertificateUnreadableError
>

const createEetCertificateWrongPasswordError = defineError(
  "EetCertificateWrongPasswordError"
)()
export type EetCertificateWrongPasswordError = ReturnType<
  typeof createEetCertificateWrongPasswordError
>

const createEetCertificateWithoutKeyError = defineError(
  "EetCertificateWithoutKeyError"
)()
export type EetCertificateWithoutKeyError = ReturnType<
  typeof createEetCertificateWithoutKeyError
>

const createEetCertificateWithoutEicError = defineError(
  "EetCertificateWithoutEicError"
)()
export type EetCertificateWithoutEicError = ReturnType<
  typeof createEetCertificateWithoutEicError
>

const createEetCertificateExpiredError = defineError(
  "EetCertificateExpiredError"
)<{ readonly validTo: Date }>()
export type EetCertificateExpiredError = ReturnType<
  typeof createEetCertificateExpiredError
>

const createEetCertificateNotYetValidError = defineError(
  "EetCertificateNotYetValidError"
)<{ readonly validFrom: Date }>()
export type EetCertificateNotYetValidError = ReturnType<
  typeof createEetCertificateNotYetValidError
>

export type EetCertificateError =
  | EetCertificateUnreadableError
  | EetCertificateWrongPasswordError
  | EetCertificateWithoutKeyError
  | EetCertificateWithoutEicError
  | EetCertificateExpiredError
  | EetCertificateNotYetValidError

export const readX509Certificate = (
  der: Uint8Array
): Result<X509CertificateFields, EetCertificateUnreadableError> => {
  try {
    const { tbsCertificate } = AsnConvert.parse(der, Certificate)
    const subjectAttribute = (type: string): string | null =>
      tbsCertificate.subject
        .flatMap((relativeName) => [...relativeName])
        .find((attribute) => attribute.type === type)
        ?.value.toString() ?? null

    return ok({
      commonName: subjectAttribute(subjectAttributeOids.commonName),
      organization: subjectAttribute(subjectAttributeOids.organization),
      description: subjectAttribute(subjectAttributeOids.description),
      validFrom: tbsCertificate.validity.notBefore.getTime(),
      validTo: tbsCertificate.validity.notAfter.getTime(),
      subjectPublicKeyInfo: new Uint8Array(
        AsnConvert.serialize(tbsCertificate.subjectPublicKeyInfo)
      ),
    })
  } catch {
    return err(createEetCertificateUnreadableError())
  }
}

export const importEetSigningKey = (
  privateKeyPkcs8: Uint8Array
): Promise<CryptoKey | null> =>
  crypto.subtle
    .importKey("pkcs8", privateKeyPkcs8 as BufferSource, RSA_SHA256, false, [
      "sign",
    ])
    .catch(() => null)

export const readEetCertificateFile = async ({
  file,
  password,
  now,
  native,
}: {
  readonly file: Uint8Array
  readonly password: string
  readonly now: Date
  readonly native?: EetNativeCrypto | undefined
}): Promise<Result<EetCertificateFile, EetCertificateError>> => {
  const contents = await (native?.parsePkcs12 ?? parsePkcs12)(file, password)
  if (!contents.ok) {
    return err(
      contents.error.type === "Pkcs12InvalidMacError"
        ? createEetCertificateWrongPasswordError()
        : createEetCertificateUnreadableError()
    )
  }

  const { privateKey } = contents.value
  const certificate = pickPrivateKeyCertificate(contents.value)
  if (privateKey === undefined || certificate === undefined) {
    return err(createEetCertificateWithoutKeyError())
  }

  const fields = readX509Certificate(certificate.der)
  if (!fields.ok) return fields

  const eic = EetEicSchema.safeParse(fields.value.commonName)
  if (!eic.success) return err(createEetCertificateWithoutEicError())

  const { validFrom, validTo, description } = fields.value
  if (now > validTo) return err(createEetCertificateExpiredError({ validTo }))
  if (now < validFrom) {
    return err(createEetCertificateNotYetValidError({ validFrom }))
  }

  const canSign =
    native === undefined
      ? (await importEetSigningKey(privateKey.der)) !== null
      : native.importPrivateKey(privateKey.der).ok
  if (!canSign) return err(createEetCertificateUnreadableError())

  return ok({
    eic: eic.data,
    description,
    validFrom,
    validTo,
    certificateDer: certificate.der,
    privateKeyPkcs8: privateKey.der,
  })
}
