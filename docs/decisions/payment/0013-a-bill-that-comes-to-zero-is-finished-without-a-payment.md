# 0013 A bill that comes to zero is finished without a payment

Status: accepted
Date: 2026-11-10

## Context

A bill whose goods come to exactly zero — free items only (catalog/0001) —
cannot be paid (payment/0012), and a bill closes by its coverage only with a
claim behind it. `bill.closedAt` is stored, not derived, and the floor view
and the sales statistics filter on it; `bill.confirmedClosedAt` already
outranks every other fact in `deriveBillStatus`, and older versions of the
app know both fields.

## Decision

- Staff close such a bill with "Finish" (`closeZeroBill`), in place of
  Charge, with the `sell` permission: no payment method, no tip.
- It takes a bill that is editable (open, no payment in flight) with at least
  one line once adds and removes are netted and no tip line, whose goods come
  to exactly zero. Anything else is refused (`BillNotZero`, or the guard's
  own error).
- One write sets `closedAt` and `confirmedClosedAt`. `confirmedClosedAt`
  now means "staff confirmed the bill closed", with two sources: this and the
  resolution of a canceled bill its payments cover. The closing is final;
  the bill never reopens on its own.
- The statistics count the bill as sold, its free items included. No
  payment, payment number, EET sale or refund comes of it.
- A device that has not yet seen the closing can still add a line to the
  bill. Once synced, the bill stays closed and reads underpaid; the bill
  detail and the bill history flag it as an underpayment, and staff ring the
  item up on a new bill. This is accepted, not prevented.
- Two devices finishing the same bill write the same fields. One finishing
  it while another discards it ends closed, with no collision reported.

## Alternatives considered

A bill of zero that counts as paid by itself, which would close an empty
cart or one still being rung up. A new field such as
`bill.closedWithoutPaymentAt`: either conditional on the total, so the bill
reopens itself after an offline edit while `closedAt` keeps it off the floor
view, or final, which needs an exception in `deriveBillStatus` and a
conflict flag — and older versions would read the bill as open. A "reopen"
action for a closed bill another device added to, which needs a new field
(`confirmedClosedAt` is never cleared) and a new state in the bill's
lifecycle. A payment of zero, rejected by payment/0012.

## Consequences

`docs/bill-payment-states.md` gains the section "Finishing a bill that comes
to zero" and a second source of `confirmedClosedAt`, and "closed and
underpaid", which its payments can never produce, now occurs for a bill
finished at zero. The test that closed a bill of zero through a payment of
zero is replaced by one that finishes it.

## Enforced by

- `packages/core/src/modules/bill/bill-actions.test.ts > closeZeroBill > closes a bill whose goods come to zero, final and off the floor view`
- `packages/core/src/modules/bill/bill-actions.test.ts > closeZeroBill > refuses an empty bill, one whose total is not zero, one with a tip and one a payment locks`
- `packages/core/src/modules/bill/bill-actions.test.ts > closeZeroBill > a bill finished at zero stays closed and reads underpaid when another device adds a line`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a bill whose goods come to zero cannot be paid through any method, and is finished instead`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > count a bill finished at zero as sold, its free items included`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillHistoryItemSummary > a bill staff closed at zero without a payment stays closed and underpaid once a line lands on it`
- `packages/app-shared/src/activity-history.test.ts > bill history rows > a bill closed without payment that another device added a line to stays closed and is flagged underpaid`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveZeroBillRefusal > lets a bill of free lines alone be finished, which is when Finish stands in for Charge`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveZeroBillRefusal > refuses an empty bill, one with a tip line and one whose goods are worth something`
- `packages/app-shared/src/bill-checkout.test.ts > deriveBillCheckout > offers Finish in Charge's place for a bill whose goods come to exactly zero`
- `packages/app-shared/src/bill-checkout.test.ts > deriveBillCheckout > offers neither for an empty bill, nor for goods of zero beside a tip`
- `apps/web-app/src/features/bill/use-finish-bill.test.ts > Finish asks for sell before it closes the bill`
- `apps/native-app/src/features/bill/use-finish-bill.test.ts > Finish asks for sell before it closes the bill`
- `apps/web-app/e2e/bill.spec.ts > finishes a bill of free items without a payment, and it leaves the floor`
