# 0001 Background jobs raise notifications, held in memory only

Status: accepted
Date: 2026-11-09

## Context

The notifications screen (navigation/0001, navigation/0004) was an empty
state: nothing raised a notification. The first one is the recovery-phrase
backup reminder (account/0009), which until then interrupted home as a
dialog. Others are coming from the plugins — a bank sync that keeps
failing, an EET report that is not accepted — and each plugin already runs
as a background job that knows its own state, including what lives only in
memory, such as how many syncs in a row failed.

## Decision

- **Background jobs raise notifications.** A job reaches them through
  `NotificationsDep` in its `BackgroundJobContext`
  (`packages/core/src/background-jobs/notifications.ts`), not through a
  framework beside the jobs. Checking whether the backup is due is just
  another job (`recovery-backup-reminder-job.ts`).
- **No table, only memory.** The app holds the notifications in one
  in-memory `NotificationStore`; nothing is written to Evolu. A job derives
  its notifications from its state, so they need no storing.
- **A job always hands over its whole list.** It opens one scope under a
  stable job key and calls `set` with everything that holds now; `[]`
  clears it. There are no single additions or removals, so memory cannot
  drift from the state it comes from and a job has nothing to clean up.
  When the job ends — the account changes, the jobs stop — its scope is
  disposed and its notifications go with it.
- **Core carries data, the apps render it.** A `JobNotification` is a type,
  an optional `key` telling several of one type apart, and its parameters.
  Each app maps every type to a renderer — icon, title, description,
  actions — and to the permission that may see it, in tables that
  `satisfies Record<JobNotificationType, ...>`, so a type without a
  renderer or permission, or one for a type that is gone, fails to compile
  in either app.
- **Who may see a notification is the app's call.** It depends on the
  tab's PIN session, not on the data, so the job does not filter by
  permission.
- **A job that only raises notifications writes nothing.** Writes come from
  the actions the user starts from a notification.
- **A notification that cannot be derived from state** (a one-off event)
  will be another job: a domain module of its own with a table, Tasks to
  create and delete its rows and a query, and a job that follows the query
  and hands its rows to its scope. Other plugins call that module's Tasks.
  The framework does not change for it, and a table is the last resort.

## Alternatives considered

- An Evolu table of notifications written by the jobs: every derived
  notification would need its own create and delete kept in step with the
  state it mirrors, would sync to devices where it may not hold, and would
  have to be cleaned up when the state changes while no job runs.
- A notification framework apart from the jobs: a second place that watches
  plugin state the jobs already watch.
- Commands to add and remove single notifications: a missed removal leaves
  a stale notification for good.

## Consequences

- No job runs on a demo account (demo-data/0001), so a demo account never
  shows a notification. That is right for the backup reminder; a
  notification on a demo account would need an exception to demo-data/0001.
- On the web every tab runs its own jobs, so each tab has its own store and
  its own notifications. When the jobs move to one window, the web store
  has to share its notifications between windows; core does not change.
  The native app has one window.
- The store is empty at start until the jobs hand over their first lists,
  so a dot appears a moment after the app opens.
- A plugin with notifications has two halves: its job in core and a
  renderer in each app (`notification-renderers` in each app's
  `features/notifications`).
- A failing job leaves the other jobs' notifications alone; its error goes
  through `onError` like any job's.

## Enforced by

- `packages/core/src/background-jobs/notifications.test.ts > createNotificationStore > set replaces the job's previous list`
- `packages/core/src/background-jobs/notifications.test.ts > createNotificationStore > disposing the scope drops its notifications`
- `packages/core/src/background-jobs/notifications.test.ts > createNotificationStore > lists the jobs in the order their scopes were opened`
- `packages/core/src/background-jobs/notifications.test.ts > createNotificationStore > two jobs do not overwrite each other's lists`
- `packages/core/src/background-jobs/notifications.test.ts > createNotificationStore > getSnapshot is the same array until something changes`
- `packages/core/src/background-jobs/notifications.test.ts > createNotificationStore > a job reopened before its old scope is disposed keeps the new list`
- `packages/core/src/background-jobs/jobs/recovery-backup-reminder-job.test.ts > recovery backup reminder job > disposing the job drops its notification`
- `apps/web-app/src/hooks/use-active-notifications.test.ts > useActiveNotifications > hides the backup reminder from a device without admin`
- `apps/native-app/src/core/notification-permissions.test.ts > the backup notification needs admin`
