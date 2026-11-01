import { brandName } from "@payky/app-shared/brand"
import type { ChatEntry } from "@payky/app-shared/support-chat-timeline"
import { shortenNpub } from "@payky/core/integrations/nostr/nostr-client"
import {
  type DmInbox,
  mergeSupportMessages,
  type SupportMessage,
  type SupportTeam,
  sendSupportMessage,
} from "@payky/core/integrations/nostr/nostr-support-chat"
import { useQueryClient } from "@tanstack/react-query"
import Constants from "expo-constants"
import * as Crypto from "expo-crypto"
import { useState } from "react"
import { Platform } from "react-native"
import { appBrand } from "../../../core/app-brand.ts"
import {
  useNostrIdentity,
  useNostrMemberProfile,
} from "../../../hooks/use-nostr-profile.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { supportMessagesQueryKey } from "./use-support-chat.ts"

/**
 * Sends optimistically: the message shows at once as sending, then joins the
 * conversation, or stays marked as not delivered with a retry. The pending
 * list is local to the open chat, so a switched account or a closed screen
 * never carries a draft into another conversation.
 */
export function useSendSupportMessage({
  pubkey,
  team,
  inbox,
}: {
  readonly pubkey: string
  readonly team: SupportTeam | undefined
  readonly inbox: DmInbox | undefined
}) {
  const runToast = useRunToast()
  const queryClient = useQueryClient()
  const identity = useNostrIdentity()
  const profile = useNostrMemberProfile(identity.pubkey)
  const [pending, setPending] = useState<ReadonlyArray<ChatEntry>>([])

  const send = async (text: string) => {
    // The composer is disabled until the team is loaded.
    if (team === undefined) return
    const id = Crypto.randomUUID()
    setPending((current) => [
      ...current,
      {
        id,
        author: pubkey,
        fromSupport: false,
        text,
        sentAt: Math.floor(Date.now() / 1000),
        type: "message",
        refersTo: [],
        status: "sending",
        reactions: [],
      },
    ])

    const outcome: { delivered?: SupportMessage } = {}
    await runToast(async (run) => {
      const result = await run(
        sendSupportMessage({
          text,
          subject: `${brandName(appBrand)} · ${profile.data?.name ?? shortenNpub(identity.npub)}`,
          client: {
            version: Constants.expoConfig?.version ?? "unknown",
            platform: Platform.OS,
          },
          team,
          // Not loaded yet: the own copy goes to the team's relays only.
          inbox: inbox ?? { relays: [], state: "unverified" },
        })
      )
      // Not delivered is shown on the message itself, with a retry.
      if (result.ok) outcome.delivered = result.value
    })

    const { delivered } = outcome
    if (delivered === undefined) {
      setPending((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: "failed" } : entry
        )
      )
      return
    }
    // Relays may not serve it back yet, so the cache takes it directly.
    queryClient.setQueryData(
      supportMessagesQueryKey(pubkey),
      (current: ReadonlyArray<SupportMessage> | undefined) =>
        mergeSupportMessages(current, [delivered])
    )
    setPending((current) => current.filter((entry) => entry.id !== id))
  }

  const retry = (failed: ChatEntry) => {
    setPending((current) => current.filter((entry) => entry.id !== failed.id))
    void send(failed.text)
  }

  return { pending, send, retry }
}
