import { Capacitor } from "@capacitor/core"
import { shortenNpub } from "@payky/core/integrations/nostr/nostr-client"
import {
  type DmInbox,
  ensureDmRelayList,
  fetchSupportMessages,
  loadDmInbox,
  mergeSupportMessages,
  publishDmRelayList,
  type SupportMessage,
  type SupportTeam,
  sendSupportMessage,
  subscribeSupportMessages,
} from "@payky/core/integrations/nostr/nostr-support-chat"
import { fetchSupportTeam } from "@payky/core/integrations/nostr/support-team-client"
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { apiUrl } from "@/core/app-env.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import {
  useActiveNostrProfile,
  useNostrIdentity,
} from "@/hooks/use-nostr-profile.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"

export const supportMessagesQueryKey = (pubkey: string) =>
  ["nostr", "support", pubkey] as const

export const dmInboxQueryKey = (pubkey: string) =>
  ["nostr", "dmInbox", pubkey] as const

/** How long to wait before listening again after every relay dropped. */
const RESUBSCRIBE_DELAY_MS = 5_000

/**
 * The support team from Payky's API. No fallback: the chat waits for it, and
 * shows a retry when it does not come (support/0001).
 */
export const useSupportTeam = () => {
  const appRun = useAppRun()
  return useQuery({
    queryKey: ["supportTeam"],
    queryFn: async () => {
      await using run = appRun()
      const result = await run(fetchSupportTeam(apiUrl("/api/support-team")))
      if (!result.ok) throw result.error
      return result.value
    },
    // The endpoint is cached for as long.
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

/**
 * The account's DM inbox, which says where support's replies arrive. Shared by
 * `useDmInbox` and `useDmRelayList`, so a message sent while the check still
 * runs waits for that same check instead of starting another or skipping it.
 */
const dmInboxQuery = ({
  pubkey,
  team,
  appRun,
}: {
  readonly pubkey: string
  readonly team: SupportTeam | undefined
  readonly appRun: ReturnType<typeof useAppRun>
}) =>
  queryOptions({
    queryKey: dmInboxQueryKey(pubkey),
    queryFn: async () => {
      if (team === undefined) throw new Error("The support team is not loaded.")
      await using run = appRun()
      return await run.ok(loadDmInbox({ team }))
    },
    staleTime: 5 * 60_000,
  })

/** The account's DM inbox, which says where support's replies arrive. */
export const useDmInbox = ({
  pubkey,
  team,
}: {
  readonly pubkey: string
  readonly team: SupportTeam | undefined
}) => {
  const appRun = useAppRun()
  return useQuery({
    ...dmInboxQuery({ pubkey, team, appRun }),
    enabled: team !== undefined,
  })
}

/**
 * Keeps the account's DM relay list where support's clients look for it
 * (support/0001, support/0004) and remembers whether the last attempt
 * failed, which the chat warns about. `ensure` goes with every message: it
 * waits for the inbox check, then publishes a list for an account that has
 * none or copies a found one to the relays that lack it. `publish` replaces
 * the list, after the chat's warning. Either writes the resulting inbox into
 * its cache: relays may not serve a new list back yet.
 */
export const useDmRelayList = ({
  pubkey,
  team,
}: {
  readonly pubkey: string
  readonly team: SupportTeam | undefined
}) => {
  const appRun = useAppRun()
  const runToast = useRunToast()
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)

  const settle = (inbox: DmInbox | undefined) => {
    setFailed(inbox === undefined)
    if (inbox !== undefined) {
      queryClient.setQueryData(dmInboxQueryKey(pubkey), inbox)
    }
  }

  const ensure = async () => {
    if (team === undefined) return
    const outcome: { inbox?: DmInbox } = {}
    await runToast(async (run) => {
      const inbox = await queryClient.fetchQuery(
        dmInboxQuery({ pubkey, team, appRun })
      )
      const result = await run(ensureDmRelayList({ team, inbox }))
      // A rejection is shown by the chat's warning, not a toast.
      if (result.ok) outcome.inbox = result.value
    })
    settle(outcome.inbox)
  }

  const publish = async () => {
    if (team === undefined) return
    const outcome: { inbox?: DmInbox } = {}
    await runToast(async (run) => {
      const result = await run(publishDmRelayList({ team }))
      if (result.ok) outcome.inbox = result.value
    })
    settle(outcome.inbox)
  }

  return { ensure, publish, failed }
}

/**
 * The conversation with support while the chat is open: the history through
 * `useQuery`, and a live subscription that writes each new message into the
 * same cache the moment a relay pushes it. Both wait for the team and the
 * DM inbox, which say where to read. Refetching on focus and on reconnect
 * (TanStack's defaults) covers what the subscription misses while a
 * backgrounded WebView has its sockets closed. Nothing listens once the chat is closed.
 */
export const useSupportMessages = ({
  pubkey,
  team,
  inbox,
}: {
  readonly pubkey: string
  readonly team: SupportTeam | undefined
  readonly inbox: DmInbox | undefined
}) => {
  const appRun = useAppRun()
  const queryClient = useQueryClient()
  const queryKey = supportMessagesQueryKey(pubkey)

  useEffect(() => {
    if (team === undefined || inbox === undefined) return
    const key = supportMessagesQueryKey(pubkey)
    const add = (message: SupportMessage) =>
      queryClient.setQueryData(
        key,
        (current: ReadonlyArray<SupportMessage> | undefined) =>
          mergeSupportMessages(current, [message])
      )

    // One run for as long as the effect listens, so the subscription gets
    // the same deps every Task here does; disposed with it below.
    const run = appRun()
    let close = () => {}
    let retry: ReturnType<typeof setTimeout> | undefined
    const listen = () => {
      close = subscribeSupportMessages(run.deps, {
        team,
        inbox,
        onMessage: add,
        // Every relay dropped it: catch up on the history, listen again.
        onClose: () => {
          retry = setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: key })
            listen()
          }, RESUBSCRIBE_DELAY_MS)
        },
      })
    }
    listen()

    return () => {
      clearTimeout(retry)
      close()
      void run[Symbol.asyncDispose]()
    }
  }, [appRun, inbox, pubkey, queryClient, team])

  return useQuery({
    queryKey,
    enabled: team !== undefined && inbox !== undefined,
    queryFn: async () => {
      if (team === undefined || inbox === undefined) {
        throw new Error("The support team or the DM inbox is not loaded.")
      }
      await using run = appRun()
      const result = await run(fetchSupportMessages({ team, inbox }))
      if (!result.ok) throw result.error
      // Merged rather than replaced: a message pushed live or just sent may
      // not be in what the relays answered yet.
      return mergeSupportMessages(
        queryClient.getQueryData<ReadonlyArray<SupportMessage>>(queryKey),
        result.value
      )
    },
    // A safety net for a relay that dropped the subscription on its own while
    // the others kept it, which `onClose` does not report.
    refetchInterval: 2 * 60_000,
  })
}

