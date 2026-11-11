# 0003 A discount is spread over the goods before VAT is counted, and frozen with the payment

Status: accepted
Date: 2026-11-10

## Context

A discount is a catalog item priced below zero (catalog/0002). It has no VAT
rate: it lowers what the guest pays for the goods on the bill, whatever their
rates. The VAT recap, though, groups a bill's lines by rate, and a line
without one falls into the "no rate" group, the same as the goods of an
account that is not a VAT payer. Counted as it stands, a discount would make
that group, or a whole recap, negative, and would leave every rate's VAT as
if nothing had been taken off.

The recap is read in four places, and they must agree to the minor unit: the
bill detail and the payment detail, the Qerko receipt (whose `taxInfo` must
add up to the payment and holds no line below zero), and the VAT in the
sales statistics. A refund of one goods line must return what that line was
really paid at, which is the same number.

## Decision

- Before VAT is counted, a bill's discount is spread over its goods lines by
  one pure function, `allocateDiscount` (`bill-line-discount-utils.ts`), as a
  fixed algorithm:
  - The discount is the sum of the lines below zero. It is shared by every
    line above zero but a tip — a manual amount and an item without a VAT
    rate included, so the "no rate" group is discounted too.
  - Each line's share is proportional to its gross amount, per line and not
    per rate, rounded by the largest remainder with ties to the line whose
    id sorts first. The shares add up to the discount exactly, whatever
    order the lines come in.
  - No line ends below zero. A discount larger than the goods takes them to
    zero, and a bill without goods above zero shares nothing (such a bill
    cannot be paid, payment/0012, and shows no VAT recap).
- VAT is counted from the net lines (`calculateTaxRecap` over
  `deriveLineNetAmount`, `totalAmount + discountShare`). A discount line is
  no VAT row and never part of the "no rate" group.
- A payment freezes the allocation: `snapshotBillLinesForPayment` writes
  each goods line's share into `paymentLine.discountShare`, and the discount
  line as it stands, below zero. The payment detail and the Qerko receipt
  read those frozen rows instead of allocating again. A row without a share
  (`null`) nets to its own amount, so payments made before discounts read as
  they did.
- The sales statistics count the VAT of a bill without a discount in SQL, as
  before, and fold the lines of a bill with one in JS through the same
  `allocateDiscount`, so a bill unchanged since its payment shows the VAT its
  payment froze. The item leaderboard sums discounts apart instead of
  ranking them as items that lost money, and the categories leave them out,
  so no category, "Uncategorized" included, is lowered by a discount or
  shown below zero. A goods group of a bill without a discount that nets
  below zero (a removal written twice) is left out of the VAT recap rather
  than voiding it.

## Alternatives considered

Allocating per VAT rate instead of per line: the recap would round
differently from a refund of one line, and the two would part by a minor
unit. Allocating in SQL with window functions: SQLite would round
differently from the bill detail. Recomputing the allocation for a payment
on every read: a later change of the algorithm would rewrite the VAT of
receipts already issued. A discount with a VAT rate of its own: a discount
covers goods of several rates.

## Consequences

The algorithm is fixed. Changing it changes the recap of open bills and the
statistics, never a payment already made. Every rate on a receipt or in
Qerko's `taxInfo` is zero or above, since a paid bill's goods exceed its
discount. A refund of a goods line reads the same net amount (refund/0014).
An app version older than discounts freezes no shares and counts the
discount in the "no rate" group (catalog/0002); a payment it freezes with a
discount line and no shares shows no VAT recap rather than one before the
discount.

## Enforced by

- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > shares a discount over lines of several VAT rates in proportion to their amounts`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > gives a manual amount and an item without a VAT rate their share too`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > leaves a tip out`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > rounds by the largest remainder, the shares adding up to the discount`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > never takes a line below zero`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > comes to the same shares whatever order the lines come in`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > allocateDiscount > shares nothing without a discount, or without goods above zero`
- `packages/core/src/modules/bill-line/bill-line-discount-utils.test.ts > deriveLineNetAmount > takes a line's share off its amount, and a line without one as it is`
- `packages/core/src/modules/bill-line/bill-line-tax-utils.test.ts > calculateTaxRecap > with a discount > counts VAT from the net lines, with no discount row and no rate below zero`
- `packages/core/src/modules/bill-line/bill-line-tax-utils.test.ts > calculateTaxRecap > with a discount > shows nothing for a discount no goods bear`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > freezes each goods line's share of the discount with the payment, which its VAT recap reads`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > answers a discounted bill's VAT from the net lines its payment froze, no rate below zero`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > recap a discounted bill's VAT as its payment froze it`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > net a discount taken off and added again as calculateBillLineSummaries does`
- `packages/app-shared/src/stats-sections.test.ts > splitItemSales sums the discounts apart instead of ranking them`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > leave discounts out of the categories, which the leaderboard shows apart`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > recap VAT without a goods group that nets below zero, rather than none at all`
- `packages/app-shared/src/stats-sections.test.ts > categoryShares keeps every share between none and the whole`
