# 0009 The backup reminder is a notification, snoozed for a week

Status: accepted
Date: 2026-11-09

## Context

`account/0007` opened the recovery-phrase backup reminder as a dialog on
entering home, at most once a week on each device. Even that proved
annoying: the dialog stands between the merchant and home, the screen they
come to in order to sell, whenever it is due. Notifications now exist
(notification/0001): a background job raises them, the notifications screen
lists them, and a dot tells that one is waiting (navigation/0005).

The phrase restores the whole account — history, catalog, settings and the
wallets — so every account that takes payments is still worth reminding,
whatever the payment method.

## Decision

- **The reminder is a notification, not a dialog.** A background job
  (`recovery-backup-reminder-job.ts`) raises it while it is due, and it
  shows as a card on the notifications screen with a dot on the way there
  (navigation/0005). Nothing opens on home.
- **The card has two actions.** "Back up" only opens the backup
  (`/settings/security/backup`); it does not snooze, so a backup started and
  left unfinished keeps the card and the dot until the phrase is verified.
  "Later" snoozes it; the job sees the snooze, drops the notification and
  the dot goes out.
- **The snooze is 7 days on this device**, stored per account in the device
  database, not synced, as before. When it runs out the job raises the
  notification again by itself, with nothing on screen changing.

What `account/0007` decided otherwise still holds and is restated here:

- Backing up the phrase is optional. Nothing is blocked by an unverified
  backup, and verifying is never a condition of using the app.
- The backup is verified by typing three random words of the phrase. A wrong
  answer is refused without saying which word was wrong. A passed check
  writes `appSettings.recoveryPhraseVerifiedAt`, a timestamp that holds no
  word of the phrase. "Verified" belongs to the account and syncs between
  its devices.
- The reminder is due after the account's first paid payment, by any
  method, until the phrase is verified. It never shows on a demo account
  and only to a device that may open Security (`admin`) — each app's
  permission table for notifications asks for it.
- Security shows only the status ("Verified 24. 10." or "Not verified") and
  a button to the backup; it never shows the phrase.
- The backup is its own screen, `/settings/security/backup`, owner-only: an
  introduction, the 20 numbered words (web adds Copy and Save to
  passwords), then the optional check with "Skip verification". A skip
  writes nothing; only a passed check marks the account verified.
- The native app never lets the phrase leave the screen: not selectable, no
  clipboard, no share sheet, screenshots blocked while it shows. It is
  transcribed on paper, and the verification is what catches a mistake.

## Alternatives considered

- The dialog on entering home (`account/0007`): it interrupts the work home
  is for, even at once a week.
- A thin reminder line on home and in Settings: it nagged from two places.
- "Back up" snoozing the reminder too, as the dialog's button did
  (`account/0007`): the card vanished although the backup was not done, so
  an unfinished backup went unreminded for a week.
- A notification that stays until verified, with no snooze: the dot would
  be lit for good on a till whose owner chose not to back up.
- The rest of the alternatives `account/0007` recorded (a reminder on the
  "paid" screen, a growing snooze, reminding only for wallet accounts,
  marking the backup done on Copy, a verified flag on the device) were
  rejected for the reasons given there.

## Consequences

An account that never takes a payment is never reminded. An account never
verified shows the dot until someone with `admin` puts it off for a week or
verifies; a device without `admin` (`access/0005`) shows neither the card
nor the dot. A snooze on one device leaves the dot lit on the account's
other devices. No job runs on a demo account (demo-data/0001), so the
notification never appears there.

`BackupReminderDialog`, `useBackupReminder` and
`useBackupReminderPrompt` are gone; the snooze column, query and write
remain.

## Enforced by

- `packages/core/src/background-jobs/jobs/recovery-backup-reminder-job.test.ts > recovery backup reminder job > raises nothing before the first paid payment`
- `packages/core/src/background-jobs/jobs/recovery-backup-reminder-job.test.ts > recovery backup reminder job > raises the notification once a payment is paid`
- `packages/core/src/background-jobs/jobs/recovery-backup-reminder-job.test.ts > recovery backup reminder job > drops it while snoozed and raises it again once the snooze runs out`
- `packages/core/src/background-jobs/jobs/recovery-backup-reminder-job.test.ts > recovery backup reminder job > drops it once the phrase is verified`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > isBackupReminderDue > shows after the first paid payment until verified`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > isBackupReminderDue > shows nothing before a payment`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > isBackupReminderDue > never shows on a demo account`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > isBackupReminderDue > stays away until the snooze runs out`
- `packages/app-shared/src/recovery-backup.test.ts > backupReminderSnoozedUntil > puts the reminder off for a week`
- `packages/app-shared/src/recovery-backup.test.ts > checkVerifyAnswers > rejects a wrong or missing word`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > markRecoveryPhraseVerified > writes the stamp and stays verified when run again`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > markRecoveryPhraseVerified > a settings row written without the column still counts as onboarded`
- `packages/core/src/modules/payment/payment-first-paid.test.ts > firstPaidPaymentQuery > finds nothing for a payment that was only created`
- `apps/web-app/src/platform/password-manager.test.ts > triggerPasswordManagerSeedSave > is unsupported without the Credential Management API`
- `apps/native-app/src/features/settings/security/security-settings-page.test.ts > offers no way to copy or share the phrase, only the optional verification`
- `apps/web-app/e2e/recovery-backup.spec.ts > the backup reminder waits for the first payment and Later puts it off`
- `apps/web-app/e2e/recovery-backup.spec.ts > Back up on the reminder opens the backup and leaves the reminder on`
- `apps/web-app/e2e/recovery-backup.spec.ts > verifying the backup ends the reminder`
- `apps/web-app/e2e/recovery-backup.spec.ts > skipping the verification leaves the backup unverified`
- `apps/web-app/src/hooks/use-active-notifications.test.ts > useActiveNotifications > hides the backup reminder from a device without admin`
