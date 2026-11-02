# 0005 A second MONETA transfer for a paid payment overpays it

Status: accepted
Date: 2026-11-01

## Context

A customer can send a payment's transfer twice, both quoting its symbols
and amount; a live MONETA account showed two such transfers on one day.
The IBAN matcher skipped a payment that already had a claim, so the second
transfer stayed unclaimed — but only when one sync recorded both, one after
the other. The background job and the payment-wait screen sync without a
lock (moneta/0002), and two syncs recording one transfer each at the same
moment both found the payment unpaid and both claimed it. The same
transfers ended either as a paid payment with stray income or as an
overpaid one, depending on timing.

Payky already models a payment claimed for more than its amount: the
duplicate settlement in `docs/bill-payment-states.md`, which counts every
claimed transaction toward the bill and which staff resolve with
`acknowledgePaymentExcessSettlement`.

## Decision

A MONETA transfer whose symbols and amount match only payments that are
already paid claims one of them anyway, so the payment shows as overpaid.
The matcher still takes an unpaid payment first, then a live one before a
canceled one (payment/0004), then the lowest id: where it used to find a
payment, it finds the same one. The rule holds for a transfer as it is
recorded and for one recorded earlier and re-checked.

## Alternatives considered

A lock around the sync, which keeps the old outcome on one device but not
across the merchant's devices, each of which runs the job; the outcome would
still depend on timing. Leaving the second transfer unclaimed everywhere,
which needs a rule that settles two claims made at once after they merge,
and hides money the customer sent twice in the income list.

## Consequences

Paying twice is surfaced to staff as an overpaid payment, whichever way the
transfers were synced. Fio's matcher still skips a paid payment until it
adopts the same rule.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a second transfer quoting a paid payment's symbols claims it as overpaid`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a transfer synced after its payment was paid claims it as overpaid`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > two transfers recorded before their payment existed both claim it`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a second transfer pays another unpaid payment with the same symbols before overpaying the first`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > two syncs at once of two transfers both claim the payment, as one sync does`
