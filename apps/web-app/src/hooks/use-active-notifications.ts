import type {
  JobNotification,
  JobNotificationType,
} from "@payky/core/background-jobs/notifications"
import type { Permission } from "@payky/core/modules/access/access-types"
import { useAtomValue } from "jotai"
import { useMemo, useSyncExternalStore } from "react"
import { notificationStoreAtom } from "@/atoms/notifications.ts"
import { useAccess } from "@/hooks/use-access.ts"

/**
 * The permission a device needs to see each notification. The jobs raise
 * them whatever the PIN session (who may see one depends on this tab, not on
 * the data), so the app decides. It sits here rather than in the renderer
 * table of `features/notifications` because home's bell reads it too, and a
 * hook may not import a feature.
 */
export const notificationPermissions = {
  recoveryPhraseBackup: "admin",
} as const satisfies Record<JobNotificationType, Permission>

/**
 * The background jobs' notifications this device may see right now. Reads
 * the in-memory store without suspending, so the screens showing a dot do
 * not flicker while the jobs report.
 */
export function useActiveNotifications(): ReadonlyArray<JobNotification> {
  const store = useAtomValue(notificationStoreAtom)
  const notifications = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { effective } = useAccess()

  return useMemo(
    () =>
      notifications.filter((notification) =>
        effective.has(notificationPermissions[notification.type])
      ),
    [notifications, effective]
  )
}
