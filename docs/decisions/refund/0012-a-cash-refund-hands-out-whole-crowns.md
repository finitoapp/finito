# 0012 A refund from the cash register hands out whole crowns

Status: accepted
Date: 2026-11-09

## Context

A CZK cash total is rounded to the whole crown (see payment/0002), so cash
can only be handed back in whole crowns. A storno is a message with a
negative amount whose other details follow the real state (GFŘ seminar for
developers, slide 58), so it must carry the money actually handed back.

refund/0006 prefilled a refund from the cash register in whole crowns and
recorded whatever staff confirmed as the cash handed back. That held for a
typed amount, but not for the whole payment (refund/0010), which returns
the goods left and the tip exactly: a card payment of 57.90 with a 5.80 tip
returned in cash recorded 63.70, which nobody can hand out, moved 63.70 out
of the cash register and sent 63.70 in the storno. 0006's rules about the
prefill still hold and are carried over here.

## Decision

A refund keeps the exact amount it gives back, so a whole refund refunds the
whole payment and the refunded state and the statistics count what was
returned. A refund from the cash register also records the cash it hands
out (`refundCashRegister.handedAmount`, beside the refund under its id, in
the same batch): what it gives back rounded as a cash total is, to the whole
crown, 50 haléř up, for CZK, exact for any other currency
(`deriveCashRefundHandedAmounts`). It may exceed what was left by less than
half a crown, which is the business's, as a payment's rounding is. The cash
register's account transaction and the storno carry the cash handed out.

Returned together, the goods and the tip are handed out as one rounded sum:
the tip's record hands out its exact tip and the goods' record the rest, as
the goods are what the storno reverses whoever the tip belongs to (eet/0011),
so the storno carries the cash handed back either way. A tip refunded alone
and a part hand out their own amount rounded. The refund screen names the
cash to hand out and says it is rounded when it differs from the amount on
the confirm button.

When a CZK payment is refunded from the cash register, the refund screen
prefills a part in whole crowns, 50 haléř up, or one crown lower when that
would exceed what is left, so a typed amount is usually what is handed out.
The limit stays as refund/0005 sets it, so the rounding the customer paid
can still be returned.

## Alternatives considered

Rounding the recorded amount instead, as 0006 did for a typed amount. A
whole refund would record 64.00 of a 63.70 payment, above what is left, or
63.00 and leave it partly refunded. Rounding each record on its own. The
goods and the tip of one whole refund could each round up, handing out a
crown more than their sum rounded. Capping a refund of goods at the charge
(rejected by 0006). A 78.90 sale paid with 79 could then record only 78.90
while 79 goes back in coins.

## Consequences

The cash register balance drifts from the money refunded by the rounding,
as it does for payments (payment/0001), the other way. The storno stays
capped at what the payment's sales reported (eet/0011), so a rounding up
beyond a sale paid by card is not sent. A cash refund written by an older
version has no cash detail: it handed out its amount, which its storno
carries, so no migration is needed. A tip of less than half a crown refunded
alone in cash hands out nothing and sends no storno. Returning only the
goods of a payment whose cash was rounded up leaves the rounding with the
business, still reported in EET, and shows the payment partly refunded. The
prefill follows the chosen method until staff type an amount, so a refund
outside Payky is offered exactly.

## Enforced by

- `packages/core/src/modules/refund/refund-utils.test.ts > deriveCashRefundHandedAmounts > hands out $handed for $goods goods and a $tip tip in $currency`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundPrefillAmount > prefills $prefill of $remaining $currency left for a refund $method`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundPayment > hands out $handed for a part of $amount $currency from the cash register`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > hand out a tip refund from the cash register in whole crowns`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > hands a whole $currency payment out of the cash register, the sum rounded once`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses the cash a whole refund from the cash register handed out, $name`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses the whole crowns a tip refund from the cash register handed out`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses the amount of a cash refund recorded without the cash handed out`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals > reverses the whole crowns a cash refund of a transfer handed out`
- `packages/app-shared/src/refund-form.test.ts > describeRefundOutcome > cash names the $handed handed out for $choice of $amount $currency (refund/0012)`
- `apps/web-app/e2e/eet.spec.ts > a payment settled twice reports the extra money, and refunding it reverses only that`
