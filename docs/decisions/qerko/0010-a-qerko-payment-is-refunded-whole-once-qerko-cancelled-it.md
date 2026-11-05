# 0010 A Qerko payment is refunded whole, once Qerko cancelled it

Status: accepted
Date: 2026-11-04

## Context

Qerko refunds a Qerko payment by cancelling it (`cancel-payment`), which
always returns all of it; Qerko confirmed there is no partial refund. Any
device of the account may refund, not only the one holding the websocket.

## Decision

The refund is the whole payment or nothing. It is refused before Qerko is
asked when nothing was paid through Qerko, or when part of the payment is
refunded already another way. It is recorded only once Qerko's answer says
`CANCELLED`, as its goods and, apart as every tip refund is, its tip, with the
money leaving the Qerko account. The ids derive from Qerko's payment id, so
two devices refunding at once record it once.

## Alternatives considered

Offering the refund dialog's amount field: Qerko would return more than staff
typed.

## Consequences

The refund dialog does not offer the method; a Qerko payment has a button of
its own that names the whole amount.

## Enforced by

- `packages/core/src/modules/refund/refund-qerko-payment-actions.test.ts > refundQerkoPayment > refunds all of the payment once Qerko cancelled it`
- `packages/core/src/modules/refund/refund-qerko-payment-actions.test.ts > refundQerkoPayment > records nothing unless Qerko says CANCELLED`
- `packages/core/src/modules/refund/refund-qerko-payment-actions.test.ts > refundQerkoPayment > a second refund asks Qerko no more and records nothing twice`
- `packages/core/src/modules/refund/refund-qerko-payment-actions.test.ts > refundQerkoPayment > is refused once part of the payment is refunded another way`
