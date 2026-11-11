# 0011 A pending MONETA transfer pays the payment

Status: accepted
Date: 2026-11-11

## Context

moneta/0003 recorded only booked (`BOOK`) transfers, because incoming
transfers seen until then were listed as booked the moment they arrived. On
2026-11-11 an instant transfer from another bank reached a live account as
pending (`PDNG`) and stayed pending for a long time, while the customer
waited at the counter and Payky did not pay the payment. The bank listed it
as:

```
"entryReference": "2610542566906527751", "status": "PDNG",
"creditDebitIndicator": "CRDT", "amount": {"currency": "CZK", "value": 1.00},
"bookingDate": {"date": null}, "valueDate": {"date": null},
"enteredDate": {"date": "2026-11-11"}, "reversalIndicator": false,
"references": {"clearingSystemReference": "BLOCKED_PAYMENT_ORDER_DOMESTIC", ...},
"creditorReferenceInformation": {"reference": "VS:1  SS:261111"}
```

A booked entry's `entryReference` is `<account>:<bookingDate>:<sequence>:<id>`;
the pending entry's reference looks like that last `<id>` alone. Booked
transfers recorded so far hold their whole reference as their bank
reference, and the account transaction's id derives from it.

## Decision

An incoming transfer pays the payment whose variable symbol, specific symbol
and amount it matches as soon as MONETA lists it, pending or booked, as if it
were final. A reversal (`reversalIndicator`), an outgoing transfer, a
transfer in another currency than the account's, a non-positive amount, an
entry without a reference and any other status are still never recorded.

A transfer is recorded under its key: the last `:`-separated segment of its
`entryReference`, or the whole reference when that segment is empty. Its
pending and its booked form therefore come under one key and are recorded
once. A transfer already recorded under its whole reference, before this
decision, counts as recorded and is not recorded again under its key; while
no payment holds it, it is still offered to the payments it matches.

A pending entry carries no `valueDate` or `bookingDate`; it is dated by its
`enteredDate`, else by the time of the sync.

That the `<id>` of a pending entry is the `<id>` of its booked form is a
working assumption, not yet seen on a live transfer going from pending to
booked.

## Alternatives considered

Keeping booked-only (moneta/0003): the customer waits until the bank books
the transfer, which for this kind of transfer took far longer than anyone
stands at a counter.

Pairing the booked entry with the pending one by amount and symbols, with a
table of pending transfers: two devices sync on their own without a lock
(moneta/0010), so which pending row a booked entry pairs with would depend
on timing, and two equal transfers — which do happen (payment/0007) — could
not be told apart.

## Consequences

A payment can show as paid before the bank has finalised the money. A
pending transfer the bank later rejects or that disappears leaves the
payment paid and its account transaction recorded; noticing that is a
follow-up, not done yet.

If the assumption is wrong and a booked entry comes under another `<id>`
than its pending form, the booked entry is recorded a second time and, by
payment/0007 (formerly moneta/0005), overpays the payment it matches; staff
see it as overpaid. The key is then the thing to revisit.

Every device has to run this version: a device still on moneta/0003 records
the booked form under its whole reference, a second row beside the one an
updated device recorded under the key.

## Enforced by

- `packages/core/src/integrations/moneta/moneta-client.test.ts > fetchMonetaTransactions > keys a transfer by the last segment of its entry reference and keeps the whole reference`
- `packages/core/src/integrations/moneta/moneta-client.test.ts > fetchMonetaTransactions > dates a pending transfer without a value or booking date by the day the bank entered it`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isIncomingMonetaTransaction > is a booked or pending incoming transfer in the account's currency`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isIncomingMonetaTransaction > is not anything else`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > records an incoming transfer and pays the payment its symbol and amount match`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a pending transfer pays the payment its symbol and amount match`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a pending transfer the bank books later records nothing new and does not overpay`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a transfer listed both pending and booked in one window is recorded once`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a transfer recorded under its whole reference before is not recorded again under its key, and still pays a payment`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > two pending transfers with the same amount and symbols are both recorded, the second overpaying the payment`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > skips outgoing, reversed, foreign-currency and scheduled entries`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > records a second equal transfer while the first is still listed`
