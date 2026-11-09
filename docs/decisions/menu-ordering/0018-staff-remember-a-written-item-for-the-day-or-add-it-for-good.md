# 0018 Staff remember a written item for the day or add it to the menu for good

Status: accepted
Date: 2026-11-09

## Context

Staff remember a written item for the day (`menu-ordering/0013`), so guests
order it from the menu until the owner's hour. A dish that sells every day had
to be remembered again every day, or added by hand under the catalog with its
name, price and rate typed again. The menu could not grow from what guests
write.

## Decision

While guests both order from the menu and write their orders, each item of a
written order offers two actions, under "To serve" and under "Served"
(`menu-ordering/0015`): remembering it for today, and adding it to the menu for
good. Both ask for the name guests see and the price, prefilled with the
guest's text and amount, and take the rate the item has. Both put one catalog
item with that name, price and rate in the menu, so guests order it like any
other menu item (`menu-ordering/0001`) and the till sells it like any other
catalog item. Remembering the same item again, either way, changes that
catalog item instead of adding another.

An item remembered for today leaves the menu the next time the clock strikes
the owner's hour, 4:00 unless the owner picks another one under the tables'
self-pay options, in the time zone of the device that remembered it. The
device that takes orders rebuilds the menu every five minutes, so the item is
gone from the menu guests read within five minutes after that. It stays in the
catalog, out of the menu.

An item added for good stays in the menu until someone takes it out under the
catalog. While an item is in the menu for the day, the order says until when
and offers keeping it in the menu for good, which asks nothing and keeps its
name, price and rate.

Both change the catalog, so they need the `catalog` permission
(`access/0010`). The written order stays as the guest wrote it: remembering
changes none of its bill lines.

## Alternatives considered

- Only for the day (`menu-ordering/0013`). A dish that sells every day would be
  remembered again every day.
- Adding for good only under the catalog. Staff would type again the name,
  price and rate the order already has.
- Guests pick from what other guests wrote. One guest's text would reach every
  table, at the price the first guest guessed.
- Leaving the menu at midnight. A bar open past midnight would lose the item
  mid-service; the owner's hour covers both.
- A list of the day's items apart from the catalog. The menu, sold out, the
  stored menu versions and the till's catalog already do what it needs.

## Consequences

With every device offline at the owner's hour, the menu published before still
lists an item remembered for the day, and an order from it is priced from that
version, as `menu-ordering/0001` says. The same dish remembered from two orders
is two catalog items. An item the owner deleted stays deleted when staff
remember it again from the same order. A new hour applies to the items
remembered after the owner picks it. Items added for good stay in the catalog
until staff delete them or take them out of the menu.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a written item staff remember for the day or for good > is in the menu under the name and price staff give it, at its rate, until 4:00`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a written item staff remember for the day or for good > leaves the menu at the hour the owner set`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a written item staff remember for the day or for good > added for good is still in the menu the next day`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a written item staff remember for the day or for good > remembered for today and kept for good is one catalog item that stays`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > the menu > offers an item remembered for the day until its time, then leaves it out`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > the day of an item remembered for it > ends when the clock next strikes the owner's hour, 4:00 unless set`
- `apps/web-app/e2e/written-orders.spec.ts > staff remember a written item for today as Řízek for 199.00, the next guest orders it from the menu, and staff keep it for good`
- `apps/web-app/e2e/written-orders.spec.ts > staff add a written item to the menu for good as Řízek for 199.00 from To serve, and the next guest orders it from the menu`
