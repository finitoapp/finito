# 0014 A canceled bill keeps no goods, so the money on it is its overpayment

Status: accepted
Date: 2026-11-08

## Context

A bill's overpayment is the money above the goods it keeps
(`payment/0013`), but a canceled bill had none at all. Before a bill holding
guest money is discarded, the app says the money stays on the canceled bill to
resolve (`table-self-pay/0022`), and a rejected order not paid in full is
discarded with its money on it (`menu-ordering/0009`). Nothing then offered to
resolve that money: the card showed nothing to answer, and the money stayed on
the bill unaccounted for.

## Decision

A canceled bill keeps no goods, so all the money its claimed transactions
brought is its overpayment. Staff answer it on the overpayment card like any
other: return it through a refund, record a tip the guest confirmed leaving,
or keep it for the business. A canceled bill reads no underpaid warning.

## Alternatives considered

- Telling staff to refund the payment instead. A refund is only one answer,
  and the money a guest paid for goods staff moved to another bill is the
  business's to keep.

## Consequences

A canceled bill that holds money reads overpaid in the bill history until
staff answer it. Staff who confirm a canceled bill closed despite the
cancellation (`docs/bill-payment-states.md`) turn its goods back on, so the
overpayment shrinks to the money above them, and an answer beyond that is
shown as not counted.

## Enforced by

- `packages/core/src/modules/bill/bill-overpayment.test.ts > The unresolved overpayment of a bill > Canceled bill keeps no goods, so all its money is unresolved`
- `packages/core/src/modules/overpayment-resolution/overpayment-resolution-actions.test.ts > Staff resolves an overpayment > Money a guest paid on a discarded bill`
- `apps/web-app/e2e/table-self-pay.spec.ts > the till > the guest money a discarded bill holds is answered on its overpayment card`
