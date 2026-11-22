import { schnorr } from "@noble/curves/secp256k1.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { z } from "zod"

import {
  type NostrEvent,
  signNostrEvent,
  verifyNostrEvent,
} from "../../integrations/nostr/nostr-event.ts"
import type { NostrFilter } from "../../integrations/nostr/nostr-relay-client.ts"
import { jsonCodec } from "../../zod-utils.ts"
import type { BankTransaction } from "../reconciliation-claim/reconciliation-claim-types.ts"
import { deriveLabeledKey } from "../shared/labeled-key.ts"
import {
  FiatCurrencySchema,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  TimestampMs,
  VariableSymbolSchema,
} from "../shared/schema.ts"
import { createSelfPaySelectionNonce } from "./table-self-pay-pointer-utils.ts"
import {
  decryptSelfPayContent,
  encryptSelfPayContent,
  SELF_PAY_VIEW_KIND,
} from "./table-self-pay-view-utils.ts"

const TEST_TRANSFER_EXPIRATION_SECONDS = 7 * 24 * 60 * 60

const SelfPayTestTransferSchema = z.object({
  v: z.literal(1),
  nonce: z.string().regex(/^[0-9a-f]{32}$/u),
  amount: PositiveIntegerSchema,
  currency: FiatCurrencySchema,
  variableSymbol: VariableSymbolSchema,
  recipientMessage: NonEmptyStringSchema,
})

type SelfPayTestTransfer = z.output<typeof SelfPayTestTransferSchema>

const testTransferCodec = jsonCodec(SelfPayTestTransferSchema)

/**
 * Every guest of the account signs test transfers with one key, so the till
 * can list them; a real transfer reaches it through the bank instead
 * (table-self-pay/0025).
 */
const deriveSelfPayTestTransferKeys = (selectionKey: Uint8Array) => {
  const seed = deriveLabeledKey(selectionKey, "payky/test-transfer")
  const signingKey = deriveLabeledKey(seed, "sign")
  return {
    signingKey,
    author: bytesToHex(schnorr.getPublicKey(signingKey)),
    readKey: deriveLabeledKey(seed, "read"),
  }
}

export const createSelfPayTestTransferEvent = ({
  transfer,
  selectionKey,
  createdAt,
}: {
  readonly transfer: Omit<SelfPayTestTransfer, "v" | "nonce">
  readonly selectionKey: Uint8Array
  readonly createdAt: number
}): NostrEvent => {
  const { signingKey, readKey } = deriveSelfPayTestTransferKeys(selectionKey)
  const nonce = createSelfPaySelectionNonce()
  return signNostrEvent(signingKey, {
    created_at: createdAt,
    kind: SELF_PAY_VIEW_KIND,
    tags: [
      ["d", nonce],
      ["expiration", String(createdAt + TEST_TRANSFER_EXPIRATION_SECONDS)],
    ],
    content: encryptSelfPayContent(
      readKey,
      z.encode(testTransferCodec, { v: 1, nonce, ...transfer })
    ),
  })
}

export const createSelfPayTestTransferFilter = (
  selectionKey: Uint8Array
): NostrFilter => ({
  kinds: [SELF_PAY_VIEW_KIND],
  authors: [deriveSelfPayTestTransferKeys(selectionKey).author],
})

/** The test transfers in `events`, as the bank transactions they stand for. */
export const openSelfPayTestTransfers = ({
  events,
  selectionKey,
}: {
  readonly events: ReadonlyArray<NostrEvent>
  readonly selectionKey: Uint8Array
}): ReadonlyArray<BankTransaction> => {
  const { author, readKey } = deriveSelfPayTestTransferKeys(selectionKey)
  return events.flatMap((event): ReadonlyArray<BankTransaction> => {
    if (event.pubkey !== author || !verifyNostrEvent(event)) return []
    const text = decryptSelfPayContent(readKey, event.content)
    if (text === null) return []
    const parsed = z.safeDecode(testTransferCodec, text)
    if (!parsed.success) return []
    const transfer = parsed.data
    return [
      {
        bankReference: NonEmptyString255(`test-${transfer.nonce}`),
        amount: Integer(transfer.amount),
        currency: transfer.currency,
        occurredAt: TimestampMs(event.created_at * 1000),
        note: null,
        recipientMessage: transfer.recipientMessage,
        variableSymbol: transfer.variableSymbol,
        constantSymbol: null,
        specificSymbol: null,
      },
    ]
  })
}
