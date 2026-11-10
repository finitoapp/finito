# 0004 The merchant device signs what guests read

Status: accepted
Date: 2026-10-14

## Context

Guests read the table's view from public relays, which anyone can post to
and any operator can tamper with (`table-self-pay/0020`). A guest must
still see the merchant's bill and nothing else, and the relays must learn
nothing about the bill.

## Decision

The merchant device publishes each table's view as one replaceable nostr
event signed by the table's key and encrypted under the table's view key.
Both keys travel in the URL fragment of the sticker's QR
(`createTableSelfPayAddress`), which the browser never sends to a
server. The guest asks relays only for events the table's key signed
(`createSelfPayViewFilter`) and never replaces a view with an older
one (`keepNewerSelfPayContent`). The view is padded to a power of
two of at least 1,024 bytes (`MIN_PADDED_LENGTH`) and carries
nothing about staff, devices or notes. Five relays carry it by default
(`nostr-default-relays.ts`, `table-self-pay/0015`), and which relays is
the merchant's choice (`table-self-pay/0003`).

## Alternatives considered

None recorded.

## Consequences

The size of a view tells a relay only a coarse bucket.

Revisit when public relays rate-limit or drop one replaceable event per
table plus a liveness event every 5 minutes. The fix is our own relays with
a write policy that accepts only the Payky table format. The events verify
themselves, so a merchant can switch to them without anything else
changing.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > loading the view > asks relays for views the table's key signed, with nothing that reads them`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > loading the view > ignores a view signed by any other key`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > loading the view > finds the table's view under a relay full of junk for its address`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > loading the view > ignores a tampered event`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > loading the view > never replaces a view it has shown with an older one`
- `packages/core/src/modules/table-self-pay/table-self-pay-address-utils.test.ts > table self-pay address > keeps the keys in the fragment, which never reaches a server`
- `packages/core/src/modules/table-self-pay/table-self-pay-view-utils.test.ts > self-pay content encryption > pads to a power of two from 1 KiB so sizes do not leak content`
- `packages/core/src/modules/table-self-pay/table-self-pay-view-utils.test.ts > self-pay view event > carries the view under a tag relays cannot tie to a table`
- `packages/core/src/modules/table-self-pay/table-self-pay-view.test.ts > table self-pay view > carries nothing about staff, devices or notes`
- `apps/web-app/src/core/app-env.test.ts > appEnv > publishes table self-pay to several relays by default`
