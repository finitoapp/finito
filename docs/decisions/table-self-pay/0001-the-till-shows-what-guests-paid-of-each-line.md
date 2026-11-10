# 0001 The till shows what guests paid of each line

Status: accepted
Date: 2026-10-13

## Context

Guests pay at the table through self-pay, and each payment records which
lines it paid for in `selfPayAllocation` (docs/table-self-pay-design.md).
The guest page and the activity bill detail showed those lines paid. The
POS bill, where staff charge the table, listed every line at its full
price, so a line a guest had paid looked unpaid and staff charged it again.

## Decision

Each line of the POS bill shows what guests paid of it and what is left,
or that guests paid it in full. The figure is the guest view's own line
projection (`projectSelfPayViewLine`): the allocations for the line, capped
at the line total. Staff see the same number the guest sees.

It is display only. Coverage and bill status still never read allocations
(docs/bill-payment-states.md), and a paid line stays editable.

## Alternatives considered

Locking a paid line, or charging only what is left of it. Both make
allocations part of coverage, which the self-pay design keeps out of it, so
an allocation arriving late could change what staff already settled.

## Consequences

Staff see a paid line. What "Pay" offers, and where self-pay money that
carries no allocation shows, is `table-self-pay/0002`. A guest paying more
of a line than it costs shows it paid in full, not overpaid.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-projection-utils.test.ts > projectSelfPayViewLine > shows a line nobody paid as all remaining`
- `packages/core/src/modules/table-self-pay/table-self-pay-projection-utils.test.ts > projectSelfPayViewLine > shows a fifth paid by a guest and the rest remaining`
- `packages/core/src/modules/table-self-pay/table-self-pay-projection-utils.test.ts > projectSelfPayViewLine > shows a line split between two guests as paid in full`
- `packages/core/src/modules/table-self-pay/table-self-pay-projection-utils.test.ts > projectSelfPayViewLine > caps the paid part at the line total when guests paid more`
- `apps/web-app/e2e/table-self-pay.spec.ts > guests pay a fifth of a line at the table while nobody reserves anything`
- `apps/web-app/e2e/table-self-pay.spec.ts > two guests split a bill in halves and the till sees every line paid`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest pays the beer in full and the till shows it paid beside the open pizza`
