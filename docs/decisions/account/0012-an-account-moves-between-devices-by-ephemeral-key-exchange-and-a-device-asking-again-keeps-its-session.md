# 0012 An account moves between devices by ephemeral key exchange, and a device asking again keeps its session

Status: accepted
Date: 2026-11-28

## Context

account/0001 moved an account by a QR, a Nostr relay and a code typed into
the source, and ended the session as a conflict whenever a second valid
`hello` arrived before the code was confirmed. It also ended either side on
the first relay hiccup: a `hello` whose publish no relay confirmed within
six seconds, or a subscription every relay dropped (a phone that slept, a
network that changed).

Together they raised the conflict with one device in hand. The phone's
`hello` reached the source, which locked onto it, but the phone's session
then ended on its own side, unseen by the source; the QR was still up, the
user scanned it again, and the new session's fresh key was a second device
to the source. The user was told someone may have seen their screen when
nobody had. Sources running a release from before this record keep that
rule, so the fix had to work from the phone's side alone as far as it can.

## Decision

The source shows a `payky:pair` QR carrying only an ephemeral Nostr public
key, a 16-byte session secret `s` and the relays it listens on — never the
account secret. The target answers with a `hello` whose proof is an HMAC
keyed with `s`, so a relay that never saw the QR cannot answer for it and
cannot grind a key pair whose code matches.

The source locks onto the first device with a valid `hello` and sends it
`ready`. The target shows its six-digit code, `HMAC(s, pkSource, pkTarget)`,
only after a `ready` signed by the QR's key and addressed to itself, so not
even someone who saw the QR and controls the relay can make the phone show a
code for a session locked onto them. The user types that code into the
source; three mismatches end the session.

The QR stays visible until the code is confirmed. A second device with a
valid `hello` before then aborts the session on both sides as a conflict,
so a raced session cannot quietly succeed. One device per session.

A session survives the relays instead of ending on their first fault, and
never changes its key to do so:

- The target repeats its `hello` under the same key every five seconds
  until `ready`. A source that has locked onto that key answers a repeat
  with `ready` again; a source from before this record ignores it, so it
  never reads as a second device. Only relays that refused every `hello`
  so far — three in a row — end the target as a network failure, and with
  no `ready` the target gives up after the QR's lifetime.
- Either side that loses its subscription subscribes again under the same
  key, and ends as a network failure only after five drops in a row with
  nothing heard in between.
- The source repeats the payload every five seconds until the target's
  `ack`, within the existing wait for it; the target reads the first one.

The device that scans again anyway — after it cancelled, left the screen or
gave up — gets a new key. Its `hello` carries the device id (access/0013),
and when it is the id the locked `hello` carried, the source moves the lock
to the new key instead of ending the session: it aborts the old key, sends
`ready` to the new one, and gives the code a fresh two minutes but not a
fresh set of attempts. A `hello` with another id, or a lock or a `hello`
without one, is a conflict as before.

The account (master key, name, active transports in stored form) then goes
NIP-44-encrypted between the two ephemeral keys in an ephemeral-kind event
(`PAYKY_PAIR_KIND`) with a NIP-40 expiration. Ephemeral keys and `s` live in
memory only, for one session. A device that already has an account
confirms, naming the account, before a transferred one is added and made
active.

## Alternatives considered

- A QR carrying the encrypted secret, unlocked by a PIN: a photo of it can be
  brute-forced offline.
- Showing a code on both devices and asking "do they match? [Yes]": a click
  proves nothing about looking.
- Passkeys / WebAuthn PRF: patchy in Android WebView and ties the account to
  a platform account.
- A SAS commitment round (the target commits to a nonce in `hello` and
  reveals it after the source's): closes the same grind as `ready`, but
  costs an extra round trip and two more message types, while `ready` is
  one empty message because the QR already authenticates the source.
- Showing the code on the target without `ready` once the target had sent a
  `hello`, so a lost `ready` costs nothing even against an old source:
  whoever knows `s` and sits on the relay computes the phone's code, grinds
  a key with the same code in a moment and locks the source onto it, and
  the user types the phone's code into a session locked onto them. `ready`
  is what stops that.
- Keeping the target's key after its session ended, so a scan of the same
  QR reuses it: keys would outlive their session, and leaving the screen
  would still lose it. Moving the lock by device id covers both.
- Letting any second device take the lock over: a raced session could then
  quietly succeed, which the conflict exists to prevent.

## Consequences

- Social engineering stays a residual risk: a user who reads their code to
  someone, or forwards a photo of the QR, can hand the account over. The copy
  warns against both, and neither side offers *Copy* or *Paste* for the URI.
- Moving the lock rests on the device id staying unknown to whoever saw the
  QR: it travels only encrypted to the source's key and lives in the
  device's own database. A stranger who had it would only move the lock off
  the user's phone, which then shows no code to type, so the account still
  goes nowhere unless the user types the stranger's code.
- Against a source from before this record, what the phone does alone
  recovers — a lost `hello`, a refused publish, a dropped subscription —
  but what only the source could send again does not: a `ready` lost while
  the phone could not hear the relays leaves it waiting out the QR's
  lifetime and asking for a new scan, which that source still takes for a
  conflict, and a payload lost the same way ends as that source always
  ended it.
- A phone that lost the relays waits longer before saying so — up to about
  half a minute — rather than failing in six seconds and inviting the scan
  that caused the conflict.
- A QR naming a hostile relay learns the target's IP address and the time of
  the attempt, nothing else.
- Starting a transfer, like reading the recovery phrase, needs `admin`
  once access control is on (access/0002); without it, anyone at the
  source device can.
- Sessions need a reachable Nostr relay; with none, the transfer fails and
  the recovery phrase remains the way in.

## Enforced by

- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > transfers exactly the payload to the device whose code was typed`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > three wrong codes abort without a payload`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > the target shows no code before ready`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > a second device with a valid hello aborts both as conflict`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > a hello with a wrong proof neither locks nor conflicts`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > a relay that swaps the hello for its own, without s, gets nothing`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > a relay that knows s and swaps the hello locks the source onto itself, and the phone shows no code`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > the target ignores ready and payload not signed by the QR's key`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > the source ignores ack and abort from anyone but the locked device`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > account transfer session > after the QR expires the source stops listening`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > transfer code > depends on the session secret and on which key is the source`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > scanning again under a new key moves the lock to it instead of a conflict`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a new lock keeps the attempts left and refuses the old code`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a second hello with %s after one with an id is still a conflict`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > two hellos without an id are still a conflict, even from one device`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > the target repeats a lost hello under the same key`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a lost ready is sent again when the target repeats its hello`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a dropped subscription is opened again under the same key, and the transfer goes on`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > relays that stay unreachable end both sides as network`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a target whose every hello is refused ends as network`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a refused hello after an accepted one does not end the target`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > without ready the target gives up once the QR is past its lifetime`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > a device that loses its connection or scans again > a lost payload is sent again until the target acks it`
