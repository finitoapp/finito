import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { checkRestorePhrase } from "@payky/app-shared/restore-phrase"
import { restoredAccountAtom } from "@payky/app-shared/restored-account"
import { createOrSelectAccount } from "@payky/core/evolu/device-account"
import { mnemonicToMasterKey } from "@payky/core/modules/shared/key-derivation"
import { router } from "expo-router"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { reloadAppEvoluAtom } from "../../atoms/evolu-counter.ts"
import { appDefaultTransports } from "../../core/app-brand.ts"

/**
 * Validates a recovery phrase, selects (or adds) its device account, then
 * waits for its first sync on `/restore-account`. The phrase is never stored
 * or logged. `restore` resolves to false when the restore did not start.
 */
export function useRestoreAccount(source: "onboarding" | "settings") {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const setRestoredAccount = useSetAtom(restoredAccountAtom)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  const restore = async (phrase: string): Promise<boolean> => {
    if (pending) return false
    setError(null)
    const checked = checkRestorePhrase(phrase)
    if (!checked.ok) {
      setError(checked.error)
      return false
    }
    setPending(true)
    try {
      const masterKey = await mnemonicToMasterKey(checked.mnemonic)
      const { created } = await createOrSelectAccount(deviceEvolu, masterKey, {
        defaultTransports: appDefaultTransports,
      })
      reloadAppEvolu()
      setRestoredAccount({ created, previous: activeAccount.id })
    } catch {
      setError("settings.accounts.restore.failed")
      setPending(false)
      return false
    }
    router.replace({ pathname: "/restore-account", params: { source } })
    return true
  }

  return { pending, error, setError, restore }
}
