/**
 * Every notification a background job can raise; each plugin adds its
 * member. Data only: the apps render it (title, icon, actions, the
 * permission that may see it), so nothing here names a translation key or a
 * screen. A plugin raising several of one type tells them apart by a `key`.
 */
export type JobNotification = { readonly type: "recoveryPhraseBackup" }

export type JobNotificationType = JobNotification["type"]

/**
 * One job's notifications: `set` replaces them all, `[]` clears them, and
 * disposing the scope drops them. A job always hands over its whole current
 * list, never single additions or removals, so memory cannot drift from the
 * state the job derives it from.
 */
export interface JobNotificationScope extends Disposable {
  readonly set: (notifications: ReadonlyArray<JobNotification>) => void
}

export interface NotificationsDep {
  readonly notifications: {
    /**
     * Opens the scope of the job named `jobKey`, stable and unique per job.
     * Opening it again (a job restarted before its old run was disposed)
     * hands the job's place to the new scope; the old one then changes
     * nothing, not even when disposed.
     */
    readonly open: (jobKey: string) => JobNotificationScope
  }
}

/**
 * The in-memory store an app reads: the jobs' notifications in the order the
 * jobs first opened their scopes. `getSnapshot` returns the same array until
 * something changes, as `useSyncExternalStore` needs.
 */
export interface NotificationStore extends NotificationsDep {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => ReadonlyArray<JobNotification>
}

interface JobEntry {
  readonly owner: symbol
  readonly notifications: ReadonlyArray<JobNotification>
}

const sameNotifications = (
  a: ReadonlyArray<JobNotification>,
  b: ReadonlyArray<JobNotification>
): boolean =>
  a.length === b.length &&
  a.every(
    (notification, index) =>
      JSON.stringify(notification) === JSON.stringify(b[index])
  )

const emptyNotifications: ReadonlyArray<JobNotification> = []

export const createNotificationStore = (): NotificationStore => {
  // A Map keeps insertion order, and replacing a key keeps its place.
  const entries = new Map<string, JobEntry>()
  const listeners = new Set<() => void>()
  let snapshot: ReadonlyArray<JobNotification> | null = emptyNotifications

  const changed = () => {
    snapshot = null
    for (const listener of [...listeners]) listener()
  }

  const open = (jobKey: string): JobNotificationScope => {
    const owner = Symbol(jobKey)
    const previous = entries.get(jobKey)
    entries.set(jobKey, { owner, notifications: emptyNotifications })
    if (previous !== undefined && previous.notifications.length > 0) changed()

    const isOwner = () => entries.get(jobKey)?.owner === owner

    return {
      set: (notifications) => {
        const entry = entries.get(jobKey)
        if (entry?.owner !== owner) return
        if (sameNotifications(entry.notifications, notifications)) return
        entries.set(jobKey, { owner, notifications: [...notifications] })
        changed()
      },
      [Symbol.dispose]: () => {
        if (!isOwner()) return
        const hadNotifications =
          (entries.get(jobKey)?.notifications.length ?? 0) > 0
        entries.delete(jobKey)
        if (hadNotifications) changed()
      },
    }
  }

  return {
    notifications: { open },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => {
      snapshot ??= [...entries.values()].flatMap((entry) => entry.notifications)
      return snapshot
    },
  }
}
