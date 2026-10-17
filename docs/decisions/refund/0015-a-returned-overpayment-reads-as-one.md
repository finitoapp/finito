# 0015 A returned overpayment reads as one, not as a refund of goods

Status: accepted
Date: 2026-10-22

## Context

A refund records the part of it that returns the overpayment (refund/0014).
The payment's refunds and its badge in the histories still read every
refund as goods given back: returning a duplicate transfer showed the
payment "Partly refunded", as if the customer had sent goods back, and
staff opening "Return it" saw a general refund dialog that never said how
much was above the bill.

## Decision

A refund opened from "Return it" says how much is above the bill. An amount
above that warns that the excess is refunded as goods. The part of a refund
that returned the overpayment reads as "Returned overpayment" in the
payment's refunds and on its badge. A refund that also gave goods back
shows that part as a refund beside it.

## Alternatives considered

Keeping one "Partly refunded" badge and adding the overpayment to its
tooltip. A tooltip is not read on a phone, and the badge is what the
histories show.

## Consequences

A payment can carry two badges, one for the returned overpayment and one
for goods. What EET reports and what the refund records do not change.

## Enforced by

- `packages/core/src/modules/refund/refund-utils.test.ts > summarizeRefundsByPayment > reads what a return gave back of the overpayment apart from goods`
- `apps/web-app/e2e/activity-bills.spec.ts > returning an overpayment says how much is above the bill, warns about goods, and reads as a returned overpayment`
- `apps/web-app/e2e/eet.spec.ts > a payment settled twice reports the extra money, and refunding it reverses only that`
