# 0008 An order whose money arrives while ordering is off waits unmatched

Status: accepted
Date: 2026-11-08

## Context

The device that takes orders recorded a menu order whenever its money
arrived, whether or not ordering from the menu was still on. An owner
switches ordering off when the kitchen closes, and a guest who ordered
from a page opened before that, or a stranger replaying an old menu, still
put an order in front of the staff.

## Decision

Money for an order that is not recorded yet becomes an order only while
ordering from the menu is on (`appSettings.menuOrdering`). Otherwise the
money stays unmatched for staff, and the device keeps looking for 7 days, so
the order is recorded if ordering is switched back on in time. Money for an
order already recorded still goes to its bill.

## Alternatives considered

- Recording the order and leaving it to the staff to reject. An owner who
  closed the kitchen would still be handed orders to turn down.
- Refusing the rest of an order recorded before ordering was switched off.
  The guest already paid part of an order the staff took.

## Consequences

A guest who pays by bank after ordering was switched off finds the order not
confirmed, and staff find the money among the payments whose order is not
found yet, to return by hand.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for an order that cannot be recorded > waits unmatched when ordering is off as the money arrives`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for an order that cannot be recorded > takes the rest of an order already recorded, though ordering has been switched off since`
