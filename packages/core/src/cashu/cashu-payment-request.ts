import { base64urlnopad } from "@scure/base"
import { encode } from "cbor-x"
import { nprofileEncode } from "nostr-tools/nip19"
import { z } from "zod"

import { jsonCodec } from "../zod-utils.ts"

/**
 * What the Cashu tab's one QR carries (cashu.md §4, decision 3): a BIP-321
 * `bitcoin:` URI with the mint's Lightning invoice and, from phase 4, a
 * NUT-18 payment request next to it. Both legs are rebuilt from stored data,
 * so the QR survives a restart without being stored.
 *
 * The builder and the leg pick match Linky's `buildBip321PaymentUri` and
 * `pickBip321PayableLeg` (`linkshu/src/paymentRequest/bip321.ts`); the
 * cross-app vectors pin them.
 */

const stripLightningPrefix = (value: string): string =>
  value
    .trim()
    .replace(/^lightning:/iu, "")
    .trim()

/**
 * `bitcoin:?lightning=<bolt11>&creq=<creqA…>`, leaving out empty legs; null
 * when both are empty. No on-chain address: Cashu has none.
 */
export const buildBip321PaymentUri = (legs: {
  readonly lightning?: string | null
  readonly creq?: string | null
}): string | null => {
  const params = new URLSearchParams()
  const lightning = (legs.lightning ?? "").trim()
  const creq = (legs.creq ?? "").trim()
  if (lightning !== "") params.set("lightning", stripLightningPrefix(lightning))
  if (creq !== "") params.set("creq", creq)
  const query = params.toString()
  return query === "" ? null : `bitcoin:?${query}`
}

export type Bip321PayableLeg =
  | { readonly kind: "cashu-request"; readonly value: string }
  | { readonly kind: "lightning"; readonly value: string }

/**
 * The leg a Cashu wallet like Linky pays: the NUT-18 request first, then the
 * Lightning invoice. Null for anything else (Linky's LNURL and Lightning
 * address legs never appear in Payky's QR).
 */
export const pickBip321PayableLeg = (uri: string): Bip321PayableLeg | null => {
  const value = uri.trim()
  if (!/^bitcoin:/iu.test(value)) return null
  const body = value.slice("bitcoin:".length)
  const query = body.includes("?") ? body.slice(body.indexOf("?") + 1) : ""
  const params = new URLSearchParams(query)
  const creq = params.get("creq")?.trim() ?? ""
  if (/^creqA/iu.test(creq)) return { kind: "cashu-request", value: creq }
  const lightning = stripLightningPrefix(params.get("lightning") ?? "")
  if (/^(lnbc|lntb|lnbcrt)/iu.test(lightning))
    return { kind: "lightning", value: lightning }
  return null
}

const trimmedOrNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

/**
 * A NUT-18 `creqA…` request for `amount` sat, single use, payable at
 * `mintUrls`, delivered over a nostr transport to `recipientNprofile` as a
 * NIP-17 message (`["n", "17"]`): Linky's `encodeNostrPaymentRequest`
 * byte for byte (cbor-x, the same field order), pinned by the cross-app
 * vectors.
 */
export const encodeNostrPaymentRequest = (args: {
  readonly amount: number
  readonly mintUrls: ReadonlyArray<string>
  readonly recipientNprofile: string
  readonly requestId?: string | null
  readonly description?: string | null
}): string => {
  const requestId = trimmedOrNull(args.requestId)
  const description = trimmedOrNull(args.description)
  const payload = {
    a: args.amount,
    u: "sat",
    s: true,
    m: args.mintUrls.flatMap((mint) => trimmedOrNull(mint) ?? []),
    t: [{ t: "nostr", a: args.recipientNprofile, g: [["n", "17"]] }],
    ...(requestId === null ? {} : { i: requestId }),
    ...(description === null ? {} : { d: description }),
  }
  const bytes: Uint8Array = encode(payload)
  return `creqA${base64urlnopad.encode(
    new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  )}`
}

const PaymentPayloadSchema = z.object({
  id: z.string().optional(),
  memo: z.string().optional(),
  mint: z.string(),
  unit: z.string(),
  proofs: z
    .array(z.looseObject({ amount: z.number(), secret: z.string() }))
    .min(1),
})

const PaymentPayloadJson = jsonCodec(PaymentPayloadSchema)

export interface CashuPaymentPayload {
  /** The request id the payer echoed: Payky's payment id. */
  readonly requestId: string | null
  readonly mint: string
  readonly unit: string
  /** Face value of the proofs, before the mint's input fee. */
  readonly amount: number
}

/**
 * The NUT-18 payload a payer sends over the transport, `{id, memo, mint,
 * unit, proofs}` JSON (Linky's `decodePaymentRequestPayload`); null for
 * anything else, a bare token included.
 */
export const decodeCashuPaymentPayload = (
  text: string
): CashuPaymentPayload | null => {
  const decoded = z.safeDecode(PaymentPayloadJson, text.trim())
  if (!decoded.success) return null
  return {
    requestId: trimmedOrNull(decoded.data.id),
    mint: decoded.data.mint.trim(),
    unit: decoded.data.unit.trim().toLowerCase(),
    amount: decoded.data.proofs.reduce((sum, proof) => sum + proof.amount, 0),
  }
}

/**
 * What the Cashu wallet's QR carries (settings/0003): both legs in one
 * BIP-321 URI, the default, or one of them bare, for a merchant whose
 * customers' wallets read only the one. Stored on the Cashu account.
 */
export const CashuPaymentRequestLegsSchema = z.enum([
  "both",
  "cashu",
  "lightning",
])
export type CashuPaymentRequestLegs = z.output<
  typeof CashuPaymentRequestLegsSchema
>
export const defaultCashuPaymentRequestLegs: CashuPaymentRequestLegs = "both"

/**
 * The QR of a Cashu payment, rebuilt from stored data (cashu/0006): the
 * mint's invoice next to a NUT-18 request for the payment's sats at its
 * mint, delivered to Payky's nprofile over the relays it listens on, with the
 * payment id as the request id. `legs` narrows it to the bare invoice or
 * the bare request; null when the leg asked for cannot be made.
 */
export const buildCashuPaymentUri = ({
  paymentId,
  lnInvoice,
  amountSats,
  mintUrl,
  nostrPubkey,
  relays,
  legs = defaultCashuPaymentRequestLegs,
}: {
  readonly paymentId: string
  readonly lnInvoice: string
  readonly amountSats: number
  readonly mintUrl: string
  /** Hex; null while the identity is unknown, which leaves the token leg out. */
  readonly nostrPubkey: string | null
  readonly relays: ReadonlyArray<string>
  readonly legs?: CashuPaymentRequestLegs
}): string | null => {
  if (legs === "lightning")
    return trimmedOrNull(stripLightningPrefix(lnInvoice))
  const creq =
    nostrPubkey === null || amountSats <= 0
      ? null
      : encodeNostrPaymentRequest({
          amount: amountSats,
          mintUrls: [mintUrl],
          recipientNprofile: nprofileEncode({
            pubkey: nostrPubkey,
            relays: [...relays],
          }),
          requestId: paymentId,
        })
  if (legs === "cashu") return creq
  return buildBip321PaymentUri({ lightning: lnInvoice, creq })
}
