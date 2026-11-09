# 0006 Staff accept or reject an order before serving it, and the guest sees it

Status: accepted
Date: 2026-11-07

## Context

A paid order reached the till as a row in "To serve" and an announcement that
was gone in 4 seconds. "Served" was the only thing staff could say about it,
and it means handed over. The guest's page said "confirmed and paid" as soon as
the money was matched, before anyone had seen the order. Staff had no way to
turn an order down: the money was already paid, and Payky cannot send it back
by itself (`refund/0001`).

## Decision

Each order in "To serve" waits for the staff until one device of the account
accepts it (`menuOrder.acceptedAt`). An order waiting for the staff offers
"Accept" and no "Served"; an accepted one says it is being prepared and offers
"Served" (`menuOrder.servedAt`). Until it is served, staff can reject it after
a dialog that says the money has to be returned by hand
(`menuOrder.rejectedAt`). Rejecting needs the refund permission, as resolving
an overpayment does (`access/0012`). A rejected order leaves the list and
keeps its bill, number and payments. The till then opens the order's payment,
or its bill when more payments paid for it, where staff record the refund as
for any payment.

The device that takes orders adds `accepted`, `served` and `rejected`, in unix
seconds, to the confirmation it publishes for the order, and publishes it again
whenever one of them changes. The guest's page shows the order as paid and
waiting for the staff, being prepared, served, or rejected with the money to
come back from the staff, and keeps asking until it is rejected, or served
with nothing left to pay. A rejected order offers no payment of the rest.

The till announces a new order for 30 seconds, or until staff open it.

## Alternatives considered

- Accepting by marking served. Staff would say "handed over" before cooking.
- Refunding on rejection. Payky sends no money back, and a Lightning payer
  leaves no account to send it to.
- A reason for the rejection. Free text from staff would cross the relay, and
  a fixed list of reasons is a step of its own.
- A second version of the confirmation. Every guest page already open would
  drop it; the optional fields are ignored by a page that does not know them.

## Consequences

Relays see a new version of an order's confirmation each time staff accept,
serve or reject it, and when each was published, so they can tell how long a
kitchen takes. They still learn nothing about the table, the items or the
staff (`menu-ordering/0003`). While the device that takes orders is offline,
the guest sees an acceptance made on another device only once it is back.
Staff who reject an order and skip the refund leave the guest's money with the
business; the guest's page tells the guest to ask for it.
A rejected order not paid in full also discards its bill
(`menu-ordering/0009`).
Money that arrives for an order after it is rejected waits unmatched
(`menu-ordering/0010`).
The till keeps showing an order until staff accept or reject it
(`menu-ordering/0014`).
"To serve" lists the orders served today under "Served"
(`menu-ordering/0015`).

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > keeps an accepted order in the list, as accepted, until it is served`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > takes a rejected order off the list for good, keeps its bill and payment, and names that payment for the refund`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > names the bill for the refund of an order paid in two payments`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > guests writing what they pay for > tells the guest when staff accept and serve an order, and when they reject one`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > guests writing what they pay for > reads a confirmation from a device that knows no staff states as paid and waiting`
- `apps/web-app/src/features/table-self-pay-guest/guest-order-list.test.ts > where the guest's order stands > asks for nothing more once the order is rejected`
- `apps/web-app/e2e/written-orders.spec.ts > a guest paying the rest of an order staff reject leaves the payment and is told`
