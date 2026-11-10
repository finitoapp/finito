# 0005 One device takes orders, and switching on moves them only when none is taken

Status: accepted
Date: 2026-11-07

## Context

menu-ordering/0002 named the device that switches ordering on as the device
that takes orders. menu-ordering/0004 added a second switch, writing what one
pays for, whose orders the same device records. Switching ordering on from
the owner's phone while writing was on at the bar till moved every order,
written ones included, to the phone, and nobody was told. Switching writing on
kept the device already named, so a phone named long ago, then lost, stayed
named for a new phone that switched writing on.

A bill belongs to the device that opened it, which also reports it to EET
(`table-self-pay/0013`). An order's bill is opened by no device, and its
number must be unique within a day.

## Decision

The account names one device that takes orders (`appSettings.orderDeviceId`).
Switching ordering or writing on while neither is on names the device that
switched it on. Switching one on while the other is on keeps the device that
takes orders. Switching either off leaves it, and the owner can name another
(`setMenuOrdering`, `setWrittenOrders`, `setOrderDevice`). Only that device:
- publishes the menu and its Lightning rate;
- records paid orders, owns their bills and numbers them from 1 every day;
- publishes each order's confirmation, which only a page holding the order's
  pointer can read.

Two devices that both record one order, around a change of the device that
takes orders, write the same bill and lines, because their ids derive from
the pointer.

## Alternatives considered

- Every device recording orders. Two devices would number orders at the same
  time and could hand two guests the same number.
- The switching device on every switch-on, as menu-ordering/0002 did. Turning
  on the second switch moves the orders of the first.
- Keeping any device already named. A lost device stays named for a new one.

## Consequences

While the device that takes orders is offline, orders paid by bank transfer
wait and are recorded once it is back, and Lightning stops an hour after its
last rate (`table-self-pay/0006`). A device lost while one switch stays on
stays named until the owner picks another in the select under the switches.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > the device that takes orders > switching ordering on while writing is on keeps the device that takes orders`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > the device that takes orders > switching writing on while ordering is on keeps the device that takes orders`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > the device that takes orders > switching ordering on while both are off names this device, though another one is named`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > the device that takes orders > switching writing on while both are off names this device, though another one is named`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid order > numbers the orders of a day from 1`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for an order that cannot be recorded > is left to the device that takes orders`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for an order that cannot be recorded > writes the same rows on two devices that both record it`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > publishing the menu > publishes nothing from a device that does not take orders`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > publishing the menu > confirms a paid order only to a page that holds its pointer`
