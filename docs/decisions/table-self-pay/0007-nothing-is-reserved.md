# 0007 Nothing is reserved

Status: accepted
Date: 2026-10-14

## Context

Several guests read the same view and may pick the same share. The merchant
device learns of a payment only when its money arrives
(`table-self-pay/0020`), so nothing tells it that a guest is about to pay.

## Decision

A self-pay payment exists only once money has arrived. Opening an invoice,
abandoning it or paying the same line as someone else changes nothing for
other guests until money lands. Two guests who pay the last fifth of a
line at once are both credited and the line shows paid. When that fifth
was all that was left of the bill, the bill shows overpaid for staff to
resolve.

## Alternatives considered

Reserving a share when a guest opens a payment. A reservation is a write a
stranger can trigger without paying, which is the flood
`table-self-pay/0020` removes (docs/table-self-pay-design.md §7).

## Consequences

Simultaneous guests can overpay a bill. Staff see it as `overpaid` and
resolve it the same way as at the counter.

Revisit when overpaid bills from simultaneous guests become common enough
to cost staff time.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > credits two guests who pay the same fifth from the same view`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > records two guests who each pay the whole remainder, leaving the bill overpaid`
- `apps/web-app/e2e/table-self-pay.spec.ts > guests pay a fifth of a line at the table while nobody reserves anything`
