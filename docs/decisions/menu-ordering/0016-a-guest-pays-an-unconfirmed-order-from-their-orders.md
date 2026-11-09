# 0016 A guest pays an unconfirmed order from their orders

Status: accepted
Date: 2026-11-09

## Context

A guest who left the payment of an order, by a stray tap or because the
payment did not go through, kept the order under "Your orders" with no way back
to paying it. Ten minutes later the page said it had not seen the payment and
offered only "Not paid, remove", so the guest waited, then picked the order
again from the menu.

## Decision

An order the restaurant has not confirmed offers "Pay" with its total as soon
as its payment is closed, in place of removing it. Until the wait for the money
is over, it tells a guest who paid already that the payment waits to be
confirmed; after it, it asks them to show the screen to the staff, as before.
"Pay" opens the order's payment again, under the same order reference, for
the order's total without the tip, and the wait starts again. The page offers
it only once it has read what the restaurant confirmed, so a paid order never
shows it while the page loads.

## Alternatives considered

- Offering "Pay" only once the wait is over. A guest who tapped out of the
  payment would wait ten minutes to pay.
- Keeping "Not paid, remove" beside "Pay". The page drops an order a day after
  the guest last started paying it, and a second button would sit next to the
  one that matters.

## Consequences

An order the guest never pays stays under "Your orders" for a day after the
guest last started paying it. A guest whose bank transfer is on its way can pay
again despite the warning; staff resolve the doubly paid order as any overpaid
bill (`menu-ordering/0001`).

## Enforced by

- `apps/web-app/e2e/table-self-pay-menu.spec.ts > a guest who leaves an order's payment is offered to pay it from the order at once and after the wait, and sees it paid`
