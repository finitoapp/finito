# 0002 Items can be refunded only from a bill's only payment

Status: superseded by refund/0014
Date: 2026-09-29

## Context

Refunding chosen items needs to know which payment paid for which lines.
Only when one payment is claimed for a bill are all of the bill's lines its
own. With several payments, Payky cannot tell which payment paid which line.

## Decision

Staff can refund chosen items while no other payment of its bill has a
claim. Otherwise only an amount is offered. A tip is never part of an item
refund. Returning the rest of a line returns the rest of its amount, so
rounding leaves nothing behind.

## Alternatives considered

None recorded.

## Consequences

Bills paid by several payments are refunded by amount only, until payments
record which lines they paid. A claim whose transaction was deleted still
counts here, though the payment's status ignores it.

## Enforced by

- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > returns one of two beers and offers the rest`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > offers only an amount for a bill paid by two payments`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableLines > leaves out tips and what was already refunded`
- `packages/core/src/modules/refund/refund-utils.test.ts > calculateRefundLineAmount > returns the rest of the line without a rounding remainder`
