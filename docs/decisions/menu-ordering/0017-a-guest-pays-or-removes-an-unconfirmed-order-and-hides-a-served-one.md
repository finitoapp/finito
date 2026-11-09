# 0017 A guest pays or removes an unconfirmed order and hides a served one

Status: accepted
Date: 2026-11-09

## Context

`menu-ordering/0016` put "Pay" in place of "Not paid, remove" on an order the
restaurant has not confirmed. On the owner's phone test the same day, a guest
who gave up on an order kept it under "Your orders" for a day, and so did a
guest whose order was served and paid: the list grew with orders that needed
nothing more from them.

## Decision

An order the restaurant has not confirmed offers "Pay" with its total and
"Not paid, remove" as soon as its payment is closed. Until the wait for the
money is over, it tells a guest who paid already that the payment waits to be
confirmed; after it, it asks them to show the screen to the staff. "Pay" opens
the order's payment again, under the same order reference, for the order's
total without the tip, and the wait starts again.

A served order with nothing left to pay offers "Hide". A served order with
something left offers paying the rest instead, and a rejected order offers
neither, since it tells the guest that the staff will return the money.

Removing and hiding forget the order on this phone only: the page stops
publishing the order and asking for its state, and the order stays gone after
the page is opened again. Neither cancels anything, so money that arrives for a
removed order later is recorded as for any order. Neither asks to confirm.

The page offers all three only once it has read what the restaurant confirmed,
and only while that order's payment is not open, so a paid order never offers
removing while the page loads.

## Alternatives considered

- "Pay" alone (`menu-ordering/0016`). A guest who gave up on an order had no
  way to take it off the list but a day's wait.
- A flag that keeps a hidden order stored. The page never shows it again, and
  forgetting it stops republishing it as well.
- Confirming a remove. It adds a step to the common case, a guest tidying up,
  to guard a rare one, a guest who paid and removes anyway.

## Consequences

A guest who paid and removes the order anyway loses only its number on the
phone: the money is recorded and staff serve the order, finding it by table and
time. A guest whose bank transfer is on its way can pay again despite the
warning; staff resolve the doubly paid order as any overpaid bill
(`menu-ordering/0001`). Nothing undoes a remove or a hide.

## Enforced by

- `apps/web-app/e2e/table-self-pay-menu.spec.ts > a guest who leaves an order's payment is offered to pay it from the order at once and after the wait, and sees it paid`
- `apps/web-app/e2e/table-self-pay-menu.spec.ts > a guest who leaves an order's payment removes the order at once, and it stays gone after reopening the page`
- `apps/web-app/e2e/table-self-pay-menu.spec.ts > a guest who paid an order short sees what is left, also after reopening the page and once it is served, pays the rest and may hide it`
- `apps/web-app/e2e/written-orders.spec.ts > staff see New order 1 · Bar · $90.00 · 2x pivo, accept it and mark it served, and the guest sees both and hides it`
