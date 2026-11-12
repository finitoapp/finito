# 0019 A rejected order's money is listed to return until staff answer it

Status: accepted
Date: 2026-11-12

## Context

Staff reject an order and record its refund from where the till lands them
(`menu-ordering/0006`). Once they leave that screen, the rejected order is
in neither tab of "To serve", and nothing says its money is still owed: a
paid order's bill counts as a sale, and a discarded one only reads overpaid
in Activity (`payment/0014`). Money that arrives after the rejection was
listed on its own card (`menu-ordering/0010`).

## Decision

"To serve" shows one "Money to return" card. It lists every rejected order
whose money staff have not answered yet, by the order's number and the
amount still owed, with "Record refund" leading where rejecting leads: the
order's payment, or its bill when more payments paid for it. A rejected
order keeps no goods, so all the money on its bill is owed until staff
return it, or answer the money on a discarded bill as a tip or kept
(`payment/0014`). The money that arrived after the rejection is listed on
the same card, by the order's number, the amount and when it arrived, for
staff to return by hand.

## Alternatives considered

- Counting only a discarded bill's unresolved overpayment. A rejected order
  paid in full keeps its closed bill, so its money would never be listed.
- A list per screen, as before. Staff had to know where each kind of owed
  money hides.

## Consequences

Staff who reject an order and skip the refund see its money on "To serve"
until they record it. A rejected order whose bill is answered drops off the
card. The card reads every rejected order the account has, so it grows with
them while each is checked on every change.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > what staff serve > lists the money of a rejected order to return until staff answer it`
- `apps/web-app/e2e/written-orders.spec.ts > money a guest sends after staff reject the order stays off its bill, listed apart by the order's number`
