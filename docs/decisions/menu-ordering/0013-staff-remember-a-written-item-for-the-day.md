# 0013 Staff remember a written item for the day, and guests order it from the menu

Status: accepted
Date: 2026-11-08

## Context

A guest who wants something the menu does not list writes it with an amount
(`menu-ordering/0011`), and the staff set its tax rate before accepting it
(`menu-ordering/0012`). The next guest who wants the same dish writes it
again, at an amount they guess, and the staff set its rate again. Staff often
know after the first order that a dish will sell all day: the soup, the dish
of the day.

## Decision

While guests both order from the menu and write their orders, "To serve"
offers to remember each item of a written order for the day. Remembering asks for the name guests see and the
price, prefilled with the guest's text and amount, and takes the rate the item
has. It puts a catalog item with that name, price and rate in the menu, so
guests order it like any other menu item (`menu-ordering/0001`) and the till
sells it like any other catalog item. Remembering the same item again changes
that catalog item instead of adding another.

The item leaves the menu the next time the clock strikes the owner's hour,
4:00 unless the owner picks another one under the tables' self-pay options,
in the time zone of the device that remembered it. The device that takes
orders rebuilds the menu every five minutes, so the item is gone from the
menu guests read within five minutes after that. It stays in the catalog, out
of the menu; switching it back on keeps it in the menu for good.

Remembering changes the catalog, so it needs the `catalog` permission
(`access/0010`). The written order stays as the guest wrote it: remembering
changes none of its bill lines.

## Alternatives considered

- Guests pick from what other guests wrote. One guest's text would reach every
  table, at the price the first guest guessed.
- Remembering for good. A dish of the day would stay in the menu until someone
  removed it.
- Leaving the menu at midnight. A bar open past midnight would lose the item
  mid-service; the owner's hour covers both.
- A list of the day's items apart from the catalog. The menu, sold out, the
  stored menu versions and the till's catalog already do what it needs.

## Consequences

With every device offline at the owner's hour, the menu published before still
lists the item, and an order from it is priced from that version, as
`menu-ordering/0001` says. The same dish remembered from two orders is two
catalog items. An item the owner deleted stays deleted when staff remember it
again from the same order. A new hour applies to the items remembered after
the owner picks it.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a written item staff remember for the day > is in the menu under the name and price staff give it, at its rate, until 4:00`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a written item staff remember for the day > leaves the menu at the hour the owner set`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > the menu > offers an item remembered for the day until its time, then leaves it out`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > the day of an item remembered for it > ends when the clock next strikes the owner's hour, 4:00 unless set`
- `apps/web-app/e2e/written-orders.spec.ts > staff remember a written item for today as Řízek for 199.00, and the next guest orders it from the menu`
