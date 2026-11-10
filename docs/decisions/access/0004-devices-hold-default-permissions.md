# 0004 Devices hold default permissions, and a new one holds none

Status: accepted
Date: 2026-10-08

## Context

Roles belong to devices (access/0001), so the app database needs a row per
device that the owner can set from any device, and the device needs an id
that survives restarts.

## Decision

- Each device upserts its own `device` row into the active account's app
  database on start (id, type, browser, OS). That upsert never writes
  `defaultPermissions`, `pinBlockedAt` or `pinUnblockToken`, and writes
  `name` only for a new row: Evolu resolves each column last-write-wins, so
  writing them on every start would undo what the owner set.
- `defaultPermissions = null` is no permissions. A new device — transfer,
  restore, any new row — starts there.
- The turn-on wizard lists every device with a synced row, each preset to
  Basic, and saves their defaults in the same batch as switching access
  control on; otherwise every existing device, the owner's own included,
  would stop working. A device that has not synced yet starts at `null`.
- The owner tells devices apart by name (renamable, synced), "this device"
  and type, browser and OS.
- Presets are templates copied onto a device; editing a preset never
  changes a device.
- Adding a device — sending this account to it by QR (account/0001) —
  starts in Settings → Access, next to the device list where the owner then
  sets what it may do. Settings → Accounts keeps the receiving side (taking
  an account from another device, restoring by phrase), which adds an
  account to this device rather than a device to the account, and links to
  Access for the sending side.
- Removing a device row clears its permissions together with the delete,
  so a device that is still alive comes back with none.
- The device id lives in the device database. A device migration moved the
  `payky.deviceId` value out of `localStorage`, so existing devices keep
  their id and their permissions.

## Alternatives considered

Keeping the id in `localStorage`: it is cleared separately from the
database, and nothing else persistent lives there.

## Consequences

An id lost anyway (cleared site data, Safari's storage eviction) makes a
new device with no permissions; the old row stays until the owner removes
it.

The CLI keeps its device id in a file beside its database instead
(account/0010).

## Enforced by

- `packages/core/src/modules/device/device-actions.test.ts > device rows > registering again keeps the name and permissions the owner set`
- `packages/core/src/modules/device/device-actions.test.ts > device rows > removing a device clears its permissions, so it comes back with none`
- `packages/core/src/modules/access/access-utils.test.ts > device permissions > null is no permissions`
- `packages/core/src/migrations/device-id-migration.test.ts > deviceIdMigration > moves the device id out of localStorage into the device database`
- `apps/web-app/e2e/access.spec.ts > a device with no permissions starts on the PIN screen`
- `apps/web-app/e2e/access-gates.spec.ts > Settings → Access edits, renames and removes devices`
