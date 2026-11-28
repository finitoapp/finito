# 0001 An account moves between devices by ephemeral key exchange

Status: superseded by account/0012
Date: 2026-10-07

## Context

Opening an existing account on a second device meant typing its 20-word
recovery phrase. The device that has the account is often a PC without a
camera, the new one a phone. Whoever ends up with the account's master key
holds its data and the money in its Bitcoin wallet, so the transfer has to
survive a photographed screen, a relay that reads or rewrites traffic, and
a user being talked into helping an attacker.

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

The account (master key, name, active transports in stored form) then goes
NIP-44-encrypted between the two ephemeral keys in an ephemeral-kind event
(`PAYKY_PAIR_KIND`) with a NIP-40 expiration. Ephemeral keys and `s` live in
memory only. A device that already has an account confirms, naming the
account, before a transferred one is added and made active.

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

## Consequences

- Social engineering stays a residual risk: a user who reads their code to
  someone, or forwards a photo of the QR, can hand the account over. The copy
  warns against both, and neither side offers *Copy* or *Paste* for the URI.
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
