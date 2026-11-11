# 0014 Items can be refunded only from a bill's only payment, at their net amount

Status: accepted
Date: 2026-11-10

## Context

Refunding chosen items needs to know which payment paid for which lines.
Only when one payment is claimed for a bill are all of the bill's lines its
own. With several payments, Payky cannot tell which payment paid which line.

A bill may now carry a discount, a line below zero (catalog/0002). It is
spread over the goods lines before VAT, and a payment freezes each line's
share of it into `paymentLine.discountShare` (catalog/0003). A goods line
was therefore paid at less than its `totalAmount`, and the discount line
paid for nothing on its own. refund/0002, which this supersedes, refunded a
line at its `totalAmount`: the goods of a discounted payment would have
given back more than the payment took for them.

## Decision

Staff can refund chosen items while no other payment of its bill has a
claim. Otherwise only an amount is offered. A tip is never part of an item
refund. Returning the rest of a line returns the rest of its amount, so
rounding leaves nothing behind.

A goods line is refunded at its net amount, `totalAmount + discountShare`
(`deriveLineNetAmount`), pro rata to the quantity returned
(`calculateRefundLineAmount`). The core (`loadRefundLines`,
`loadGoodsRefundPlan`) and the refund form (`refund-form.ts`) read the same
function. A payment made before discounts existed has no share (`null`) and
refunds its lines as before.

A discount line cannot be refunded on its own: the refund screen does not
offer it (`deriveRefundableLines`), and the core refuses it
(`RefundLineUnavailable`). Its amount comes back through the smaller net
amounts of the goods it was spread over. Nor is a line offered whose net
amount is zero, a free item or goods the discount took to nothing; a refund
of goods that comes to zero or less is refused (`RefundAmountInvalid`),
for the card terminal's and Qerko's refunds as well, which plan theirs
through `loadGoodsRefundPlan`.

A refund by amount is unchanged: it is limited by what the payment
received (refund/0005), which a discount has already lowered.

## Alternatives considered

- Refunding a goods line at its gross `totalAmount` and the discount line
  as a negative refund: a refund of the goods alone would give back more
  than was paid for them, and a negative refund has no meaning for cash, a
  card or EET.
- Spreading the discount again at refund time: it would depend on the
  algorithm as it is then, and could part from the VAT the payment's
  receipt and Qerko's `taxInfo` reported. The frozen share cannot.

## Consequences

Bills paid by several payments are refunded by amount only, until payments
record which lines they paid. A claim whose transaction was deleted still
counts here, though the payment's status ignores it.

Returning every goods line of a discounted payment gives back exactly what
the payment took for its goods, since the shares add up to the discount
(catalog/0003). A line's net amount is rounded pro rata when part of it
comes back, as its gross amount was before.

## Enforced by

- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > returns one of two beers and offers the rest`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > offers only an amount for a bill paid by two payments`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > returns a goods line of a discounted payment at its net amount, and never the discount line on its own`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableLines > leaves out tips and what was already refunded`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableLines > does not offer a free line`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableLines > offers a discounted goods line at its net amount, and neither the discount line nor a line it took to zero`
- `packages/core/src/modules/refund/refund-utils.test.ts > calculateRefundLineAmount > returns the rest of the line without a rounding remainder`
- `packages/core/src/modules/refund/refund-utils.test.ts > calculateRefundLineAmount > returns a discounted line's net amount, pro rata to the quantity returned`
- `packages/app-shared/src/refund-form.test.ts > refund availability (refund/0014, 0005) > offers items only from a bill's only payment`
- `packages/app-shared/src/refund-form.test.ts > refund availability (refund/0014, 0005) > offers a discounted line at its net amount, and never the discount line`
- `packages/app-shared/src/refund-form.test.ts > refund form > items of a discounted payment refund their net amount, pro rata`
