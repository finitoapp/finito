# 0007 A second bank transfer for a paid payment overpays it

Status: accepted
Date: 2026-11-01

## Context

moneta/0005 let a MONETA transfer claim a payment that is already paid when
no unpaid payment matches, so a customer who sends one payment's transfer
twice overpays it however the syncs interleave. Fio's transfers went through
the same IBAN matcher with the old rule: the second transfer stayed
unclaimed as stray income when one sync recorded both, and claimed the
payment anyway when two devices each recorded one before their claims
merged. One rule for MONETA and another for Fio also kept an option in the
shared matcher that only one bank turned on.

## Decision

Every incoming bank transfer whose symbols and amount match only payments
that are already paid claims one of them, so the payment shows as overpaid
(the duplicate settlement in `docs/bill-payment-states.md`). The matcher
still takes an unpaid payment first, then a live one before a canceled one
(payment/0004), then the lowest id: where it used to find a payment, it
finds the same one. The rule holds for a transfer as it is recorded and for
one recorded earlier and re-checked, whichever bank it came from.

## Alternatives considered

Keeping the rule for MONETA only, which leaves Fio's outcome to timing and
the matcher with a bank-specific option. Leaving the second transfer
unclaimed for every bank, which needs a rule that settles two claims made
at once after they merge, and hides money the customer sent twice in the
income list.

## Consequences

Paying twice is surfaced to staff as an overpaid payment, resolved as
payment/0013 says. A Fio transfer recorded
before this change without a claim, because its payment was already paid,
claims that payment the next time a sync re-checks it, while it is still in
the window the sync reads.

## Enforced by

- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a second FIO transfer quoting a paid payment's symbols claims it as overpaid`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a second transfer quoting a paid payment's symbols claims it as overpaid`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a transfer synced after its payment was paid claims it as overpaid`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > two transfers recorded before their payment existed both claim it`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > a second transfer pays another unpaid payment with the same symbols before overpaying the first`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > two syncs at once of two transfers both claim the payment, as one sync does`
