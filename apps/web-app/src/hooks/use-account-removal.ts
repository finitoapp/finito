import {
  deleteAccountLocalData,
  removeAccountFromDevice,
} from "@payky/core/evolu/account-wipe"
import type { DeleteAccountLocalData } from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback } from "react"
import { appClosingAtom } from "@/atoms/app-closing.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { stopAppEvoluSync } from "@/atoms/evolu.ts"
import { runAtom } from "@/atoms/run.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"

/**
 * Deletes an account's app database from this device, for
 * `createOrSelectAccount` reviving a removed account whose database is still
 * here (access/0014). Runs on the app-lifetime run, which has the Evolu
 * platform deps a second client needs; `useAppRun`'s runs do not.
 */
export const useDeleteAccountLocalData = (): DeleteAccountLocalData => {
  const run = useAtomValue(runAtom)
  return useCallback(
    async (masterKey) => {
      await using deleteRun = run.create(run.deps)
      return await deleteRun(deleteAccountLocalData(masterKey))
    },
    [run]
  )
}

/**
 * Removes an account from this device with its local data (access/0014):
 * the active one stops syncing first, so what this device has not sent yet
 * stays unsent, and `leaveAccount` moves the app off it once it is removed.
 * With no account left, the app renders nothing more (`appClosingAtom`), the
 * device database goes too and the app reloads.
 * Resolves to the Task's result; a failed deletion is retried at the next
 * start, so callers only log it.
 */
export const useRemoveAccountFromDevice = () => {
  const run = useAtomValue(runAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const evolu = useEvolu()
  const setAppClosing = useSetAtom(appClosingAtom)
  return useCallback(
    async ({
      accountId,
      active,
      leaveAccount,
    }: {
      readonly accountId: DeviceAccountId
      readonly active: boolean
      readonly leaveAccount: () => void
    }) => {
      if (active) stopAppEvoluSync(evolu)
      await using removeRun = run.create({ ...run.deps, deviceEvolu })
      return await removeRun(
        removeAccountFromDevice({
          accountId,
          leaveAccount,
          closeApp: () => setAppClosing(true),
        })
      )
    },
    [deviceEvolu, evolu, run, setAppClosing]
  )
}
