import { schnorr } from "@noble/curves/secp256k1.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import { z } from "zod"

import { HexSchema } from "../../modules/shared/schema.ts"

export const NostrEventSchema = z.object({
  id: HexSchema(32),
  pubkey: HexSchema(32),
  created_at: z.number().int().nonnegative(),
  kind: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: HexSchema(64),
})
export type NostrEvent = z.output<typeof NostrEventSchema>

type UnsignedNostrEvent = Pick<
  NostrEvent,
  "created_at" | "kind" | "tags" | "content"
>

const computeEventId = (
  pubkey: string,
  { created_at, kind, tags, content }: UnsignedNostrEvent
): Uint8Array =>
  sha256(
    new TextEncoder().encode(
      JSON.stringify([0, pubkey, created_at, kind, tags, content])
    )
  )

export const signNostrEvent = (
  secretKey: Uint8Array,
  event: UnsignedNostrEvent
): NostrEvent => {
  const pubkey = bytesToHex(schnorr.getPublicKey(secretKey))
  const id = computeEventId(pubkey, event)

  return {
    ...event,
    id: bytesToHex(id),
    pubkey,
    sig: bytesToHex(schnorr.sign(id, secretKey)),
  }
}

export const verifyNostrEvent = (event: NostrEvent): boolean => {
  const id = computeEventId(event.pubkey, event)
  if (bytesToHex(id) !== event.id) return false

  try {
    return schnorr.verify(hexToBytes(event.sig), id, hexToBytes(event.pubkey))
  } catch {
    return false
  }
}

export const getNostrTag = (
  event: Pick<NostrEvent, "tags">,
  name: string
): string | undefined => event.tags.find(([tag]) => tag === name)?.[1]
