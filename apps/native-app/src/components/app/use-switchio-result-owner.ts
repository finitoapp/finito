import { accountListQuery } from "@payky/core/evolu/device-account"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import type { SwitchioResultOwner } from "../../platform/switchio.ts"

/**
 * Loads who may take a stored SwitchioPay result: the active account, and
 * the accounts still on this device, whose results wait for them. Read when
 * a result is about to be taken, so an account removed meanwhile counts as
 * gone.
 */
export function useLoadSwitchioResultOwner() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccountId = useAtomValue(accountAtom).id

  return useCallback(async (): Promise<SwitchioResultOwner> => {
    const accounts = await deviceEvolu.loadQuery(accountListQuery)
    return {
      activeAccountId,
      deviceAccountIds: new Set(accounts.map((account) => account.id)),
    }
  }, [activeAccountId, deviceEvolu])
}
