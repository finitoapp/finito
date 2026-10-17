import {
  accessSessionAtom,
  pinPromptQueueAtom,
} from "@payky/app-shared/access-state"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { accessControlQuery } from "@payky/core/modules/access/access-queries"
import type { Permission } from "@payky/core/modules/access/access-types"
import {
  decodePermissions,
  effectivePermissions,
} from "@payky/core/modules/access/access-utils"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useMemo, useRef } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

/**
 * What this device may do on the active account right now (access/0001):
 * whether access control is on, the device's defaults, whether a PIN session
 * runs, and the effective permissions those make.
 */
export function useAccess() {
  const account = useAtomValue(accountAtom)
  const { data: control } = useEvoluQuery(accessControlQuery)
  const { data: deviceRows } = useEvoluQuery(deviceByIdQuery(account.device.id))
  const sessionState = useAtomValue(accessSessionAtom)
  const [device] = deviceRows
  const enabled = control[0]?.enabled === 1
  const storedDefaults =
    device === undefined || device.isDeleted === 1
      ? null
      : device.defaultPermissions
  const session = sessionState?.accountId === account.id

  return useMemo(() => {
    const defaults = decodePermissions(storedDefaults)
    return {
      enabled,
      defaults,
      session,
      effective: effectivePermissions({ enabled, defaults, session }),
      accountId: account.id,
      deviceId: account.device.id,
    }
  }, [account.device.id, account.id, enabled, session, storedDefaults])
}

/**
 * Gates an action that has no route of its own (access/0002, rule 15).
 * `require(permission, action)` resolves `true` at once when the device or
 * the session grants it, and otherwise raises the one-shot PIN prompt, which
 * answers that one action and starts no session. `requirePin(action)` asks
 * for the PIN whatever the device grants: changing the PIN, turning access
 * control off and unblocking a device always do (access/0001), and so does
 * withdrawing money (access/0007), whose `detail` names the amount and where
 * it goes.
 */
export function useRequirePermission() {
  const { effective } = useAccess()
  // Read when `require` runs, not when it was created: callers keep it in
  // callbacks that outlive their render (an undo toast tapped seconds later),
  // and a session may have ended since.
  const effectiveRef = useRef(effective)
  effectiveRef.current = effective
  const setQueue = useSetAtom(pinPromptQueueAtom)

  const prompt = useCallback(
    (permission: Permission | null, action: TranslationKey, detail?: string) =>
      new Promise<boolean>((resolve) => {
        setQueue((queue) => [
          ...queue,
          { id: crypto.randomUUID(), permission, action, detail, resolve },
        ])
      }),
    [setQueue]
  )

  const require = useCallback(
    async (permission: Permission, action: TranslationKey, detail?: string) =>
      effectiveRef.current.has(permission)
        ? true
        : prompt(permission, action, detail),
    [prompt]
  )

  const requirePin = useCallback(
    (action: TranslationKey, detail?: string) => prompt(null, action, detail),
    [prompt]
  )

  return { require, requirePin }
}
