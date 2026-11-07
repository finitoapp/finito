# 0011 A new default sync relay reaches the accounts on the defaults

Status: accepted
Date: 2026-10-13

## Context

An account stores its sync relays as device rows when it is created
(`insertAccount` in `packages/core/src/evolu/device-account.ts`), so a relay added to
`createDefaultEvoluTransportUrls` later reaches only new accounts. Payky now runs
its own Evolu relay, `wss://evolu.agora.gripe`, and existing accounts should
sync through it too. Some accounts were brought from another device with
relays of their owner's choosing and deliberately carry none of the
defaults.

## Decision

`wss://evolu.agora.gripe` is a default relay. A device migration adds it
to every account that has a row for `wss://evolu.linky.fit`, the mark of an
account that took the defaults, switched on or off as that account's Linky
row is: an owner who switched Linky's relay off does not get agora's
switched on, and a demo account, whose relays are all stored off
(demo-data/0001), gets it off too. A removed account, an account without
Linky's row, and one with any row for agora's are left as they are, so an
owner who switched agora's relay off keeps it off.

## Alternatives considered

- New accounts only: existing accounts would never sync through Payky's own
  relay unless their owner added it by hand.
- Every account: an account on a custom relay only would start sending its
  encrypted data to a server its owner did not choose.

## Consequences

The next default relay needs a migration of its own; the Linky row stays the
test for "took the defaults" only while Linky is a default.

## Enforced by

- `packages/core/src/migrations/agora-evolu-relay-migration.test.ts > agora evolu relay migration > adds agora's relay, switched on, to an account on the default relays`
- `packages/core/src/migrations/agora-evolu-relay-migration.test.ts > agora evolu relay migration > leaves an account on relays of its own choosing alone`
- `packages/core/src/migrations/agora-evolu-relay-migration.test.ts > agora evolu relay migration > keeps agora's relay off once its owner switched it off`
- `packages/core/src/migrations/agora-evolu-relay-migration.test.ts > agora evolu relay migration > adds it switched off to an account whose owner switched Linky's relay off`
- `packages/core/src/migrations/agora-evolu-relay-migration.test.ts > agora evolu relay migration > adds it switched off to a demo account, which never syncs`
