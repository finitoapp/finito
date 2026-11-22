import { schnorr } from "@noble/curves/secp256k1.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { base32nopad } from "@scure/base"
import { z } from "zod"

import {
  type NostrEvent,
  signNostrEvent,
  verifyNostrEvent,
} from "../../integrations/nostr/nostr-event.ts"
import type { NostrFilter } from "../../integrations/nostr/nostr-relay-client.ts"
import { jsonCodec } from "../../zod-utils.ts"
import { deriveLabeledKey } from "../shared/labeled-key.ts"
import { HexSchema } from "../shared/schema.ts"
import {
  type SelfPayPointer,
  SelfPayPointerSchema,
  SelfPayReferenceSchema,
} from "./table-self-pay-reference-utils.ts"
import type {
  SelfPayShareBill,
  SelfPaySplit,
} from "./table-self-pay-share-utils.ts"
import {
  decryptSelfPayContent,
  encryptSelfPayContent,
  SELF_PAY_VIEW_KIND,
} from "./table-self-pay-view-utils.ts"

const POINTER_BYTES = 20
const NONCE_BYTES = 16
const VERSION_BYTES = 16
const SELECTION_EXPIRATION_SECONDS = 7 * 24 * 60 * 60
const MAX_SPLIT_DENOMINATOR = 1000
const MAX_SPLIT_LINES = 1000

const encodeText = (text: string) => new TextEncoder().encode(text)

const SplitPartSchema = z.number().int().positive().max(MAX_SPLIT_DENOMINATOR)

export const SelfPaySplitSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("remainder") }),
  z.object({
    kind: z.literal("amount"),
    amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
  z.object({
    kind: z.literal("lines"),
    fractions: z
      .array(
        z.object({
          key: z.string().regex(/^[A-Z2-7]{8}$/u),
          numerator: SplitPartSchema,
          denominator: SplitPartSchema,
        })
      )
      .min(1)
      .max(MAX_SPLIT_LINES)
      .refine(
        (fractions) =>
          new Set(fractions.map(({ key }) => key)).size === fractions.length
      )
      .readonly(),
  }),
  z.object({
    kind: z.literal("fractionOfBill"),
    denominator: SplitPartSchema.min(2),
  }),
])

export const SelfPayShareSelectionSchema = z.object({
  v: z.literal(1),
  kind: z.literal("share"),
  nonce: HexSchema(NONCE_BYTES),
  reference: SelfPayReferenceSchema,
  version: HexSchema(VERSION_BYTES),
  split: SelfPaySplitSchema,
})
export type SelfPayShareSelection = z.output<typeof SelfPayShareSelectionSchema>

export const createSelfPaySelectionNonce = (): string =>
  bytesToHex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)))

export const deriveSelfPayShareBillVersion = (bill: SelfPayShareBill): string =>
  bytesToHex(
    sha256(
      encodeText(
        JSON.stringify([
          bill.remainder,
          bill.lines.map((line) => [
            line.key,
            line.quantity,
            line.totalAmount,
            line.allocatedAmount,
          ]),
        ])
      )
    ).slice(0, VERSION_BYTES)
  )

export const createSelfPayShareSelectionText = ({
  bill,
  split,
}: {
  readonly bill: SelfPayShareBill & {
    readonly reference: SelfPayShareSelection["reference"]
  }
  readonly split: SelfPaySplit
}): string =>
  JSON.stringify({
    v: 1,
    kind: "share",
    nonce: createSelfPaySelectionNonce(),
    reference: bill.reference,
    version: deriveSelfPayShareBillVersion(bill),
    split,
  } satisfies SelfPayShareSelection)

export const deriveSelfPayPointer = (selectionText: string): SelfPayPointer =>
  SelfPayPointerSchema.decode(
    base32nopad.encode(
      sha256(encodeText(`payky/pointer/v1\0${selectionText}`)).slice(
        0,
        POINTER_BYTES
      )
    )
  )

export const deriveSelfPayPointerKeys = (
  pointer: SelfPayPointer,
  selectionKey: Uint8Array
) => {
  const seed = deriveLabeledKey(selectionKey, `payky/pointer:${pointer}`)
  const signingKey = deriveLabeledKey(seed, "sign")
  return {
    seed,
    signingKey,
    author: bytesToHex(schnorr.getPublicKey(signingKey)),
    readKey: deriveLabeledKey(seed, "read"),
  }
}

export const createSelfPaySelectionEvent = ({
  selectionText,
  selectionKey,
  createdAt,
}: {
  readonly selectionText: string
  readonly selectionKey: Uint8Array
  readonly createdAt: number
}): { readonly pointer: SelfPayPointer; readonly event: NostrEvent } => {
  const pointer = deriveSelfPayPointer(selectionText)
  const { signingKey, readKey } = deriveSelfPayPointerKeys(
    pointer,
    selectionKey
  )
  return {
    pointer,
    event: signNostrEvent(signingKey, {
      created_at: createdAt,
      kind: SELF_PAY_VIEW_KIND,
      tags: [
        ["d", ""],
        ["expiration", String(createdAt + SELECTION_EXPIRATION_SECONDS)],
      ],
      content: encryptSelfPayContent(readKey, selectionText),
    }),
  }
}

export const createSelfPaySelectionFilter = (
  pointer: SelfPayPointer,
  selectionKey: Uint8Array
): NostrFilter => ({
  kinds: [SELF_PAY_VIEW_KIND],
  authors: [deriveSelfPayPointerKeys(pointer, selectionKey).author],
})

export const openSelfPaySelection = <T>({
  events,
  pointer,
  selectionKey,
  schema,
}: {
  readonly events: ReadonlyArray<NostrEvent>
  readonly pointer: SelfPayPointer
  readonly selectionKey: Uint8Array
  readonly schema: z.ZodType<T>
}): T | null => {
  const { author, readKey } = deriveSelfPayPointerKeys(pointer, selectionKey)
  const texts = new Set<string>()
  for (const event of events) {
    if (event.pubkey !== author || !verifyNostrEvent(event)) continue
    const text = decryptSelfPayContent(readKey, event.content)
    if (text !== null && deriveSelfPayPointer(text) === pointer) {
      texts.add(text)
    }
  }
  const [text, ...others] = texts
  if (text === undefined || others.length > 0) return null
  const parsed = z.safeDecode(jsonCodec(schema), text)
  return parsed.success ? parsed.data : null
}
