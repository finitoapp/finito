import { createDateDep } from "@payky/core/deps"
import {
  deviceRegisteredQuery,
  loadActiveAccountRow,
  markDeviceRegistered,
  removeDeviceAccount,
} from "@payky/core/evolu/device-account"
import { applyPinUnblock } from "@payky/core/modules/access/access-actions"
import { registerDevice } from "@payky/core/modules/device/device-actions"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import { router } from "expo-router"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { evoluAtom } from "../../atoms/evolu.ts"
import { reloadAppEvoluAtom } from "../../atoms/evolu-counter.ts"
import { nativeConsole, nativeRun } from "../../core/native-runtime.ts"
import {
  useDeviceEvoluQuery,
  useEvoluQuery,
} from "../../hooks/use-evolu-query.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { lockManager } from "../../platform/evolu-runtime"

/**
 * Keeps this device's row in the active account's app database
 * (access/0004): registered once per app database opened, and an unblock
 * another device writes to it applied here (access/0006). A removal another
 * device writes signs this device out of the account (access/0013), at
 * start or as it syncs in. The native twin of web's `DeviceRegistration`.
 */
export function DeviceRegistration() {
  const evolu = useAtomValue(evoluAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const { id: accountId, device } = useAtomValue(accountAtom)
  const { data } = useEvoluQuery(deviceByIdQuery(device.id))
  const token = data[0]?.pinUnblockToken ?? null
  const removedHere = data[0]?.isDeleted === 1
  const reload = useSetAtom(reloadAppEvoluAtom)
  const toast = useToast()
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

  const signOut = async () => {
    // Read again: the account may have been switched or removed meanwhile.
    const active = await loadActiveAccountRow(deviceEvolu)
    if (active?.id !== accountId) return
    removeDeviceAccount(deviceEvolu, accountId)
    toast.error(t("devices.removedHere", { name: active.name }))
    router.replace("/")
    reload()
  }

  // Nothing on screen waits for these, so a failure is logged, as on web,
  // rather than left to escape as an unhandled rejection.
  // biome-ignore lint/correctness/useExhaustiveDependencies: signOut reads the account it closes over
  useEffect(() => {
    void (async () => {
      try {
        const joining = joiningRef.current
        await using run = nativeRun.create({
          evolu,
          evoluOwner: evolu.appOwner,
        })
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
        nativeConsole.error("Device registration failed.", error)
      }
    })()
  }, [accountId, deviceEvolu, evolu, device])

  // biome-ignore lint/correctness/useExhaustiveDependencies: signOut reads the account it closes over
  useEffect(() => {
    if (!registered || !removedHere) return
    void signOut().catch((error: unknown) => {
      nativeConsole.error("Signing the removed device out failed.", error)
    })
  }, [registered, removedHere])

  useEffect(() => {
    if (token === null) return
    void (async () => {
      try {
        await using run = nativeRun.create({
          evolu,
          evoluOwner: evolu.appOwner,
          deviceEvolu,
          lockManager,
          ...createDateDep(),
        })
        await run.ok(applyPinUnblock({ accountId, deviceId: device.id, token }))
      } catch (error) {
        nativeConsole.error("Applying the PIN unblock failed.", error)
      }
    })()
  }, [accountId, deviceEvolu, evolu, device.id, token])

  return null
}
