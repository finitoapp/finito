# 0009 Rejecting an order not paid in full discards its bill

Status: accepted
Date: 2026-11-08

## Context

Less money than an order costs leaves its bill open with what is left
(`menu-ordering/0001`), so the guest can pay the rest. A stranger can pay one
koruna for 99 coffees by bank: the order reaches "To serve" as not fully paid,
and its bill sits on the table owing the rest. Staff reject such an order
(`menu-ordering/0006`), but a rejected order kept its bill, so the table went
on owing 99 coffees nobody would serve.

## Decision

When staff reject an order whose bill is still open, its bill is discarded
with it, and the table owes nothing for the order. The money that did arrive
stays on the canceled bill, where staff return it. An order paid in full keeps
its closed bill when rejected, as before. Rejecting an order not paid in full
asks for `discard` besides `refund`, as discarding any bill does
(`access/0010`). The bill is canceled before the order is marked rejected, so
an app stopped in between leaves the order to reject again.

## Alternatives considered

- Recording an order only once its money covers it. A guest who mistyped the
  amount of a bank transfer would leave staff money with no order to serve,
  and could not pay the rest.
- Closing the bill at what arrived. The bill would report goods nobody sold.

## Consequences

An open order bill no longer outlives its rejection. Money that arrives for
the order after it is rejected waits unmatched (`menu-ordering/0010`).

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > discards the bill of a rejected order not paid in full, so the table owes nothing for it`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > keeps the closed bill of a rejected order paid in full`
