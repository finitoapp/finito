import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { hmac } from "@noble/hashes/hmac.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { base64 } from "@scure/base"
import { z } from "zod"

import {
  type NostrEvent,
  signNostrEvent,
} from "../../integrations/nostr/nostr-event.ts"
import { jsonCodec } from "../../zod-utils.ts"
import { BankQrFormatSchema } from "../account/account-types.ts"
import { deriveLabeledKey } from "../shared/labeled-key.ts"
import { FiatCurrencySchema, HexSchema, IbanSchema } from "../shared/schema.ts"
import { SelfPayReferenceSchema } from "./table-self-pay-reference-utils.ts"

export const SELF_PAY_VIEW_KIND = 30_078
export const SELF_PAY_STALE_AFTER_SECONDS = 10 * 60

const VIEW_EXPIRATION_SECONDS = 30 * 24 * 60 * 60
const LIVENESS_EXPIRATION_SECONDS = 24 * 60 * 60
const MIN_PADDED_LENGTH = 1024
const NONCE_LENGTH = 24
const AUTH_TAG_LENGTH = 16
const PADDING_BYTE = 0x20
const VIEW_CONTENT_BUDGET = 60 * 1024

const AmountSchema = z.number().int().nonnegative()
const EpochSecondsSchema = z.number().int().nonnegative()

const SelfPayLineKeySchema = z.string().regex(/^[A-Z2-7]{8}$/u)

const SelfPayViewLineSchema = z.object({
  key: SelfPayLineKeySchema,
  name: z.string(),
  quantity: z.number().positive(),
  totalAmount: AmountSchema,
  allocatedAmount: AmountSchema,
})

const SelfPayViewBillSchema = z.object({
  reference: SelfPayReferenceSchema,
  currency: FiatCurrencySchema,
  total: AmountSchema,
  covered: AmountSchema,
  remainder: AmountSchema,
  lines: z.array(SelfPayViewLineSchema),
})

export const SelfPayShareBillSchema = SelfPayViewBillSchema.pick({
  remainder: true,
}).extend({
  lines: z
    .array(
      SelfPayViewLineSchema.pick({
        key: true,
        quantity: true,
        totalAmount: true,
        allocatedAmount: true,
      })
    )
    .readonly(),
})

export const SelfPayViewSchema = z.object({
  v: z.literal(1),
  table: z.string(),
  enabled: z.boolean(),
  payee: z.string().nullable(),
  bank: z
    .object({
      iban: IbanSchema,
      accountName: z.string(),
      currency: FiatCurrencySchema,
      qrFormat: BankQrFormatSchema,
    })
    .nullable(),
  lightning: z.object({ identityPublicKey: HexSchema(33) }).nullable(),
  selectionKey: HexSchema(32).nullable(),
  bills: z.array(SelfPayViewBillSchema),
  confirmations: z.array(
    z.object({
      pointerHash: HexSchema(8),
      amount: AmountSchema,
      currency: FiatCurrencySchema,
      at: EpochSecondsSchema,
    })
  ),
})
export type SelfPayView = z.output<typeof SelfPayViewSchema>
export type SelfPayViewBill = z.output<typeof SelfPayViewBillSchema>
export type SelfPayViewLine = SelfPayViewBill["lines"][number]
export type SelfPayConfirmation = SelfPayView["confirmations"][number]

export const SelfPayLivenessSchema = z.object({
  v: z.literal(1),
  viewVersion: EpochSecondsSchema,
  rates: z.array(
    z.object({
      currency: FiatCurrencySchema,
      msatPerMajor: z.number().int().positive(),
      validFrom: EpochSecondsSchema,
      tag: z.string(),
    })
  ),
})
export type SelfPayLiveness = z.output<typeof SelfPayLivenessSchema>

const encodeText = (text: string) => new TextEncoder().encode(text)

export const deriveSelfPayViewSubkey = (
  viewKey: Uint8Array,
  name: "tag" | "nonce" | "encrypt"
): Uint8Array => deriveLabeledKey(viewKey, `payky/self-pay/view/${name}`)

const deriveTag = (viewKey: Uint8Array, label: string) =>
  bytesToHex(
    hmac(sha256, deriveSelfPayViewSubkey(viewKey, "tag"), encodeText(label))
  )

export const deriveSelfPayViewTag = (viewKey: Uint8Array) =>
  deriveTag(viewKey, "d")

export const deriveSelfPayLivenessTag = (viewKey: Uint8Array) =>
  deriveTag(viewKey, "alive")

