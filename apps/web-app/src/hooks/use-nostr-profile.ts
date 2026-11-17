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
} from "@payky/core/integrations/nostr/nostr-client"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useEffect, useMemo } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"

/** The account's Nostr identity, derived from its recovery phrase. */
export const useNostrIdentity = (): NostrIdentity => {
  const { masterKey } = useAtomValue(accountAtom)
  return useMemo(() => getNostrIdentity(masterKey), [masterKey])
}

export const nostrProfileQueryKey = (pubkey: string) =>
  ["nostr", "profile", pubkey] as const

/**
 * A published kind-0 profile; errors when no relay answered. `extraRelays`
 * are read on top of the app's relays.
 */
export const useNostrProfile = (
  pubkey: string,
  extraRelays?: ReadonlyArray<string>
) => {
  const appRun = useAppRun()
  return useQuery({
    queryKey: nostrProfileQueryKey(pubkey),
    queryFn: async () => {
      await using run = appRun()
      const result = await run(fetchNostrProfile({ pubkey, extraRelays }))
      if (!result.ok) throw result.error
      return result.value
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * The active account's profile. Whenever it loads, or a save replaces it,
 * its name and picture are remembered on the device account: that is how
 * the account list shows the other accounts' businesses without asking
 * relays about them, which would let a relay link the accounts (account/0004,
 * account/0011).
 */
export const useActiveNostrProfile = () => {
  const identity = useNostrIdentity()
  const profile = useNostrProfile(identity.pubkey)
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const { data: accounts } = useDeviceEvoluQuery(accountListQuery)
  const stored = accounts.find(({ id }) => id === account.id)
  const name =
    profile.data === undefined
      ? undefined
      : storableNostrName(profile.data.name)
  const picture =
    profile.data === undefined
      ? undefined
      : storableNostrPicture(profile.data.picture)

  useEffect(() => {
    // Written only on a change, so mounting it does not add a write.
    if (name === undefined || picture === undefined || stored === undefined) {
      return
    }
    if (name === stored.nostrName && picture === stored.nostrPicture) return
    updateAccountNostrProfile(deviceEvolu, account.id, { name, picture })
  }, [account.id, deviceEvolu, name, picture, stored])

  return profile
}
