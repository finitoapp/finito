# 0011 Accounts lists what the device holds, adding one starts at the welcome, and removing the last one goes through the backup

Status: accepted
Date: 2026-11-16

## Context

Settings → "Switch User Account" listed each account with its creation
date, offered "New account" behind a confirmation that created the account
at once, "Existing account" through the chooser of onboarding/0011, and a
link to the sending side of a transfer. The active account could not be
removed, so a device could never be emptied, and an account whose only copy
was on that device could be removed with no more than a confirmation.

## Decision

- Settings → Accounts lists the accounts this device holds, each by its
  business's picture and name from the account's Nostr profile, the active
  one marked; no creation date. Each row offers Switch (the inactive ones)
  and Remove. As account/0004 had it for the picture, only the active
  account asks relays: the device row remembers the name and picture it
  last saw while the account was active, and an account whose business has
  no name yet shows the name the device gave it.
- The remembered picture is an https URL of up to 2048 characters or, unlike
  account/0004, an image data URL of up to 96 KiB. Both apps publish a
  picture chosen in the app as such a data URL (at most 256 px a side, JPEG),
  so leaving data URLs out, as 0004 did, left every inactive account without
  its picture. Anything larger still is not stored, and that account shows
  the app's icon or its initial.
- One row under them, "Add an account", opens onboarding's welcome screen
  in a new, empty account — a new business, or one the user already has,
  the same two ways as a first start. Onboarding's "Cancel setup" leaves
  the empty account for the one before it (it never had data of its own),
  so adding is not a one-way trap.
- Removing an account:
  - the active account, on no other device, with its recovery phrase not
    verified (account/0006): the removal becomes a trip to the backup
    screen, and nothing is removed;
  - the active account that other devices hold: a confirmation says it
    stays on them;
  - otherwise: a confirmation says only the recovery phrase brings it back.
  An inactive account's devices and backup state are not readable here (its
  database is closed), so it gets the phrase warning.
- Removing the active account switches to the most recently used account
  left on the device; with none left, the device starts a new, empty account
  and shows onboarding's welcome.
- Sending this account to another device lives in Settings → Devices
  (access/0013), not here.

## Alternatives considered

- Fetching every account's profile while the list is open (rejected in
  account/0004 too): it links the accounts at the relays, waits on them,
  and shows nothing offline.

- Keeping "New account" as a one-tap create: it made an account before the
  user had said what for, and the confirmation it needed was the welcome
  screen with fewer words.
- Refusing to remove the last account: a shared or returned device needs
  to be emptied.
- Checking the backup for inactive accounts too: it would mean opening
  their databases from the accounts screen.

## Consequences

- An inactive account's name and picture are as old as its last active
  session, and the device database holds up to 96 KiB of picture per
  account.

- The device-count check reads the account's device rows, so a device that
  died without being removed still counts as another copy; removing it in
  Settings → Devices first makes the backup check strict again.
- Onboarding's cancel path (`fallbackAccount`) is now the only way back from
  an added account, so it stays.

## Enforced by

- `packages/core/src/evolu/device-account.test.ts > storableNostrPicture > keeps an https picture and one the app picked, drops http and overlong ones`
- `packages/core/src/evolu/device-account.test.ts > the account list's names > names an account by its business once its profile is remembered`

- `packages/app-shared/src/account-removal.test.ts > accountRemovalStep > asks for the backup before removing the only copy of an account`
- `packages/app-shared/src/account-removal.test.ts > accountRemovalStep > removes an account its other devices keep`
- `packages/app-shared/src/account-removal.test.ts > accountRemovalStep > removes the only copy once its recovery phrase is backed up`
- `packages/app-shared/src/account-removal.test.ts > accountRemovalStep > warns about the phrase for a demo or an inactive account, whose devices are unknown here`
- `apps/web-app/e2e/settings-accounts.spec.ts > create, switch, and remove a device account`
- `apps/web-app/e2e/settings-accounts.spec.ts > canceling setup from onboarding discards the new account and switches back`
- `apps/web-app/e2e/settings-accounts.spec.ts > removing the only copy of an unverified account offers the backup first`
- `apps/web-app/e2e/settings-accounts.spec.ts > removing the only account leaves for onboarding's welcome`
