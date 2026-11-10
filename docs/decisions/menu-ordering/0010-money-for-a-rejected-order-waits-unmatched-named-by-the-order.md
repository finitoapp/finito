# 0010 Money for a rejected order waits unmatched, named by the order

Status: accepted
Date: 2026-11-08

## Context

Staff reject an order and return its money by hand (`menu-ordering/0006`).
Money can still arrive for it afterwards: a bank transfer the guest sent
before the page said the order was rejected, or a second one by mistake. More
money with the same pointer went to the order's bill (`menu-ordering/0001`),
so it was credited to a bill staff had already dealt with, and nothing told
them it was there.

## Decision

Once an order is rejected, money that names it is not credited to its bill.
It stays unmatched for staff, and the orders screen lists it apart from the
money whose order is not found yet, as paid after the order was rejected,
with the order's number, the amount and when it arrived, for staff to return
by hand.

## Alternatives considered

- Crediting it to the bill and leaving it to the bill's overpayment. Staff
  would have to look at every rejected order's bill to find it.

## Consequences

Money for a rejected order is listed for as long as the device looks for an
order's money, 7 days. Lightning money names no order a bank statement shows,
so it is not listed, and the guest asks for it as for the rest of a rejected
order's money.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > leaves money that arrives after the order is rejected unmatched, named by the order's number`
- `apps/web-app/e2e/written-orders.spec.ts > money a guest sends after staff reject the order stays off its bill, listed apart by the order's number`
