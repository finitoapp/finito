# 0003 The merchant picks the relays tables publish to

Status: accepted
Date: 2026-10-14

## Context

Each table's view travels to guests as a signed, encrypted nostr event on
public relays (docs/table-self-pay-design.md §2). The default relays were fixed
at build time, so a merchant could not move off one that rate-limits or drops
the table events, nor onto relays of their own. Stickers already printed name
no relays, and the guest page reads the relays the sticker gives it.

## Decision

The merchant chooses the relays in Settings → Security & Sync: a default can be
switched off and any `wss:` relay added. An added relay is stored as
`wss://` with its host in lowercase, so one typed with a capital still names
itself on a sticker. The list is synced per account, so every merchant
device publishes to the same relays.

The last active relay cannot be switched off. Two devices that each switch
off a different last relay before they sync leave none active, and then the
tables publish to the defaults (`activeSelfPayRelays` in
`table-self-pay-relay-utils.ts`), so no table goes dark.

A sticker names its relays after the keys only when they differ from the
defaults, in any order. A sticker on the defaults stays as small as before,
and every sticker printed before the setting still works.

Changing the list changes the QR. A sticker printed before reads only the
relays it names, so the sticker check reports it as `relaysChanged` and asks
for a new one.

## Alternatives considered

Always naming the relays in the sticker. Every QR would grow, and every
sticker printed before the setting would read nothing.

## Consequences

The guest page reads relays from the sticker, so its CSP allows any `wss:`
host (`vite.config.ts`). A forged sticker gains nothing from that: it could
already carry keys of its own, and the events still verify against the key
in the sticker. Narrow the CSP back to a fixed list if Payky ever drops the
merchant's choice for relays of its own.

Switching relays off or adding one costs the merchant a reprint of every
table's sticker, which the sticker check points out.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-relay-utils.test.ts > self-pay relays > a default relay is on until its row switches it off`
- `packages/core/src/modules/table-self-pay/table-self-pay-relay-utils.test.ts > self-pay relays > lists an added relay after the defaults`
- `packages/core/src/modules/table-self-pay/table-self-pay-relay-utils.test.ts > self-pay relays > publishes to the defaults when every relay is off`
- `packages/core/src/modules/table-self-pay/table-self-pay-relay-utils.test.ts > self-pay relays > a sticker names its relays only when they differ from the defaults`
- `packages/core/src/modules/table-self-pay/table-self-pay-relay-utils.test.ts > self-pay relays > a sticker that names no relays reads the defaults`
- `packages/core/src/modules/table-self-pay/table-self-pay-relay-utils.test.ts > self-pay relays > a relay typed with capitals or without slashes reaches the sticker as itself`
- `packages/core/src/modules/table-self-pay/table-self-pay-address-utils.test.ts > table self-pay address > names the relays after the keys only when they are not the defaults`
- `packages/core/src/modules/table-self-pay/table-self-pay-sticker-utils.test.ts > checkTableSelfPaySticker > asks for a new sticker once the relays it names changed`
- `packages/core/src/background-jobs/jobs/table-self-pay-publishing-job.test.ts > table self-pay publishing job > publishes the view again to a relay the account switches on`
- `apps/web-app/e2e/self-pay-relays.spec.ts > the security card keeps the last active relay on`
- `apps/web-app/e2e/self-pay-relays.spec.ts > a table names the relays it publishes to and the guest reads only those`