/**
 * `sendSupportMessage` signed as this app signs every message — the account's
 * name as the subject, the version and platform as the trailer — and, once
 * sent, the message in the conversation's cache: relays may not serve it back
 * yet, and the chat shows it from there when it opens. Shared by the chat and
 * the debug console's "Send to support".
 */
export const useDeliverSupportMessage = () => {
  const queryClient = useQueryClient()
  const identity = useNostrIdentity()
  const profile = useActiveNostrProfile()
  const name = profile.data?.name ?? shortenNpub(identity.npub)

  return useCallback(
    async (
      run: ReturnType<ReturnType<typeof useAppRun>>,
      {
        text,
        team,
        inbox,
      }: {
        readonly text: string
        readonly team: SupportTeam
        readonly inbox: DmInbox | undefined
      }
    ) => {
      const result = await run(
        sendSupportMessage({
          text,
          subject: `Payky · ${name}`,
          client: {
            version: __APP_VERSION__,
            platform: Capacitor.getPlatform(),
          },
          team,
          // Not loaded yet: the own copy goes to the team's relays only.
          inbox: inbox ?? { relays: [], state: "unverified" },
        })
      )
      if (result.ok) {
        queryClient.setQueryData(
          supportMessagesQueryKey(identity.pubkey),
          (current: ReadonlyArray<SupportMessage> | undefined) =>
            mergeSupportMessages(current, [result.value])
        )
      }
      return result
    },
    [identity.pubkey, name, queryClient]
  )
}
