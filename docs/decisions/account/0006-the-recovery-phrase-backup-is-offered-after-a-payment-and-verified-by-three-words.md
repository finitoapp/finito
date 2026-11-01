# 0006 The recovery-phrase backup is offered after a payment and verified by three words

Status: superseded by account/0007
Date: 2026-10-25

## Context

The recovery phrase is the only way to get an account onto another device or
back after losing the phone. Onboarding does not ask for a backup
(`onboarding/0002`), so nothing recorded whether an account was backed up and
nothing asked. A transcription mistake was found only when the phrase was
needed, and Security showed the whole phrase open next to unrelated cards.

## Decision

- Backing up the phrase is optional. Nothing is blocked by an unverified
  backup, and verifying is never a condition of using the app.
- The backup is verified by typing three random words of the phrase. A wrong
  answer is refused without saying which word was wrong. A passed check writes
  `appSettings.recoveryPhraseVerifiedAt`, a timestamp that holds no word of the
  phrase. "Verified" belongs to the account and syncs between its devices.
- The only trigger of a reminder is the account's first paid payment. From then
  on, until the phrase is verified, home asks in a popup to back up now or
  later. "Later" hides it until the app starts again, held in memory only. A
  click outside the popup does not close it. It never shows on a demo account
  and only on a device that may open Security.
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

- Keeping the phrase on Security behind a Show button: the phrase is one tap
  from unrelated settings, and the backup has no beginning or end.
- A thin reminder line on home and in Settings: it nagged from two places.
- Marking the backup done on Copy, as Linky does: copying proves nothing about
  a written or saved phrase.
- Keeping the verified flag on the device: a second device would ask again.
- A reminder on the "paid" screen: it delays the customer in the queue.

## Consequences

An account that never takes a payment is never reminded. An account never
verified sees the card on every start of the app until it is.

## Enforced by

- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > shows nothing before a payment`
- `packages/app-shared/src/recovery-backup.test.ts > isBackupReminderDue > never shows on a demo account`
- `packages/app-shared/src/recovery-backup.test.ts > checkVerifyAnswers > rejects a wrong or missing word`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > markRecoveryPhraseVerified > writes the stamp and stays verified when run again`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > markRecoveryPhraseVerified > a settings row written without the column still counts as onboarded`
- `packages/core/src/modules/payment/payment-first-paid.test.ts > firstPaidPaymentQuery > finds nothing for a payment that was only created`
- `apps/web-app/src/platform/password-manager.test.ts > triggerPasswordManagerSeedSave > is unsupported without the Credential Management API`
- `apps/native-app/src/features/settings/security/security-settings-page.test.ts > offers no way to copy or share the phrase, only the optional verification`
- `apps/web-app/e2e/recovery-backup.spec.ts > the backup reminder waits for the first payment, and verifying the backup ends it`
- `apps/web-app/e2e/recovery-backup.spec.ts > skipping the verification leaves the backup unverified`
