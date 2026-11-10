# 0011 A guest writes an order item by item

Status: accepted
Date: 2026-11-08

## Context

A written order was one line of text and one amount (`menu-ordering/0004`). A
guest paying for a beer and a meal wrote both into that line, so the bill had
one line for goods taxed at different rates, and the staff could not tell how
much was which.

## Decision

A guest writes an order as up to 20 items, each a text and an amount, and pays
their total; an item left blank is not sent. Each item is checked as the one line was: the same text
validator, an amount above zero, and a total from the self-pay minimum up to
what a QR payment carries.

The device records one bill line per item, in the order the guest wrote them,
each named by its text. The money that arrived fills the items in that order,
each up to its amount, so an item after the money ran out is recorded at
nothing. More money with the same pointer fills them on in the same order, up
to the total. What arrives above the total is the tip, as before.

"To serve" lists each item as the guest's text with its amount, and the total
under them; the announcement names the texts together, in no set order.

## Alternatives considered

- Splitting the money across the items in proportion. The amounts would round,
  and staff could not see which item the guest did not pay.
- Keeping one line and letting staff split it. The guest knows what each item
  cost; staff would guess.

## Consequences

The selection carries a list of items, so a guest page from before this change
cannot write an order the device reads; written orders have not shipped.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > what a guest writes > reads up to 20 lines whose total a QR payment carries`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > what a guest writes > fills the lines with the money in the order the guest wrote them`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > of several lines fills them in the order written, and the rest raises the next`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > lists a written order line by line as the guest wrote it, filled in that order, and not fully paid when less arrived`
- `apps/web-app/e2e/written-orders.spec.ts > a guest writes two items, pays their total, and staff see each with its amount and the total`
