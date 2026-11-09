import type {
  JobNotification,
  JobNotificationType,
} from "@payky/core/background-jobs/notifications"
import type { Permission } from "@payky/core/modules/access/access-types"

/**
 * The permission a device needs to see each notification type, web's
 * `notificationPermissions`. The jobs raise notifications whatever the PIN
 * session, so the app decides who sees them. It sits here rather than in
 * the renderer table of `features/notifications` because the dots (the
 * menu's tab, home's hamburger) read it too, through
 * `useActiveNotifications`, and neither a hook nor a component may import a
 * feature.
 */
export const notificationPermissions = {
  recoveryPhraseBackup: "admin",
} as const satisfies Record<JobNotificationType, Permission>

/** The notifications a device holding `effective` may see, in store order. */
export const visibleNotifications = (
  notifications: ReadonlyArray<JobNotification>,
  effective: ReadonlySet<Permission>
): ReadonlyArray<JobNotification> =>
  notifications.filter((notification) =>
    effective.has(notificationPermissions[notification.type])
  )
