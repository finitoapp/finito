import {
  accountListQuery,
  storableNostrName,
  storableNostrPicture,
  updateAccountNostrProfile,
} from "@payky/core/evolu/device-account"
import {
  fetchNostrProfile,
  getNostrIdentity,
  type NostrIdentity,
  type NostrProfile,
} from "@payky/core/integrations/nostr/nostr-client"
import type { MasterKey } from "@payky/core/modules/shared/key-derivation"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { accountAtom } from "../atoms/account.ts"
import { deviceEvoluAtom } from "../atoms/device-evolu.ts"
import { queryClient } from "../core/query-client.ts"
import { useAppRun } from "./use-app-run.ts"

/**
 * The last account's identity. Deriving it is a secp256k1 multiplication in
 * JS, 30-90 ms on a PAX A920Pro, and every reader paid it on every mount:
 * the settings' profile card twice on each visit (2026-11-17).
 */
let identityCache: {
  readonly masterKey: MasterKey
  readonly identity: NostrIdentity
} | null = null

const nostrIdentityOf = (masterKey: MasterKey): NostrIdentity => {
  if (identityCache?.masterKey !== masterKey)
    identityCache = { masterKey, identity: getNostrIdentity(masterKey) }
  return identityCache.identity
}

/** The active account's Nostr identity, derived from its recovery phrase once. */
export function useNostrIdentity(): NostrIdentity {
  return nostrIdentityOf(useAtomValue(accountAtom).masterKey)
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
 * The active account's profile, as `useNostrProfile` reads it. Whenever it
 * loads, or the editor replaces it, its name and picture are remembered on
 * the device account: that is how the account list shows the other
 * accounts' businesses without asking relays about them, which would let a
 * relay link the accounts (account/0004, account/0011).
 *
 * It never suspends: the stored account is loaded inside the effect rather
 * than subscribed, because the settings' profile card reads this and a
 * subscription held the whole Settings screen back on a device-database
 * round trip each time the tab opened.
 */
export function useActiveNostrProfile() {
  const identity = useNostrIdentity()
  const profile = useNostrProfile(identity.pubkey)
  const accountId = useAtomValue(accountAtom).id
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const name =
    profile.data === null ? undefined : storableNostrName(profile.data.name)
  const picture =
    profile.data === null
      ? undefined
      : storableNostrPicture(profile.data.picture)

  useEffect(() => {
    if (name === undefined || picture === undefined) return
    let current = true
    const remember = async () => {
      const accounts = await deviceEvolu.loadQuery(accountListQuery)
      const stored = accounts.find(({ id }) => id === accountId)
      // Written only on a change, so mounting it does not add a write.
      if (!current || stored === undefined) return
      if (name === stored.nostrName && picture === stored.nostrPicture) return
      updateAccountNostrProfile(deviceEvolu, accountId, { name, picture })
    }
    void remember()
    return () => {
      current = false
    }
  }, [accountId, deviceEvolu, name, picture])

  return profile
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
