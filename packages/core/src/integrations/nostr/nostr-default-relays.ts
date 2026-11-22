import { z } from "zod"

import { WssUrlSchema } from "../../modules/shared/schema.ts"

export const defaultSelfPayRelays = [
  "wss://nos.lol",
  "wss://nostr.linky.fit",
  "wss://nostr1.agora.gripe",
  "wss://nostr2.agora.gripe",
  "wss://nostr3.agora.gripe",
] as const

export const SelfPayRelaysSchema = z
  .string()
  .default(defaultSelfPayRelays.join(","))
  .transform((relays) =>
    relays
      .split(",")
      .map((relay) => relay.trim())
      .filter((relay) => relay !== "")
  )
  .pipe(z.array(WssUrlSchema).min(1))
