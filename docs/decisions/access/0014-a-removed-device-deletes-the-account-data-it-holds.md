# 0014 A removed device deletes the account data it holds

Status: accepted
Date: 2026-11-25

## Context

Under access/0013 a device another one removed only signed itself out: it
marked the account removed in its device database and kept everything else.
The account's app database — one Evolu database per account, named after
its owner — stayed on the device whole, and so did the account's key in the
device database. Removing an account by hand in Settings → Accounts did the
same, although the privacy policy (point 7) already promises that removing
it deletes its data from the device.

Evolu 8.27.2 can delete a database (`deleteDatabase`): it deletes the files,
ends every instance of that database in every tab and calls
`onDatabaseDeleted` on each, or reloads the app without it. An instance
opened later with the same owner fills again from relays, so the owner has
to stop being used before the deletion, not after. The device database is
one for all accounts, never syncs, and keeps the history of its changes, so
overwriting the key would not remove it.

This is no security boundary. A device that does not cooperate — offline,
on an older version, or modified — keeps the data, and whoever copied the
recovery phrase keeps access. It is better than nothing.

## Decision

This extends access/0013: removing a device signs it out **and deletes its
local data**. The same holds for removing an account by hand in Settings →
Accounts.

- The order is fixed (`removeAccountFromDevice`): first the active account
  stops syncing (`startAppOwnerSync`'s stop, the owner's `unuse`), then the
  account is marked removed and the device rows kept for it are tombstoned,
  waiting until the writes are applied, so no start uses the owner again;
  then the app moves off the account when other accounts are left; then the
  account's app database is deleted through an instance of its own that
  never syncs (`deleteAccountLocalData`). The reverse order would let the
  app open the still active account again, and relays would bring the data
  back.
- A removed device deliberately does not send the changes it has not sent
  yet: they go with the database. The ceiling is the sync that told the
  device it was removed: what Evolu sent in that round, or before it, is
  out. At start, an app whose local copy already holds the removal of this
  registered device (`startAppOwnerSyncUnlessRemoved`) does not turn the
  owner on at all, and the device deletes the data as it signs out. The
  check runs beside the client's start rather than before it, so it holds
  nothing up. Neither is a guarantee.
- This holds for Cashu too, knowingly. Only the app owner stops syncing;
  Linky's Cashu owners in the same database go on syncing until it is
  deleted, a few milliseconds, and the Cashu proofs this device has not sent
  yet go with the database. That can lose money, and the risk is accepted:
  the removal comes first, and no exception for the wallet is made.
- The device database remembers what is still to delete:
  `account.localDataDeletedAt` is set once the account's database is gone.
  At every start, after the device migrations and before the active account
  opens, the app deletes the database of every removed account without it
  (`deleteRemovedAccountsLocalData`). That covers an app killed between the
  steps, a deletion that failed (`DatabaseHeldError` from a React Native
  runtime a reload replaced, or `UnknownError`), and accounts removed before
  this decision, which are cleaned up once.
- Adding a removed account again revives its row, clears
  `localDataDeletedAt` so the sweep leaves it alone, and gets its sync
  transports back if the removal deleted them. When the removal never got to
  delete its database, the revival deletes it first, so the account does not
  come back with changes this device made before it was removed.
- The device rows kept per account are tombstoned with it: the PIN attempt
  log and its base, Cashu claim attempts and known mints, the Qerko terminal
  selection and the sync transports. The Cashu counters stay: they hold no
  secret, and losing them would let the account, added again, reuse
  derivation slots (cashu.md §3).
- With no account left on the device, the whole device database is deleted
  too, once the account's database is gone, and the app reloads into
  onboarding; until it does, it renders only its loader, since both
  databases' clients are disposed. The key goes with it, and so do the device's settings
  (language, theme, PIN log, Cashu counters) and its device id, so it joins
  any account later as a new device. When the account's database could not
  be deleted, the device database stays, since the sweep needs it.
- With other accounts left, the removed account's key stays in the device
  database: Evolu keeps the history of the row, and only deleting the whole
  database removes it. Holding accounts under a `ShardOwner` of their own
  and deleting them with `deleteOwner` would; that is a migration of the
  device database and a step of its own.

## Alternatives considered

- Deleting first and forgetting the account afterwards: the app would open
  the still active account again and relays would fill it back.
- Sending the device's unsent changes before deleting: the owner removed
  the device, so it has nothing more to write to the account.
- Letting the Cashu owners finish syncing before the deletion, so no unsent
  proof is lost: rejected, the removal is not to wait on the device.
- Overwriting `masterKey` in the device database: the column is not
  nullable, and Evolu keeps the old value in its history anyway.
- Waiting for the sweep alone instead of deleting at removal: the data
  would stay until the next start, which may be days away.

## Consequences

- A removed device that comes online loses what it had not synced yet. The
  confirmations of both removals say so.
- A device whose last account is removed loses its settings and its device
  id, and the app reloads, so the toast saying why may not stay on screen.
- Other tabs of the same account in a browser reload once its database is
  deleted, as Evolu does by default.
- On Android, a deletion refused with `DatabaseHeldError` waits for the
  next start; that has to be seen on a device.

## Enforced by

- `packages/core/src/evolu/account-wipe.test.ts > deleteAccountLocalData > deletes the app database, so a client opened anew finds it empty`
- `packages/core/src/evolu/account-wipe.test.ts > removeAccountFromDevice > forgets the account and deletes its data, other accounts left`
- `packages/core/src/evolu/account-wipe.test.ts > removeAccountFromDevice > deletes the device database too when no account is left`
- `packages/core/src/evolu/account-wipe.test.ts > deleteRemovedAccountsLocalData > deletes what a removal left behind, once, and leaves revived accounts alone`
- `packages/core/src/evolu/account-wipe.test.ts > deleteRemovedAccountsLocalData > a revived account is no longer swept, nor deleted at its next start`
- `packages/core/src/evolu/account-wipe.test.ts > createOrSelectAccount reviving a removed account > deletes the database a removal did not get to delete first`
- `packages/core/src/evolu/account-wipe.test.ts > createOrSelectAccount reviving a removed account > gets its transports back when the removal deleted them`
- `packages/core/src/evolu/account-wipe.test.ts > startAppOwnerSync > a change written after the sync stops reaches no relay`
- `packages/core/src/evolu/account-wipe.test.ts > loadRemovedHere > is true once the local copy holds this registered device's removal`
- `packages/core/src/evolu/account-wipe.test.ts > startAppOwnerSyncUnlessRemoved > leaves the owner off the network once the local copy holds this device's removal`
- `packages/core/src/modules/device/device-actions.test.ts > a removed device signing out > keeps no data of the account once it has signed out`
- `apps/web-app/e2e/access-gates.spec.ts > a device removed from another one deletes the account's data and starts over`
