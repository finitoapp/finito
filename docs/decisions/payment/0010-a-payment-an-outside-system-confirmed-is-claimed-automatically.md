# 0010 A payment an outside system confirmed is claimed automatically

Status: accepted
Date: 2026-11-09

## Context

Every claim and account transaction says who recorded it: `manual` or
`auto`. The sync jobs (FIO, MONETA, Spark, Cashu) write `auto`. Cash, a
transfer checked by hand, and also a card payment the SwitchioPay or Qerko
terminal approved and a payment Qerko reported paid all went through one
function that wrote `manual`, so the payment detail labelled a card payment
"by hand" although no one confirmed anything.

## Decision

A payment staff confirm — cash taken, a transfer checked by hand — is
claimed `manual`. A payment the app's own logic records on an outside
system's answer — the SwitchioPay terminal or the Qerko terminal approving
the card, Qerko reporting a Qerko payment paid — is claimed `auto`, like the
sync jobs' claims, although no sync job wrote it. `markPaymentPaid` takes the
source from each caller rather than assuming one.

## Alternatives considered

A third source, `terminal`, which an older app on another device of the
account would not read. Changing only the label by the account's kind,
which keeps a stored value that says the opposite of what happened.

## Consequences

Card and Qerko payments recorded before stay `manual`; they are not
migrated. The recording device for EET is the claim's `deviceId` whatever
its source, so a terminal-approved payment is still reported by the phone
that took the card. The sales statistics' "transfer confirmed by hand"
signal reads `manual` claims of transfers only, so it does not change.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > records a card payment the terminal approved as automatic, not by hand`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > marks a payment paid in cash by creating a cash account transaction`
- `packages/core/src/modules/payment/payment-qerko-actions.test.ts > qerko terminal payment > an approved payment settles what the card was charged, a terminal tip included`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > PAID records what Qerko charged, once, whoever reports it`
