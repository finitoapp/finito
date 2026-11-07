# 0009 The backup reminder waits for more than 10,000 sats in the wallets

Status: accepted
Date: 2026-11-09

## Context

`account/0007` asked for the recovery-phrase backup on home from the
account's first paid payment, by any method. In use that was a nag: the
first test payment of a few crowns, or a café taking only cash and cards,
was asked every week to back up a phrase. `account/0007` rejected a wallet
threshold because the phrase restores the whole account, not only the
wallets; in use the weekly ask was the larger cost, so the reminder now
waits until money that only the phrase can bring back is at stake.

## Decision

- The reminder is due once the account's bitcoin wallets — every active
  Spark wallet and the Cashu wallet shared with Linky — hold more than
  10,000 sats together (`BACKUP_REMINDER_MIN_WALLET_SATS`), until the phrase
  is verified. A payment by itself, cash or card or bank transfer, no longer
  makes it due. It never shows on a demo account and only on a device that
  may open Security (`admin`).
- Whether it opens is still decided only as home is entered — navigating to
  it, the app starting on it, or the PIN unlocking the device there. The
  balances load after home appears, so an entry waits for them while home
  stays entered: the known balances already over the line open it, and it
  stays closed only once every wallet has answered. A wallet whose balance
  cannot be read never opens it by itself. A balance that rises over the
  line while home is in use waits for the next entry. A click outside the
  popup does not close it.
- The balances are read only on a device that would be asked: verified,
  demo, snoozed or locked, home reads no wallet.
- Closing it any way — "Later", Escape, or "Back up now" — keeps it away for
  7 days on this device, stored per account in the device database. The
  snooze does not sync.
- The rest of `account/0007` stands: backing up is optional and verified by
  three random words into `appSettings.recoveryPhraseVerifiedAt`; Security
  shows only the status; the backup is its own owner-only screen; the native
  app never lets the phrase leave the screen.

## Alternatives considered

- The first paid payment by any method (`account/0007`): asked accounts with
  nothing in the wallets every week.
- Any balance above zero: the first test payment would ask again.
- Opening the moment the balance crosses the line: it lands on a typed
  amount or a scan, the reason `account/0007` decides only on entry.
- Deciding with only what is loaded at entry: home is entered before any
  wallet answers, so the app starting on home would never ask.

## Consequences

A cash-only or card-only account is never reminded; its owner finds the
backup under Security, and losing its phone without one loses the account. The reminder can open a moment after home
appears, while the Spark wallet starts. An account whose wallets are
emptied by a withdrawal is not asked again until they fill up.

## Enforced by

- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > shows once the wallets hold more than 10,000 sats until verified`
- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > shows nothing while the wallets hold 10,000 sats or less`
- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > waits for a wallet still loading unless the others are already over the line`
- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > reads no balance on an account it would not ask`
- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > never shows on a demo account`
- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > stays away for a week after it is dismissed`
- `packages/app-shared/src/use-backup-reminder-prompt.test.ts > decideBackupReminder > waits on home for the balances, then opens once they are over the line`
- `packages/app-shared/src/use-backup-reminder-prompt.test.ts > decideBackupReminder > does not open while home is in use when it becomes due`
- `packages/app-shared/src/recovery-backup.test.ts > checkVerifyAnswers > rejects a wrong or missing word`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > markRecoveryPhraseVerified > writes the stamp and stays verified when run again`
- `apps/native-app/src/features/settings/security/security-settings-page.test.ts > offers no way to copy or share the phrase, only the optional verification`
- `apps/web-app/e2e/recovery-backup.spec.ts > the backup reminder waits for more than 10,000 sats in the wallet, Later puts it off, and verifying the backup ends it`
- `apps/web-app/e2e/recovery-backup.spec.ts > skipping the verification leaves the backup unverified`
