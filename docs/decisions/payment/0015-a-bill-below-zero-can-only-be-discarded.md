# 0015 A bill below zero can only be discarded

Status: accepted
Date: 2026-11-10

## Context

A catalog item may cost less than nothing: a discount of a fixed amount sold
as an ordinary item (catalog/0002). A bill's lines are summed as they stand,
sign included, so a discount that outweighs the goods takes the bill's total
below zero. Until now every line amount was at least zero and the bill line
projection (`calculateBillLineSummaries`) and the sales statistics' SQL
(`nettedBillLines`) both clamped a netted line at zero, which a discount
cannot survive: the bill's total, its coverage and the statistics would all
read the discount as nothing.

A payment is created only for goods worth more than zero (payment/0012) and
a bill finished without one has to come to exactly zero (payment/0013). A bill
below zero closed in any way would count in the statistics as a negative
sale.

## Decision

- Line amounts keep their sign everywhere they are summed: the bill line
  projection, the bill's total and the statistics' netted lines clamp
  nothing at zero. A bill's total is below zero when its discounts outweigh
  its goods.
- A bill below zero can only be discarded. It cannot be paid by any method
  (`BillTotalNotPositive` refuses it, a tip line included, since the tip is not
  counted), it cannot be finished (`closeZeroBill` needs exactly zero), and
  both apps keep Charge disabled with a hint that the bill can only be
  discarded.
- Its coverage measures the total as nothing owed (`deriveBillCoverage`
  compares what was claimed with `max(0, total)`): with nothing claimed it
  reads `paid`, not `overpaid`, in the history, on the bill detail and on a
  payment. Its status is unaffected: closing by coverage still needs a
  claim, so the bill stays open until it is discarded.
- A split is refused (`BillSplitTotalNegative`) when it would leave any bill
  that still has lines — the source or the target, an existing bill or the
  one the split creates — with a total below zero, so staff never end up with
  a remainder they can only discard. A bill left at exactly zero is fine: it
  can be finished. A source the split empties is still discarded with it.
- The canceled-bill signal in the statistics counts only the groups of a
  canceled bill that net above zero: the goods discarded, not the discounts,
  so adding a discount before discarding a bill cannot zero the signal.
- An amount computed from a price and a quantity, or a line's unit amount
  from its total, is rounded to the nearest minor unit with a half rounded
  away from zero (`roundMinorUnits`), so a discount rounds as the mirror of
  the same positive amount.

## Alternatives considered

Clamping a bill's total at zero, which would hide a discount larger than the
goods and let the bill be finished as if it came to nothing. Letting a bill
below zero be closed, which records a negative sale. Allowing a split to
leave a negative remainder, which leaves staff a bill nobody can pay.

## Consequences

The discount that took a bill below zero was added by someone who may
discard, so discarding it costs nothing more. A partly paid bill cannot go
below zero at all: a cart write may not take it below what was paid
(payment/0014). When a line's quantity nets to zero midway and is added
again, the sales statistics and the bill line projection both drop it and
start it afresh (payment/0016). `docs/bill-payment-states.md`
describes coverage of a total below zero.

## Enforced by

- `packages/core/src/modules/bill-line/bill-line-utils.test.ts > bill line summaries > nets a discount below zero, taken off and added again, without clamping it`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillCoverage > measures a total below zero as nothing owed: paid with nothing claimed, overpaid by every claim`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillCoverage > a negative bill nobody paid stays open and reads paid, not overpaid, in its history`
- `packages/core/src/modules/bill/bill-utils.test.ts > isBillPayable > a bill whose goods come to less than zero cannot be paid through any method`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveZeroBillRefusal > refuses a bill below zero, which can only be discarded (payment/0015)`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a bill a discount takes below zero is not overpaid and cannot be paid through any method`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a tip does not lift a bill whose goods come to less than zero into one that can be paid`
- `packages/core/src/modules/bill/bill-actions.test.ts > bills with a discount > nets below zero, reads paid rather than overpaid, and is taken off and added again`
- `packages/core/src/modules/bill/bill-actions.test.ts > bills with a discount > refuses a split that leaves a bill with lines below zero, and lets one left at exactly zero through`
- `packages/core/src/modules/bill/bill-actions.test.ts > bills with a discount > moving every line, the discount with them, empties and cancels the source`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > net a discount taken off and added again as calculateBillLineSummaries does`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > the canceled-bill signal > counts the goods discarded, which a discount cannot zero`
- `packages/core/src/modules/shared/money.test.ts > roundMinorUnits > rounds a half away from zero, a negative amount the mirror of its positive twin`
- `packages/app-shared/src/bill-checkout.test.ts > deriveBillCheckout > keeps Charge disabled on a bill below zero, which can only be discarded`
