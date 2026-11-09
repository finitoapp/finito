import type { JobNotification } from "@payky/core/background-jobs/notifications"
import { useAtomValue } from "jotai"
import { useMemo, useSyncExternalStore } from "react"
import { notificationStoreAtom } from "../atoms/notifications.ts"
import { visibleNotifications } from "../core/notification-permissions.ts"
import { useAccess } from "../core/use-access.ts"

/**
 * Web's `useActiveNotifications`: the background jobs' notifications this
 * device may see, those whose type's permission (`notificationPermissions`)
 * the device has now. The store is memory and the access queries are the
 * ones the access gate above every screen already holds, so this does not
 * suspend: the bar and home's header do not blink while it reads.
 */
export function useActiveNotifications(): ReadonlyArray<JobNotification> {
  const store = useAtomValue(notificationStoreAtom)
  const notifications = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { effective } = useAccess()
  return useMemo(
    () => visibleNotifications(notifications, effective),
    [notifications, effective]
  )
}
