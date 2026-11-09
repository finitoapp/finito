import { createNotificationStore } from "@payky/core/background-jobs/notifications"
import { atom } from "jotai"

/**
 * The background jobs' notifications, one store per app: the App and Cashu
 * job runs both write into it, and the notification screens and dots read
 * it. Held in memory only, so it starts empty until the jobs report.
 */
export const notificationStoreAtom = atom(() => createNotificationStore())
