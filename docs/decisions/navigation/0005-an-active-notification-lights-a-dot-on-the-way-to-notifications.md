# 0005 An active notification lights a dot on the way to Notifications

Status: accepted
Date: 2026-11-09

## Context

navigation/0001 put Payky's notifications behind a bell on home and said
that, with nothing raising a notification yet, "the bell carries no count";
navigation/0004 gave Finito's notifications a tab of the bar and the rail,
while home's hamburger opens Activity. Background jobs now raise
notifications (notification/0001), the first being the backup reminder
(account/0009), which no longer opens anything on home. Without a sign
somewhere the merchant looks, a notification would wait unseen on a screen
nobody opens.

## Decision

- **An active notification lights a dot**, a small circle at the corner of
  the icon that leads to Notifications (`NotificationDot`). It shows
  whether one notification or several is active; there is no count. Only
  the notifications the device's access lets it see count
  (`useActiveNotifications`), so a device without the permission a
  notification needs shows no dot for it.
- **Payky: on the bell on home.** The hamburger, which opens Activity
  (navigation/0001), carries no dot, since Notifications are not in its
  section.
- **Finito: on home's hamburger, and on the Notifications tab** of the
  phone's bar and of the rail on a wide window, where there is no
  hamburger. The hamburger opens Activity, as before, from where the
  Notifications tab is one tap away.
- **While the dot shows, the icon's accessible name says so**
  (`nav.notificationsUnread`, "Notifications – new") instead of
  `nav.notifications`.

This replaces only navigation/0001's "the bell carries no count".
Everything else navigation/0001 and navigation/0004 decided still holds.

## Alternatives considered

- A number on the bell: a count of notifications that each need one look
  says no more than a dot, and draws the eye harder.
- Finito's dot on the Notifications tab alone: on a phone the bar shows
  only on a root screen, and home, where the merchant spends the day, has
  only the hamburger.
- A dot on Payky's hamburger: it leads to Activity, where Notifications
  are not.

## Consequences

- The dot appears a moment after start, once the jobs hand over their first
  lists (notification/0001).
- On the web each tab lights its own dot from its own jobs; a snooze in one
  tab reaches the others through the device database their jobs follow.

## Enforced by

- `apps/web-app/e2e/recovery-backup.spec.ts > the backup reminder waits for the first payment and Later puts it off`
- `apps/web-app/e2e/recovery-backup.spec.ts > verifying the backup ends the reminder`
- `apps/web-app/e2e/menu.spec.ts > the bell on home, dark on a fresh account, opens Notifications, which has Back and no bar`
