import {
  deleteAccountLocalData,
  removeAccountFromDevice,
} from "@payky/core/evolu/account-wipe"
import type { DeleteAccountLocalData } from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback } from "react"
import { appClosingAtom } from "../atoms/app-closing.ts"
import { deviceEvoluAtom } from "../atoms/device-evolu.ts"
import { evoluAtom, stopAppEvoluSync } from "../atoms/evolu.ts"
import { nativeRun } from "../core/native-runtime.ts"

/**
 * Deletes an account's app database from this device, for
 * `createOrSelectAccount` reviving a removed account whose database is still
 * here (access/0014). The native twin of web's.
 */
export const useDeleteAccountLocalData =
  (): DeleteAccountLocalData => async (masterKey) => {
    await using run = nativeRun.create(nativeRun.deps)
    return await run(deleteAccountLocalData(masterKey))
  }

/**
 * Removes an account from this device with its local data (access/0014):
 * the active one stops syncing first, so what this device has not sent yet
 * stays unsent, and `leaveAccount` moves the app off it once it is removed.
 * With no account left, the app renders nothing more (`appClosingAtom`), the
 * device database goes too and the app reloads;
 * a deletion that fails, such as on a database a replaced runtime still
 * holds, is retried at the next start. The native twin of web's.
 */
export const useRemoveAccountFromDevice = () => {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const evolu = useAtomValue(evoluAtom)
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
      await using run = nativeRun.create({ ...nativeRun.deps, deviceEvolu })
      return await run(
        removeAccountFromDevice({
          accountId,
          leaveAccount,
          closeApp: () => setAppClosing(true),
        })
      )
    },
    [deviceEvolu, evolu, setAppClosing]
  )
}
