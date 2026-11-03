import { err, ok, type Task } from "@evolu/common"
import { PrivateDirectMessage } from "nostr-tools/kinds"
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59"
import type { Event } from "nostr-tools/pure"
import { getPublicKey } from "nostr-tools/pure"

import type { DateDep, MasterKeyDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { CashuTokenText } from "../../modules/cashu/cashu-types.ts"
import { deriveNostrSecretKey } from "../../modules/shared/key-derivation.ts"
import {
  isPublishAccepted,
  type NostrDep,
  publishReasons,
  RELAY_MAX_WAIT_MS,
} from "./nostr-client.ts"
import { authSigner } from "./nostr-support-chat.ts"

const createCashuTokenNotDeliveredError = defineError(
  "CashuTokenNotDelivered"
)<{ readonly reasons: ReadonlyArray<string> }>()
export type CashuTokenNotDeliveredError = ReturnType<
  typeof createCashuTokenNotDeliveredError
>

/**
 * Hands a token to a Linky user the way Linky does (`linkstr/src/chat/codec.ts`
 * `encodeTokenMessageRumor`, cashu.md §5 "Token"): a NIP-17 kind 14 message
 * whose content is the bare token, in a 1:1 room (the recipient and the
 * account's key), gift-wrapped once for the recipient and once for the
 * account itself. The recipient's copy goes first, to the account's relays,
 * which Linky's users read as well; ok once a relay accepted it. The own
 * copy follows unawaited, so the send shows in Linky's chat on the
 * merchant's own devices; losing it loses nothing but that echo.
 */
export const sendCashuTokenMessage =
  ({
    to,
    tokenText,
  }: {
    /** The recipient's hex pubkey. */
    readonly to: string
    readonly tokenText: CashuTokenText
  }): Task<
    { readonly rumorId: string },
    CashuTokenNotDeliveredError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    const { nostr } = run.deps
    const secretKey = deriveNostrSecretKey(run.deps.masterKey)
    const me = getPublicKey(secretKey)
    const now = Math.floor(run.deps.date.now().getTime() / 1000)
    const publish = (event: Event) =>
      Promise.allSettled(
        nostr.pool.publish([...nostr.relays], event, {
          maxWait: RELAY_MAX_WAIT_MS,
          onauth: authSigner(secretKey),
        })
      )

    const rumor = createRumor(
      {
        kind: PrivateDirectMessage,
        created_at: now,
        content: tokenText,
        tags: [
          ["p", to],
          ["p", me],
        ],
      },
      secretKey
    )
    const wrapFor = (pubkey: string) =>
      createWrap(createSeal(rumor, secretKey, pubkey), pubkey)

    const results = await publish(wrapFor(to))
    if (!isPublishAccepted(results))
      return err(
        createCashuTokenNotDeliveredError({ reasons: publishReasons(results) })
      )
    void publish(wrapFor(me))
    return ok({ rumorId: rumor.id })
  }
