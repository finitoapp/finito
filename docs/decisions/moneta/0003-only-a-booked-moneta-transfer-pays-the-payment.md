# 0003 Only a booked MONETA transfer pays the payment

Status: accepted
Date: 2026-11-01

## Context

MONETA lists an entry as pending (`PDNG`) before it books it (`BOOK`). A
pending entry can still change or disappear, and its `entryReference`
carries the booking date (`<account>:<bookingDate>:<sequence>:<id>`), so the
booked entry may come under another reference than the pending one did.

On a live account, incoming transfers from another bank — an instant one
and two sent as standard, which the sending bank delivered as instant —
were listed as `BOOK` the moment they arrived, on a Sunday, with the next
working day as their `bookingDate`. A customer at the counter waits for
nothing a pending entry would give them.

## Decision

An incoming transfer pays the payment whose variable symbol, specific symbol
and amount it matches once MONETA lists it as booked. A pending entry, a
reversal (`reversalIndicator`), an outgoing transfer, a transfer in another
currency than the account's, and any other status are never recorded.

## Alternatives considered

Paying on `PDNG`, as Linky does. Linky keeps no transactions, so it never
meets the pending entry again. Payky records each transfer by its
`entryReference`, and a pending entry booked under another reference would
be recorded twice; telling the two apart takes a table of pending transfers
and matching on amount and symbols, guarding against a bank behaviour that
was never seen on incoming transfers.

## Consequences

Every recorded transfer is final, so the bank reference alone keeps it from
being recorded twice, as with Fio. Money that is only pending never pays a
payment, so nothing needs undoing when such an entry disappears.

A transfer MONETA does list as pending for a while — a standard interbank
transfer the sending bank does not deliver as instant — pays its payment
only once booked, hours later; the background job picks it up then.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > records an incoming transfer and pays the payment its symbol and amount match`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a pending transfer pays nothing until the bank books it`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > skips outgoing, reversed, foreign-currency and scheduled entries`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > records a second equal transfer while the first is still listed`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isIncomingMonetaTransaction > is not anything else`
