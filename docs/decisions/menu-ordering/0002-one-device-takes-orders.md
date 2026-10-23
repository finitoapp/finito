# 0002 One device takes orders

Status: accepted
Date: 2026-10-22

## Context

A bill belongs to the device that opened it, which also reports it to EET
(`table-self-pay/0013`). An order's bill is opened by no device, and its
number must be unique within a day.

## Decision

The account names one device that takes orders (`appSettings.orderDeviceId`).
Switching ordering on names the device that switched it on, and the owner
can name another (`setMenuOrdering`, `setOrderDevice`). Only that device:
- publishes the menu and its Lightning rate;
- records paid orders, owns their bills and numbers them from 1 every day;
- publishes each order's confirmation, which only a page holding the order's
  pointer can read.

Two devices that both record one order, around a change of the device that
takes orders, write the same bill and lines, because their ids derive from
the pointer.

## Alternatives considered

Every device recording orders. Two devices would number orders at the same
time and could hand two guests the same number.

## Consequences

While the device that takes orders is offline, orders paid by bank transfer
wait and are recorded once it is back, and Lightning stops an hour after its
last rate (`table-self-pay/0006`).

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid order > numbers the orders of a day from 1`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for an order that cannot be recorded > is left to the device that takes orders`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for an order that cannot be recorded > writes the same rows on two devices that both record it`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > publishing the menu > publishes nothing from a device that does not take orders`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > publishing the menu > confirms a paid order only to a page that holds its pointer`
