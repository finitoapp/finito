# 0015 Staff see the orders served today

Status: accepted
Date: 2026-11-09

## Context

A served order left "To serve" for good (`menu-ordering/0006`), and the till
kept no list of what staff had served.

## Decision

"To serve" has two tabs. "To serve" lists the orders waiting for the staff and
being prepared, as before. "Served" lists the orders served since 4:00, the
last served first. A served order shows its number, table, time, items and
note, and whether it was paid in full, with no button to change it.

## Alternatives considered

- The orders served in the last 24 hours. A bar open past midnight would see
  the evening before mixed with the morning after.

## Consequences

The day follows the clock of the device showing the list. The list is read
again when data changes, so after 4:00 it can show the day before until the
next change. A rejected order is in neither tab. Under "Served" the
notice of a waiting order stays hidden, as everywhere on "To serve"
(`menu-ordering/0014`); the tab that lists the order is beside it.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > lists the orders served since 4:00, the last served first`
- `apps/web-app/e2e/menu-orders.spec.ts > a paid order is announced, listed to serve and served`
