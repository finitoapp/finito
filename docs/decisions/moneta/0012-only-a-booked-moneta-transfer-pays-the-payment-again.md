# 0012 Only a booked MONETA transfer pays the payment again

Status: accepted
Date: 2026-11-13

## Context

moneta/0011 paid a payment on a pending (`PDNG`) transfer and keyed a
transfer by the last segment of its `entryReference`, on the working
assumption that a pending entry's reference is the `<id>` its booked form
ends with. On live transfers it is not: the pending and the booked entry of
one transfer share no identifier Payky can join them by, so the booked entry
was recorded a second time and paid the payment again, overpaying it
(payment/0007).

moneta/0011 was on edge only, never in a release, but edge syncs the same
accounts as production, so its rows are in their data: booked transfers
recorded under the last segment of their reference, and pending transfers
recorded under the pending reference.

## Decision

As in moneta/0003: an incoming transfer pays the payment whose variable
symbol, specific symbol and amount it matches once MONETA lists it as
booked. A pending entry, a reversal, an outgoing transfer, a transfer in
another currency than the account's, and any other status are never
recorded. A transfer is recorded under its whole `entryReference`.

A booked transfer already recorded under the last segment of its reference,
as moneta/0011 recorded it, counts as recorded and is not recorded again
under its whole reference; while no payment holds it, it is still offered to
the payments it matches.

## Alternatives considered

Reverting moneta/0011 outright, keying by the whole reference alone: a
booked transfer edge recorded under the last segment would be read again
within the sync window — the pointer's day (moneta/0004), the payment-wait
screen's — and recorded a second time, the very duplicate this undoes.

Pairing a pending entry with its booked form by amount, symbols and date:
not attempted until the bank is understood better; two equal transfers do
happen (payment/0007), and two devices sync without a lock (moneta/0010).

## Consequences

A transfer MONETA lists as pending for a while pays its payment only once
booked, hours later for a standard interbank transfer; the customer at the
counter may not wait for it. Finding a way to pay on the pending entry
safely is open.

A pending transfer edge recorded while moneta/0011 held stays recorded; when
the bank books it, the booked entry comes under another reference and is
recorded too. A payment both claim shows as overpaid, for staff to settle
(payment/0007); nothing removes those rows.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > records an incoming transfer and pays the payment its symbol and amount match`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a pending transfer pays nothing until the bank books it`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > skips outgoing, reversed, foreign-currency and scheduled entries`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > records a second equal transfer while the first is still listed`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a transfer recorded under the last segment of its reference is not recorded again, and still pays a payment`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isIncomingMonetaTransaction > is not anything else`
