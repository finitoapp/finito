# 0014 A refund records what it returns of the overpayment, and its prefill follows it

Status: accepted
Date: 2026-10-17

## Context

refund/0005 lets a refund return everything a payment received but its tip,
and prefilled the extra money its claims brought beyond its amount without
subtracting what was already returned. An overpayment is answered by a
return, a tip or a kept amount (see payment/0013), and the same amount of
money back can be a return of the overpayment or a goodwill refund of
goods. Only staff knows which, and only when the refund is made.

## Decision

The limit of a refund by amount or by items is what the payment received:
the cash received for a cash payment with a received amount, its amount
otherwise, plus what its claims brought beyond its amount, less its tip and
every earlier refund but a tip refund. While the payment can return some of
the bill's overpayment (the bill has an unresolved overpayment, or is
underpaid and the payment's claims brought more than its amount), the
refund screen (refund/0010) offers the overpayment as a choice of its own
beside the whole payment, a part and the tip, and starts on it; it is
returned by amount. A part is a refund of goods. A payment without a bill counts as its own bill. The refund
records at write time the part of it that returns the overpayment and the
transactions its device knew. A return records up to what its device showed,
or while the bill is underpaid, the payment's extra money less what its
earlier refunds already returned of the overpayment. A refund of goods
records the part that would take the goods refunded above the bill total. A
refund by items records the value of lines the bill no longer holds. Any
refund also records the part that leaves its payment holding less than the
tips, kept amounts and acknowledgements counted on it. The overpayment
is prefilled with what the payment can return of the bill's unresolved
overpayment, or while the bill is underpaid, with that extra money less what
earlier refunds already returned of the overpayment, and a part with the
amount not yet refunded, each capped at the amount not yet refunded. This supersedes refund/0005.

## Alternatives considered

Keeping the prefill of refund/0005. It offered extra money that was already
returned again. Deriving whether a refund returned the overpayment from its
amount afterwards. A goodwill refund then ate a tip, and a later goodwill
refund shrank an earlier one.

## Consequences

A refund from an app version without this rule records no part and is read
as a return of what the claims and answers recorded up to it showed. So do a
refund of the whole payment (refund/0010) and a refund to the card
(refund/0007, qerko/0004), which record no part either. The
answer to the question is final, like the refund. Returning only a duplicate
leaves the payment's real sale standing, and refund/0015 decides how that
return reads.

## Enforced by

- `packages/app-shared/src/refund-form.test.ts > deriveRefundOptions > offers the overpayment first and starts on it while the payment can return some (refund/0014)`
- `packages/core/src/modules/refund/refund-actions.test.ts > Staff can refund a paid payment > Payment settled twice`
- `packages/core/src/modules/refund/refund-actions.test.ts > Staff can refund a paid payment > Payment with a tip`
- `packages/core/src/modules/refund/refund-actions.test.ts > Staff can refund a paid payment > Payment of a bill lowered after it was paid`
- `packages/core/src/modules/refund/refund-actions.test.ts > Staff can refund a paid payment > Extra money on a bill still underpaid`
- `packages/core/src/modules/refund/refund-actions.test.ts > Staff can refund a paid payment > Refund with nothing above the goods`
- `packages/core/src/modules/refund/refund-actions.test.ts > a refund records what it returns of the overpayment > records the return, its overpayment part and the transactions it knew`
- `packages/core/src/modules/refund/refund-actions.test.ts > a refund records what it returns of the overpayment > returns the value of refunded lines the bill no longer holds`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > returns the excess of a payment settled twice as well`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > leave the tip out of a refund by amount`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > leave the tip out of the cash received`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > is the cash received when there is one`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > adds what the payment received beyond its amount`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableAmount > leaves the tip out`
- `packages/core/src/modules/refund/refund-utils.test.ts > summarizeRefundsByPayment > measures a returned duplicate against everything the payment received`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundPrefillAmount > prefills $prefill of $remaining left with $returnable of overpayment to return`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > Goodwill refund on an overpaid bill`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > Refund recorded before the change`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > Item refunded that the bill no longer holds`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals of extra money > returning everything reverses the sale and the extra money`
- `apps/web-app/e2e/activity-bills.spec.ts > a goodwill refund on an overpaid bill leaves the overpayment for the tip`
- `apps/web-app/e2e/eet.spec.ts > a payment settled twice reports the extra money, and refunding it reverses only that`
