# 0007 The backup reminder opens on entering home and snoozes for a week

Status: superseded by account/0009
Date: 2026-11-01

## Context

`account/0006` asked for the recovery-phrase backup on home after the
account's first paid payment, in a popup that "Later" hid until the app
started again. Two things went wrong with that:

- It opened the moment its condition held, also while home was in use: in
  the middle of typing an amount when a sync job settled a payment in the
  background.
- "Until the app starts again" meant never on a till that runs for weeks
  with the screen kept awake, and at every start on an Android phone that
  kills the app often.

The phrase restores the whole account — history, catalog, settings and the
wallets — so every account that takes payments is worth reminding, whatever
the payment method. The aim is to remind sensibly and not often.

## Decision

- Backing up the phrase is optional. Nothing is blocked by an unverified
  backup, and verifying is never a condition of using the app.
- The backup is verified by typing three random words of the phrase. A wrong
  answer is refused without saying which word was wrong. A passed check writes
  `appSettings.recoveryPhraseVerifiedAt`, a timestamp that holds no word of the
  phrase. "Verified" belongs to the account and syncs between its devices.
- The reminder is due after the account's first paid payment, by any method,
  until the phrase is verified. It never shows on a demo account and only on
  a device that may open Security (`admin`).
- Whether it opens is decided only as home is entered — navigating to it, the
  app starting on it, or the PIN unlocking the device there. A reminder that
  becomes due while home is in use waits for the next entry. A click outside
  the popup does not close it.
- Closing it any way — "Later", Escape, or "Back up now" — keeps it away for
  7 days on this device, stored per account in the device database, so a
  restart does not bring it back early and a till that never restarts is
  asked again. The snooze does not sync.
- Security shows only the status ("Verified 24. 10." or "Not verified") and a
  button to the backup; it never shows the phrase.
- The backup is its own screen, `/settings/security/backup`, owner-only: an
  introduction, the 20 numbered words (web adds Copy and Save to passwords),
  then the optional check with "Skip verification". A skip writes nothing; only
  a passed check marks the account verified.
- The native app never lets the phrase leave the screen: not selectable, no
  clipboard, no share sheet, screenshots blocked while it shows. It is
  transcribed on paper, and the verification is what catches a mistake.

## Alternatives considered

- "Later" until the app starts again (`account/0006`): never on a till that
  runs for weeks, at every start on Android.
- Opening as soon as it is due, in a quiet moment found by watching taps,
  the typed amount, other dialogs and the scanner: it worked, but needed
  timers and listeners across both apps for a reminder that may simply wait
  for the next entry.
- A snooze that grows (1, 3, then 7 days): one fixed week is as quiet and
  needs no count of how often it was put off.
- Reminding only once money reached the Spark or Cashu wallet: the phrase
  protects the whole account, not only the wallets, so a cash-only café
  would lose everything with the phone without ever being told.
- Keeping the phrase on Security behind a Show button: the phrase is one tap
  from unrelated settings, and the backup has no beginning or end.
- A thin reminder line on home and in Settings: it nagged from two places.
- Marking the backup done on Copy, as Linky does: copying proves nothing about
  a written or saved phrase.
- Keeping the verified flag on the device: a second device would ask again.
- A reminder on the "paid" screen: it delays the customer in the queue.

## Consequences

An account that never takes a payment is never reminded. An account never
verified is asked at most once a week on each device where `admin` reaches
home. The first reminder usually comes as the merchant returns home from
the first paid payment. A device that sells without the PIN never has
`admin` on home (`access/0005`), so it is not asked; the owner is reminded
on their own device.

## Enforced by

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
- `apps/web-app/e2e/recovery-backup.spec.ts > the backup reminder waits for the first payment, Later puts it off, and verifying the backup ends it`
- `apps/web-app/e2e/recovery-backup.spec.ts > skipping the verification leaves the backup unverified`
