# 0013 An overpayment is returned, tipped or kept, counted against the transactions that brought it

Status: accepted
Date: 2026-10-17

## Context

Money above a bill's goods arrives as a second settlement, a transfer larger
than its payment, a guest's self-pay share after staff removed the lines, or
a bill lowered after it was paid. A refund is not a state, so the overpaid
warning outlived the refund that answered it, and acknowledging a payment's
extra money silenced the warning without saying whether the money went back,
to the staff or to the business. Devices record offline and sync in any
order. An exempt tip must be voluntary (GFŘ seminar for developers, slide
66). Lines removed after a guest paid closed a bill with no undo (IAM-231).

## Decision

A bill's overpayment is the money its claimed transactions brought above
the goods it keeps, and a payment without a bill counts as its own bill.
Staff answers it by returning it through a refund (see refund/0014), by
recording a tip the guest confirmed leaving, or by keeping it for the
business. A tip or kept amount is never edited, only withdrawn, and a
withdrawal is final. The money above the total is attributed to the claimed
transactions. Each answer draws only from transactions its device knew that
are still there, its own payment's first, then the newest. Returns draw
first, then tips, kept amounts and acknowledgements in recording order, each
capped by what its payment holds less the earlier ones on it, and all of
them together by the money the bill still holds above the goods. Records are
ordered by the sync clock of their first write. What no answer covers is the
unresolved overpayment, and only while it is above zero does the bill read
overpaid. An acknowledgement made before counts as kept, and staff can no
longer make one. Tips from an overpayment count in the tips of the day they
were recorded. Before an edit or split that would leave the bill covered,
the app asks, and a split that would leave its source overpaid is refused.

## Alternatives considered

One known-money number per answer. A deleted transaction followed by new
money of the same size let an answer whose money was gone answer the new
money. One pool per bill, bounded by what each answer knew. A tip recorded
before a duplicate lost its money to the return of that duplicate. Deciding
by recording order alone. A goodwill refund then ate a tip, or a later
goodwill refund shrank an earlier one. Keeping the acknowledgement. It never
said where the money went.

## Consequences

Two devices out of sync can record more than the overpayment. The part
beyond what the money allows is shown as not counted. A later return can
lower what an earlier tip counts. Ordering by the sync clock reads Evolu's
history, which `evolu-history-shape.test.ts` guards. The card, the bill and
payment histories, the payment detail and the sales statistics read the same
derivation.

## Enforced by

- `packages/core/src/modules/bill/bill-overpayment.test.ts > The unresolved overpayment of a bill > Lines removed after a guest paid`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > The unresolved overpayment of a bill > Two guests pay the same share`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > The unresolved overpayment of a bill > Payment without a bill settled twice`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > Tip confirmed`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > Tip, then a returned duplicate`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > Money removed under a resolution, then new money`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > What each resolution answers > two devices keep the same overpayment > Two devices keep at once`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > the overpayment model's randomized checks > in sync, seed %i: exact accounting, both caps, no dead end, EET floor`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > the overpayment model's randomized checks > out of sync, seed %i: bounded, no draw from an unknown transaction, later money shown, order free, EET floor`
- `packages/core/src/modules/overpayment-resolution/overpayment-resolution-actions.test.ts > Staff resolves an overpayment > Split resolution`
- `packages/core/src/modules/overpayment-resolution/overpayment-resolution-actions.test.ts > Staff resolves an overpayment > Resolution larger than the overpayment`
- `packages/core/src/modules/overpayment-resolution/overpayment-resolution-actions.test.ts > A mistaken tip or kept amount is withdrawn, never edited > Tip recorded by mistake`
- `packages/core/src/modules/overpayment-resolution/overpayment-resolution-actions.test.ts > A mistaken tip or kept amount is withdrawn, never edited > a withdrawal is final`
- `packages/core/src/modules/bill/bill-overpayment-guards.test.ts > Acknowledged extra money counts as kept > Acknowledged before the change`
- `packages/core/src/modules/bill/bill-overpayment-guards.test.ts > Ask before the edit > Removing every line after a guest paid`
- `packages/core/src/modules/bill/bill-overpayment-guards.test.ts > Ask before the edit > Split that leaves the bill paid exactly`
- `packages/core/src/modules/bill/bill-actions.test.ts > A split keeps money with its lines > Every line split off a paid share`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > tips from an overpayment > Tips of the day`
- `apps/web-app/e2e/activity-bills.spec.ts > the bill detail's overpayment card returns, tips, keeps and withdraws money paid above the bill`
- `apps/web-app/e2e/bill.spec.ts > removing lines a guest has paid for asks first and offers to resolve the overpayment`
- `apps/web-app/e2e/tables-overview.spec.ts > a self-paid bill whose lines staff remove leaves the overview and its overpayment goes back`
