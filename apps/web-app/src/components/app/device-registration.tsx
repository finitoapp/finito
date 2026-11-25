import {
  deviceRegisteredQuery,
  loadActiveAccountRow,
  markDeviceRegistered,
} from "@payky/core/evolu/device-account"
import { applyPinUnblock } from "@payky/core/modules/access/access-actions"
import { registerDevice } from "@payky/core/modules/device/device-actions"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import { useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { useRemoveAccountFromDevice } from "@/hooks/use-account-removal.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { router } from "@/router.tsx"

/**
 * Keeps this device's row in the active account's app database
 * (access/0004): registered once per app database opened, and an unblock
 * another device writes to it applied here (access/0006). A removal another
 * device writes signs this device out of the account (access/0013), at
 * start or as it syncs in.
 */
export function DeviceRegistration() {
  const appRun = useAppRun()
  const console = useConsole()
  const { id: accountId, device } = useAtomValue(accountAtom)
  const { data } = useEvoluQuery(deviceByIdQuery(device.id))
  const token = data[0]?.pinUnblockToken ?? null
  const removedHere = data[0]?.isDeleted === 1
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const removeAccountFromDevice = useRemoveAccountFromDevice()
  const { t } = useTranslation()
  // The account this session's registration was written in; a removal seen
  // before it may be an old one the registration rejoins over.
  const [registeredIn, setRegisteredIn] = useState<string | null>(null)
  const registered = registeredIn === accountId
  // Read through the hook, so the registration below writes on mount, before
  // the account's jobs have anything to react to (a late write races a
  // reload). Held in a ref: the flag flips once the write is marked, and
  // that must not register again.
  const [flag] = useDeviceEvoluQuery(deviceRegisteredQuery(accountId)).data
  const joiningRef = useRef(flag?.deviceRegistered !== 1)
  joiningRef.current = flag?.deviceRegistered !== 1

  // Stops syncing, forgets the account and deletes its data (access/0014).
  const signOut = async () => {
    // Read again: the account may have been switched or removed meanwhile.
    const active = await loadActiveAccountRow(deviceEvolu)
    if (active?.id !== accountId) return
    toast.error(t("devices.removedHere", { name: active.name }))
    const removed = await removeAccountFromDevice({
      accountId,
      active: true,
      leaveAccount: () => {
        // Mounted outside the `RouterProvider`, like `AccountShareRequestHost`.
        void router.navigate({ to: "/" })
        reloadAppEvolu()
      },
    })
    // The start-up sweep tries again (access/0014).
    if (!removed.ok)
      console.warn("Deleting the removed account's data failed.", {
        error: removed.error.type,
      })
  }

  // Nothing on screen waits for these, so a failure is logged, as
  // `AppMigrations` does, rather than left to escape as an unhandled rejection.
  // biome-ignore lint/correctness/useExhaustiveDependencies: signOut reads the account it closes over
  useEffect(() => {
    void (async () => {
      try {
        const joining = joiningRef.current
        await using run = appRun()
        const result = await run.ok(
          registerDevice({
            id: device.id,
            name: device.name,
            deviceType: device.deviceType,
            browserName: device.browserName,
            osName: device.osName,
            joining,
          })
        )
        if (result === "removed") {
          await signOut()
          return
        }
        if (joining) markDeviceRegistered(deviceEvolu, accountId)
        setRegisteredIn(accountId)
      } catch (error) {
        console.error("Device registration failed.", error)
      }
    })()
  }, [accountId, appRun, console, deviceEvolu, device])

  // biome-ignore lint/correctness/useExhaustiveDependencies: signOut reads the account it closes over
  useEffect(() => {
    if (!registered || !removedHere) return
    void signOut().catch((error: unknown) => {
      console.error("Signing the removed device out failed.", error)
    })
  }, [registered, removedHere])

  useEffect(() => {
    if (token === null) return
    void (async () => {
      try {
        await using run = appRun()
        await run.ok(applyPinUnblock({ accountId, deviceId: device.id, token }))
      } catch (error) {
        console.error("Applying the PIN unblock failed.", error)
      }
    })()
  }, [accountId, appRun, console, device.id, token])

  return null
}
