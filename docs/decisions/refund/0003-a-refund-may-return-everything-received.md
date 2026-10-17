# 0003 A refund may return everything the payment received

Status: superseded by refund/0005
Date: 2026-09-29

## Context

A payment can receive more than its amount, through a second settlement or a
transfer larger than the payment.

## Decision

The refund limit adds what the payment's claims brought beyond its amount.
When there is such money, the refund dialog offers it first, as it is what
the business did not charge for. The payment detail, the payment history and
the bill's payment rows measure the refund state against the same limit.

## Alternatives considered

Keeping the limit at the payment amount, or the cash received, as before.
Money a payment received above it could not be returned through Payky, and
its extra money sale could never be reversed.

## Consequences

Returning only a duplicate shows the payment partly refunded while its real
sale stands. Returning everything leaves nothing reported in EET.

## Enforced by

- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > returns the excess of a payment settled twice as well`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > adds what the payment received beyond its amount`
- `packages/core/src/modules/refund/refund-utils.test.ts > summarizeRefundsByPayment > measures a returned duplicate against everything the payment received`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundPrefillAmount > prefills $prefill of $remaining left with $returnable of overpayment to return`
