# 0005 Account, Security and Access become Accounts, Devices, Backup and Backends

Status: accepted
Date: 2026-11-16

## Context

The settings group "Account & Sync" held three screens — "Switch User
Account", "Security & Sync" (the recovery phrase and the Evolu transports)
and "Access" (the PIN and the devices) — whose names said neither what was
inside nor where to look for a device or a backup.

## Decision

The group holds four screens, each named by what it lists:

| Screen | Holds |
|---|---|
| Accounts | the accounts on this device, adding and removing one (account/0011) |
| Devices | the account's devices by what each may do, adding one, and the PIN (access/0013) |
| Backup | the recovery phrase and its verification (account/0006) |
| Backends | the Evolu transports the account syncs through |

The routes stay where they were (`/settings/accounts`, `/settings/access`,
`/settings/security`, `/settings/security/backup`); Backends is new at
`/settings/backends`. All four are owner-only (access/0002). Nostr relays
are not shown: nothing in the app lets the user change them.

## Alternatives considered

- One "Account" screen with everything: four unrelated lists on one page.
- Showing the Nostr relays under Backends read-only: a list nobody can act
  on.

## Consequences

Web and native share the four rows and their titles; the native settings
list mirrors web's order.

## Enforced by

- `apps/native-app/src/features/settings/security/security-settings-page.test.ts > keeps the backup and backends screens owner-only`
- `apps/native-app/src/core/route-access.test.ts > native route access > matches a dynamic segment and prefers the static sibling`
- `apps/web-app/e2e/demo-data.spec.ts > a demo account generates from today back until stopped, with its relays locked off`
