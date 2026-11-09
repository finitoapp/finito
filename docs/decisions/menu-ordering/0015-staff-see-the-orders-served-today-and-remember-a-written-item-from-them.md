# 0015 Staff see the orders served today and remember a written item from them

Status: accepted
Date: 2026-11-09

## Context

A served order left "To serve" for good (`menu-ordering/0006`), and with it the
offer to remember its written items for the day (`menu-ordering/0013`). Staff
often learn that a dish will sell all day only after serving it, and the till
kept no list of what they had served.

## Decision

"To serve" has two tabs. "To serve" lists the orders waiting for the staff and
being prepared, as before. "Served" lists the orders served since the owner's
hour, 4:00 unless the owner picks another one (`menu-ordering/0018`), the last
served first. A served order shows its number, table, time, items and note,
and whether it was paid in full, with no button to change it. Each item of a
written order shows its tax rate and, while guests both order from the menu and
write their orders, offers to remember it for the day or add it to the menu
for good, as under "To serve" (`menu-ordering/0018`).

## Alternatives considered

- The orders served in the last 24 hours. The owner's hour is already where the
  business ends its day, and where an item remembered for the day leaves the
  menu.

## Consequences

The day follows the clock of the device showing the list. The list is read
again when data changes, so after the owner's hour it can show the day before
until the next change. A rejected order is in neither tab. Under "Served" the
notice of a waiting order stays hidden, as everywhere on "To serve"
(`menu-ordering/0014`); the tab that lists the order is beside it.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > lists the orders served since the owner's hour, the last served first`
- `apps/web-app/e2e/menu-orders.spec.ts > a paid order is announced, listed to serve and served`
- `apps/web-app/e2e/written-orders.spec.ts > staff remember a written item for today as Řízek for 199.00, the next guest orders it from the menu, and staff keep it for good`
