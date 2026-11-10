# 0014 The till shows a waiting order until staff accept or reject it

Status: accepted
Date: 2026-11-09

## Context

The till announced a new order for 30 seconds, or until staff opened it
(`menu-ordering/0006`). Staff away from the till for half a minute came back to
a screen that said nothing about it, though the order still waited for them to
accept or reject it.

## Decision

While an order waits for the staff, that is no device has accepted or rejected
it, every device of the account shows one notice at the bottom of every screen
but "To serve". It does not time out, and it cannot be swiped or tapped away.
For one waiting order it names the order as the announcement did: its number
and table, and for a written order the money and the guest's text. For more it
counts them. Its "Open" button opens "To serve", which lists the orders
themselves, so the notice stays off that screen. Once a device accepts or
rejects the last waiting order, the notice leaves every device as the change
reaches it.

An order already waiting when the till starts is shown too.

## Alternatives considered

- One toast per order, kept until it is decided. A busy evening would stack
  them over the screen.
- Opening "To serve" by itself when an order arrives. It would take the till
  from staff in the middle of a sale.
- Keeping the notice on "To serve" as well. It would cover the buttons of the
  last order, the ones that make it go away.

## Consequences

While an order waits, the notice covers the bottom of every other screen,
whatever staff do there. A device that is offline keeps showing it until the
acceptance reaches it. An accepted order waits for "Served" with no notice.

## Enforced by

- `packages/app-shared/src/menu-order-announcement.test.ts > waitingMenuOrdersNotice > says nothing while no order waits for the staff`
- `packages/app-shared/src/menu-order-announcement.test.ts > waitingMenuOrdersNotice > names the one order waiting for the staff by number and table`
- `packages/app-shared/src/menu-order-announcement.test.ts > waitingMenuOrdersNotice > counts the orders when more wait for the staff`
- `apps/web-app/e2e/menu-orders.spec.ts > a paid order is announced, listed to serve and served`
- `apps/web-app/e2e/written-orders.spec.ts > staff see New order 1 · Bar · $90.00 · 2x pivo, accept it and mark it served, and the guest sees both and hides it`
