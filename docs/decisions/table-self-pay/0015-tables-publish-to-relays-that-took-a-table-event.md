# 0015 Tables publish to relays that took a table event

Status: accepted
Date: 2026-10-17

## Context

A table's view reaches guests only through relays that store a kind 30078
event from a key they have never seen. Payky reads nostr profiles from
Linky's relays (`VITE_PAYKY_NOSTR_RELAYS`), and Payky runs cache relays of
its own at `nostr1`, `nostr2` and `nostr3.agora.gripe`.

On 2026-10-17 a fresh table key published a view, its liveness and a newer
view to each of those relays and read them back:

- `nostr1`, `nostr2` and `nostr3.agora.gripe`, `nos.lol` and
  `nostr.linky.fit` returned the newer view and the liveness.
- `relay.damus.io` refused every kind 30078 event from the fresh key with
  `error: internal error`, with or without an `expiration` tag.
- `relay.0xchat.com` no longer resolves.

The agora relays run in one cluster, keep events for 7 days, fewer when
full, and limit how many events one address writes a minute.

## Decision

Tables publish by default to `wss://nos.lol`, `wss://nostr.linky.fit`,
`wss://nostr1.agora.gripe`, `wss://nostr2.agora.gripe` and
`wss://nostr3.agora.gripe` (`nostr-default-relays.ts`). A relay becomes a
default only after it stored and returned a table's view and liveness
published from a fresh key.

## Alternatives considered

Only the agora relays. One outage of their cluster would stop every table.
A view is published again only when it changes or the app restarts, so a
table left unchanged for 7 days would drop off them. Every device of a
restaurant publishes each table from the same address, so the devices
together run into the per-address limit.

Linky's relays. Two of the four do not carry table events.

## Consequences

The two public relays keep a table readable while the agora relays are
down, full, rate-limiting a restaurant or past their retention.

A sticker on the defaults names no relays, and its guest page reads the
defaults of its own build. A change of the defaults reaches the guest page
and the merchant apps at different times, so it keeps at least one relay in
both lists until every merchant app has updated.

## Enforced by

Untestable: whether a relay accepts a table event is the relay's own write
policy, which only a publish to the live relay shows, and a test must not
write to public relays.
