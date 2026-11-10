# 0005 A refund of goods may return everything the payment received but its tip

Status: superseded by refund/0014
Date: 2026-10-01

## Context

A payment can receive more than its amount, through a second settlement or a
transfer larger than the payment. Its tip is refunded on its own (see
refund/0004).

## Decision

The limit of a refund by amount or by items is what the payment received:
the cash received for a cash payment with a received amount, its amount
otherwise, plus what its claims brought beyond its amount, less its tip and
every earlier refund of goods. When there is such extra money, the refund
dialog prefills it, capped at what is left, as it is what the business did
not charge for. The payment detail, the payment history and the bill's
payment rows measure the refund state against the same limit.

## Alternatives considered

Keeping the limit at the payment amount, or the cash received, as before
refund/0003. Money a payment received above it could not be returned through
Payky, and its extra money sale could never be reversed.

## Consequences

Returning only a duplicate shows the payment partly refunded while its real
sale stands. Returning the goods and the tip leaves nothing reported in EET,
apart from the known gaps `docs/eet.md` lists. The prefill does not subtract
extra money already returned, so it offers it again, capped at what is left.

## Enforced by

- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > returns the excess of a payment settled twice as well`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > leave the tip out of a refund by amount`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > leave the tip out of the cash received`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > is the cash received when there is one`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > adds what the payment received beyond its amount`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > leaves the tip out`
- `packages/core/src/modules/refund/refund-utils.test.ts > summarizeRefundsByPayment > measures a returned duplicate against everything the payment received`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundPrefillAmount > prefills $prefill of $remaining left with $returnable of overpayment to return`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals of extra money > returning everything reverses the sale and the extra money`
- `apps/web-app/e2e/eet.spec.ts > a payment settled twice reports the extra money, and refunding it reverses only that`
