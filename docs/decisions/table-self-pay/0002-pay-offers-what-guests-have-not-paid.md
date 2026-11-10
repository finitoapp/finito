# 0002 Pay offers what guests have not paid

Status: accepted
Date: 2026-10-13

## Context

Guests' self-pay money lands on the bill as a claimed payment, so it
already counts toward the bill's coverage (docs/bill-payment-states.md).
"Pay" on the POS bill still offered the full total, so staff charged the
table for money guests had already paid. Money whose transfer names no
lines, such as one from a bank that cuts the message, counted toward the
bill but showed on no line (`table-self-pay/0001`).

## Decision

"Pay" offers the bill total minus the money claimed on the bill, never
below zero. Once money is claimed, the bill shows "Already paid" and "Left
to pay" under its total, and the collapsed summary on a phone shows what is
left. Money that names no lines is part of "Already paid".

The figure comes from coverage, not from allocations, so it is the same
money that decides when the bill closes.

## Alternatives considered

Charging the total minus what guests allocated to lines. An allocation that
arrives late or wrong would then change what staff charge, which
`table-self-pay/0001` rejects, and money naming no lines would still be
charged twice.

Showing money that names no lines as its own row, apart from money paid for
lines. Staff charge the same remainder either way, and the design treats it
as any payment to the bill that names no lines.

## Consequences

Staff can no longer charge guests' money a second time from the POS bill.
A guest paying while staff charge the rest still overpays the bill, which
reads `overpaid` for staff to resolve, as before.

## Enforced by

- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillHistoryItemSummary > open, no collision, for a fresh bill with nothing claimed`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillHistoryItemSummary > leaves what the claims have not paid due`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillHistoryItemSummary > leaves nothing due on an overpaid bill`
- `apps/web-app/e2e/table-self-pay.spec.ts > the till charges only what guests have not paid, lines or no lines`
