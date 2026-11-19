# 0004 Every message keeps the account's DM relay list where support's clients look

Status: accepted
Date: 2026-11-19

## Context

After the team behind Finito's API changed on 2026-11-18, support could not
reply to a message from the native app: Amethyst showed "DM inbox relays not
found. Messages cannot be delivered until they configure their relay list."
It shows that for a member of the room whose kind 10050 its own cache does
not hold. It fills that cache from the user's NIP-65 write relays when it
knows a kind 10002 of theirs, and otherwise from its indexers
(`purplepag.es`, `indexer.coracle.social`, `profiles.nostr1.com`, ...) and
the relays it has seen the user on. The support members' own lists were in
place, so the list missing was the account's.

support/0001 publishes a list only alongside the first message of an
account found to have none. Both apps decided that from the inbox check as
it stood when the message went out, and enabled the composer as soon as the
team loaded, while the check still asks every relay for up to six seconds.
A first message sent before it finished published nothing, and nothing
tried again until the next message. A list the check found on some relay,
the app's own for one, counted as in place even when the indexers and the
support relays, where Amethyst looks, did not hold it.

## Decision

Every message to support makes sure the account's DM relay list can be
found where support's clients look: on the support relays and on the
team's indexers. The message waits for the inbox check when it is still
running rather than deciding without it. An account found to have no list
gets one, as support/0001 has it. A found list is copied, exactly as the
account signed it, to those of the support relays and indexers that
answered the check without it; one held everywhere is sent nowhere. The
copy is the same replaceable event, so the list stays whoever's it is,
Linky's included, and copying it again changes nothing. An unverified inbox
is still left to the chat's warning.

The chat goes on reading from the support relays and the relays the list
names, which are the relays a reply is delivered to.

## Alternatives considered

Publishing a kind 10002 for the account, so clients find the 10050 on its
outbox relays, which was rejected: it tells every client where the
account's notes and mentions live, Linky publishes its own, and an account
without one is looked up on the indexers, where the list now is.

Publishing or copying the list when the chat opens, which was rejected to
keep support/0001's rule that nothing is published for an account that
only looks at the chat.

Disabling the composer until the inbox check finished, which was rejected:
a dead relay holds it for up to six seconds, and the message does not need
the check, only the list does.

## Consequences

A message from an account whose list is held everywhere publishes nothing
more. One whose list some indexer lacks sends the same event there once,
and once more after a later check if the indexer dropped it. An account
that wrote before this change and got no list gets one with its next
message. A client that looks only on relays outside the support relays and
the team's indexers may still not find a list the app published; the team
chooses the indexers in `PAYKY_SUPPORT_INDEXER_RELAYS`.

## Enforced by

- `packages/core/src/integrations/nostr/nostr-support-chat.test.ts > support chat > publishes DM relays with a message for an account found to have none`
- `packages/core/src/integrations/nostr/nostr-support-chat.test.ts > support chat > copies the account's own DM relays unchanged to where clients look and they lack them`
- `packages/core/src/integrations/nostr/nostr-support-chat.test.ts > support chat > publishes nothing for DM relays found everywhere or left unverified`
- `packages/core/src/integrations/nostr/nostr-support-chat.test.ts > support chat > names the team's relays and indexers that answered without the account's newest DM relays`