const paddedLength = (length: number) => {
  let padded = MIN_PADDED_LENGTH
  while (padded < length) padded *= 2
  return padded
}

const padToPowerOfTwo = (plaintext: Uint8Array): Uint8Array => {
  const padded = new Uint8Array(paddedLength(plaintext.length)).fill(
    PADDING_BYTE
  )
  padded.set(plaintext)
  return padded
}

const encryptedContentLength = (text: string) =>
  4 *
  Math.ceil(
    (NONCE_LENGTH + paddedLength(encodeText(text).length) + AUTH_TAG_LENGTH) / 3
  )

const fitsIntoEvent = (view: SelfPayView) =>
  encryptedContentLength(JSON.stringify(view)) <= VIEW_CONTENT_BUDGET

export const fitSelfPayViewIntoEvent = (view: SelfPayView): SelfPayView => {
  let fitted = view
  while (!fitsIntoEvent(fitted) && fitted.bills.length > 0) {
    const mostLines = Math.max(...fitted.bills.map(({ lines }) => lines.length))
    const largest = fitted.bills.findIndex(
      ({ lines }) => lines.length === mostLines
    )
    fitted = {
      ...fitted,
      bills:
        mostLines > 0
          ? fitted.bills.map((bill, index) =>
              index === largest ? { ...bill, lines: [] } : bill
            )
          : fitted.bills.slice(0, -1),
    }
  }
  return fitted
}

export const encryptSelfPayContent = (
  viewKey: Uint8Array,
  text: string
): string => {
  const plaintext = padToPowerOfTwo(encodeText(text))
  const nonce = hmac(
    sha256,
    deriveSelfPayViewSubkey(viewKey, "nonce"),
    plaintext
  ).slice(0, NONCE_LENGTH)
  const ciphertext = xchacha20poly1305(
    deriveSelfPayViewSubkey(viewKey, "encrypt"),
    nonce
  ).encrypt(plaintext)
  return base64.encode(new Uint8Array([...nonce, ...ciphertext]))
}

export const decryptSelfPayContent = (
  viewKey: Uint8Array,
  content: string
): string | null => {
  try {
    const payload = base64.decode(content)
    const nonce = payload.slice(0, NONCE_LENGTH)
    const plaintext = xchacha20poly1305(
      deriveSelfPayViewSubkey(viewKey, "encrypt"),
      nonce
    ).decrypt(payload.slice(NONCE_LENGTH))
    return new TextDecoder().decode(plaintext).trimEnd()
  } catch {
    return null
  }
}

export const parseSelfPayContent = <T>(
  schema: z.ZodType<T>,
  viewKey: Uint8Array,
  content: string
): T | null => {
  const text = decryptSelfPayContent(viewKey, content)
  if (text === null) return null
  const parsed = z.safeDecode(jsonCodec(schema), text)
  return parsed.success ? parsed.data : null
}

export const createSelfPayViewEvent = ({
  signingKey,
  viewKey,
  view,
  version,
}: {
  readonly signingKey: Uint8Array
  readonly viewKey: Uint8Array
  readonly view: SelfPayView
  readonly version: number
}): NostrEvent =>
  signNostrEvent(signingKey, {
    created_at: version,
    kind: SELF_PAY_VIEW_KIND,
    tags: [
      ["d", deriveSelfPayViewTag(viewKey)],
      ["expiration", String(version + VIEW_EXPIRATION_SECONDS)],
    ],
    content: encryptSelfPayContent(viewKey, JSON.stringify(view)),
  })

export const createSelfPayLivenessEvent = ({
  signingKey,
  viewKey,
  liveness,
  now,
}: {
  readonly signingKey: Uint8Array
  readonly viewKey: Uint8Array
  readonly liveness: SelfPayLiveness
  readonly now: number
}): NostrEvent =>
  signNostrEvent(signingKey, {
    created_at: now,
    kind: SELF_PAY_VIEW_KIND,
    tags: [
      ["d", deriveSelfPayLivenessTag(viewKey)],
      ["expiration", String(now + LIVENESS_EXPIRATION_SECONDS)],
    ],
    content: encryptSelfPayContent(viewKey, JSON.stringify(liveness)),
  })

export const createDisabledSelfPayView = (table: string): SelfPayView => ({
  v: 1,
  table,
  enabled: false,
  payee: null,
  bank: null,
  lightning: null,
  selectionKey: null,
  bills: [],
  confirmations: [],
})
