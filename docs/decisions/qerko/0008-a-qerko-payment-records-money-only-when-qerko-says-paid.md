# 0008 A Qerko payment records money only when Qerko says PAID

Status: accepted
Date: 2026-11-04

## Context

Qerko walks a Qerko payment through `paymentStart`, `paymentProcessed` (it
wants the receipt) and `paymentClosed` with a final state. Its states are
`STARTED`, `PROCESSING`, `AUTHORIZED`, `PAID` and `CANCELLED`, and the
reference SDK also knows `ERROR`. Qerko's API v4 does not return its fee.

## Decision

The money is recorded only when Qerko says `PAID`, from `paymentClosed` or
from `get-payment`, through `markPaymentPaid` with what the parts add up to.
Any other final state, one Qerko adds later included, is a failed payment.
`paymentProcessed` answers the receipt and records nothing. Qerko's fee is
not recorded, and neither is a tip, which the bill does not allow.

## Alternatives considered

Recording at `paymentProcessed`: Qerko can still cancel the payment after it.

## Consequences

`paymentClosed` carries only the state, so a `PAID` is read with
`get-payment` for what was charged and by whom. The money lands before the
attempt is closed, so a crash in between leaves a paid payment with a thinner
trail, not money taken that reads as unpaid.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > PAID records what Qerko charged, once, whoever reports it`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > %s is a failed payment, no money`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > marks the attempt processing and answers a receipt that adds up`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > Qerko payment states > %s is %s`
