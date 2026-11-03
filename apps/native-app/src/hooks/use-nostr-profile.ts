import {
  fetchNostrProfile,
  getNostrIdentity,
  type NostrIdentity,
  type NostrProfile,
} from "@payky/core/integrations/nostr/nostr-client"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { accountAtom } from "../atoms/account.ts"
import { queryClient } from "../core/query-client.ts"
import { useAppRun } from "./use-app-run.ts"

/** The active account's Nostr identity, derived from its recovery phrase. */
export function useNostrIdentity(): NostrIdentity {
  const { masterKey } = useAtomValue(accountAtom)
  return useMemo(() => getNostrIdentity(masterKey), [masterKey])
}

const ownProfileKey = (pubkey: string) => ["nostr", "profile", "own", pubkey]

/**
 * The account's published profile; `failed` when no relay answered (an empty
 * profile would let a save overwrite the real one). One query for every
 * reader (the settings card, the rail's tile, the editor), read once per
 * session: the editor is the only writer in this app and records what it
 * published with `setOwnNostrProfile`; `refetch` asks the relays again.
 */
export function useNostrProfile(pubkey: string) {
  const appRun = useAppRun()
  const query = useQuery({
    queryKey: ownProfileKey(pubkey),
    queryFn: async () => {
      await using run = appRun()
      const result = await run(fetchNostrProfile({ pubkey }))
      if (!result.ok) throw result.error
      return result.value
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  return {
    data: query.data ?? null,
    failed: query.isError,
    loading: query.isFetching,
    refetch: () => void query.refetch(),
  }
}

/**
 * What the editor just published, shown everywhere at once: relays may
 * still serve the previous event for a moment, so it is not refetched.
 */
export const setOwnNostrProfile = (pubkey: string, profile: NostrProfile) =>
  queryClient.setQueryData(ownProfileKey(pubkey), profile)

/**
 * Another account's published profile (a support member or a mention), read
 * from the app's relays plus `extraRelays` (the team's profile indexers);
 * cached, so a name shown many times is fetched once.
 */
export function useNostrMemberProfile(
  pubkey: string,
  extraRelays?: ReadonlyArray<string>
) {
  const appRun = useAppRun()
  return useQuery({
    queryKey: ["nostr", "profile", pubkey],
    queryFn: async () => {
      await using run = appRun()
      const result = await run(fetchNostrProfile({ pubkey, extraRelays }))
      if (!result.ok) throw result.error
      return result.value
    },
    staleTime: 5 * 60_000,
  })
}
