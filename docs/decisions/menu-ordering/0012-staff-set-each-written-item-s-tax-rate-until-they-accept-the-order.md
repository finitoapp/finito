# 0012 Staff set each written item's tax rate until they accept the order

Status: accepted
Date: 2026-11-08

## Context

Every written line takes the one tax rate the owner sets
(`menu-ordering/0007`), and a guest now writes an order item by item
(`menu-ordering/0011`). A beer and a meal on one order are taxed at different
rates, and only the staff know which item is which.

## Decision

For a VAT payer, "To serve" offers each item of a written order the account's
tax rates, the owner's rate for written lines picked. One press switches an
item to another rate, and only to a rate the account offers. Switching is open until a device accepts or rejects the
order; afterwards the order shows each item's rate, and a device that knows of
the decision refuses a switch.

A switch points the item's bill line at a snapshot of the item with the new
rate, as items are content-addressed and shared, so it never changes another
bill. The tax recap and the sales statistics read the new rate.

EET is reported as soon as the money is claimed, as before: the receipt carries
the total, not the rates, so a switch never contradicts what was reported.

## Alternatives considered

- Holding EET until the staff accept the order. The receipt names no rate, so
  holding it would only report later.
- Switching after acceptance too. Staff would revise the tax of goods already
  being prepared, and the recap would move under the accountant.
- A rate the guest picks. The guest does not know how the business is taxed.

## Consequences

An order nobody accepts keeps the rates it has. An item switched to another
rate no longer shows what the guest's payment allocated to it, as the
allocation names the item it was paid for. A switch made on a device that
has not yet synced the acceptance still lands, and two devices switching one
item at once resolve to the last write.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > the tax rate of a written line > is set by staff on each line, one by one, until they accept the order`
- `apps/web-app/e2e/written-orders.spec.ts > a VAT payer's staff switch a written item to another tax rate before accepting the order, and it holds after`
