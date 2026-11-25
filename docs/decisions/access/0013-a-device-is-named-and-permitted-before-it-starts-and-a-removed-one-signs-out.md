# 0013 A device is named and permitted before it starts, and a removed one signs out

Status: accepted
Date: 2026-11-16

## Context

Under access/0004 a new device started with no permissions, named by a
random pair of words, and the owner set it up in Settings → Access once it
had synced. Removing a device there only cleared its row: the device itself
kept the account, registered itself again on its next start and came back
with no permissions, so there was no way to take an account off a lost or
a former employee's phone from another device. The owner also could not say,
while sending the account to a new device, what it should be allowed to do
there — and the settings sections (Account, Security, Access) did not say
where devices were.

## Decision

- Each device upserts its own `device` row into the active account's app
  database on start (id, type, browser, OS). That write never touches
  `defaultPermissions`, `pinBlockedAt` or `pinUnblockToken`, and writes
  `name` only while the row has none: Evolu resolves each column
  last-write-wins, so writing them on every start would undo what the owner
  set. A device that has synced no row yet still has one once the owner has
  set its permissions, so those are kept and the device names it on arrival.
- A new device is named after what it is — its maker and model on a phone
  ("Samsung SM-A546B"), its browser and system in a browser ("Chrome ·
  macOS") — and only a device nothing is known about gets the random name.
  The name is renamable and syncs.
- Sending the account to a new device by QR (account/0001) starts in
  Settings → Devices, and, while access control is on, asks there what the
  new device may do without the PIN, Basic preselected, before the QR is
  shown. The new device sends its device id with its `hello`, and the source
  saves the chosen defaults onto that id once the transfer is done; an
  older device that sends no id starts with none, to be set once it shows
  up. Settings → Accounts keeps the receiving side (onboarding/0011).
- `defaultPermissions = null` is no permissions; a device whose defaults
  nobody set — a restore by phrase, any new row — starts there. The turn-on
  wizard and the presets stay as access/0004 had them.
- Removing a device signs it out of the account: the row is tombstoned
  with its permissions cleared, and the device, on seeing the tombstone —
  at its next start, or as it syncs in while running — drops the account
  from its device database and goes to whatever account is left, or to
  onboarding. The owner is told why. Removal asks for the PIN even on a
  device with `admin`, once there is one, as every irreversible access
  change does (access/0001); the device itself cannot be removed from its
  own list.
- A device tells an old tombstone from a removal by a flag in its device
  database, set once it has registered since the account was added: a
  device that has not yet registered in this account (a new transfer, a
  restore, a rejoin after being removed) writes its row back alive, so a
  removal from before it joined cannot sign it out; one that has registered
  never writes `isDeleted`, so a removal wins.
- The device list is ordered by what each device may do: those with
  `admin` first, then by how many permissions they hold, then by name.
  Under the list sits the PIN that locks the rest: turning access control
  on with its wizard and off, and changing it.
- The device id lives in the device database (access/0004's migration).

## Alternatives considered

- A PIN per device: one PIN for the whole account stays (access/0001);
  what differs per device is what it may do without it.
- Removing a device by rotating the account's key, so the removed device
  cannot sync: Evolu has no key rotation, and the removed device keeps the
  data it already has either way. Signing it out on its next sync is what a
  cooperative device does; a hostile one is a backup question, not an
  access one.
- Keeping the device's random name and asking the owner to rename: every
  owner with two phones renamed both.

## Consequences

- A device offline since its removal keeps the account until it next
  connects; the owner sees it listed as removed only after that.
- A device whose device database was cleared registers as a new device,
  with no permissions, as before.
- The QR transfer's `hello` carries one more field; the two sides stay
  compatible with older builds that do not send or read it.
- A removed device also deletes the account's data it holds, as access/0014
  extends this decision.

## Enforced by

- `packages/core/src/modules/device/device-actions.test.ts > device rows > registering again keeps the name and permissions the owner set`
- `packages/core/src/modules/device/device-actions.test.ts > device rows > a device removed from another one is told so and does not come back`
- `packages/core/src/modules/device/device-actions.test.ts > device rows > a device joining the account again rejoins over its old removal, with no permissions`
- `packages/core/src/modules/device/device-actions.test.ts > device rows > permissions set before a device first registers stay, and the device names its row`
- `packages/core/src/modules/device/device-utils.test.ts > defaultDeviceName > names a device by its maker and model`
- `packages/core/src/modules/device/device-utils.test.ts > defaultDeviceName > names a device without a model by its browser and system`
- `packages/core/src/modules/device/device-utils.test.ts > defaultDeviceName > leaves a device it knows nothing about to the random name`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > tells the source which device the account went to`
- `packages/app-shared/src/access-form.test.ts > sortDevicesByPermissions > lists admins first, then by how much a device may do, then by name`
- `packages/core/src/modules/access/access-utils.test.ts > device permissions > null is no permissions`
- `packages/core/src/migrations/device-id-migration.test.ts > deviceIdMigration > moves the device id out of localStorage into the device database`
- `apps/native-app/src/features/settings/access/access-settings-access.test.ts > asks for the PIN, once there is one, before removing a device signs it out`
- `apps/native-app/src/features/settings/access/access-settings-access.test.ts > saves the permissions chosen for a new device once it says which device it is`
- `apps/web-app/e2e/access.spec.ts > a device with no permissions starts on the PIN screen`
- `apps/web-app/e2e/access-gates.spec.ts > Settings → Devices edits, renames and removes devices`
