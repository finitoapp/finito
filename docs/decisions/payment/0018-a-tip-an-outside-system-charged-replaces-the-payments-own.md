# 0018 A tip an outside system charged replaces the payment's own

Status: accepted
Date: 2026-11-11

## Context

A payment's `amount` and `tipAmount` are fixed when it is created, and until
now nothing but the CLI's `updatePayment` changed them: money that arrives
above the amount reads as an overpayment (`payment/0007`, `qerko/0002`), and
everything downstream reads the payment's amount and tip as the truth — its
bill's coverage, which takes the tip off the money once per payment, the EET
sale and its extra money (`eet/0005`, `eet/0012`), a refund of the goods and
the tip apart, the statistics and the history.

A Qerko payment is offered without its tip, and the customer chooses one in
Qerko (`qerko/0015`). What Qerko charges is the goods and that tip, which
rarely is the tip the payment was created with.

## Decision

`markPaymentPaid` takes an optional `chargedTipAmount`: the tip an outside
system charged on top of the payment's goods, its amount less its tip. When
it is given and differs from the payment's `tipAmount`, the payment's
`tipAmount` becomes it and its `amount` the goods plus it, in the same batch
as the money and its claim. The goods never change. The bill's closing is
judged on the payment as rewritten, so a bill the goods pay off closes as
paid, neither over- nor underpaid. Only a caller whose outside system says
both the goods and the tip it charged passes it; today that is a Qerko
payment whose parts are exactly its goods and Qerko's tip.

## Alternatives considered

- Recording the outside tip apart from the payment, in a row of its own:
  every reader of the payment's tip — coverage, EET, refunds, statistics —
  would have to learn a second source.
- Rewriting the payment in a batch of its own before or after the money: a
  crash in between leaves a paid payment with the wrong tip, or one whose
  tip changed with no money to show for it, and a device that synced half
  would read the bill as over- or underpaid.

## Consequences

`docs/bill-payment-states.md` no longer holds that a payment's amount never
changes: a paid payment's amount can be what was charged. A payment's tip
read before it was paid may differ from its tip once paid. A card terminal's
tip still reads as an overpayment (`qerko/0002`); passing it as
`chargedTipAmount` would be a decision of its own.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a charged tip replaces the payment's own in the batch that records the money, and its bill closes paid: %s`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a charged tip equal to the payment's own leaves the payment as it is`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > takes the customer's Qerko tip in place of the payment's own and closes its bill as paid: %s`
