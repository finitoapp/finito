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
import { accountAtom } from "../atoms/account.ts"
import { useEvoluQuery } from "../hooks/use-evolu-query.ts"

/** Mirrors the web `useAccess`: access control off or a session grants all. */
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
 * Native `require` for actions without a route (access/0002), same semantics
 * as the web hook. A denied action waits on the queued prompt, which
 * `PinPromptHost` settles.
 */
export function useRequirePermission() {
  const { effective } = useAccess()
  // Read at call time: callers keep `require` in callbacks that outlive a render.
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
