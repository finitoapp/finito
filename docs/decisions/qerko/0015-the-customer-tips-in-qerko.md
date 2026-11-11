# 0015 The customer tips in Qerko

Status: accepted
Date: 2026-11-11

## Context

Qerko walks a Qerko payment through `paymentStart`, `paymentProcessed` (it
wants the receipt) and `paymentClosed` with a final state. Its states are
`STARTED`, `PROCESSING`, `AUTHORIZED`, `PAID` and `CANCELLED`, and the
reference SDK also knows `ERROR`. Qerko's API v4 does not return its fee.
`qerko/0008` recorded the money only on `PAID` and no tip, since the bill
allowed none: the tip from Payky's tip screen went to Qerko as an item
"Spropitné", and the customer could not tip in Qerko.

What Qerko does with a tip, read in its backend:

- Its `Payment` carries `tipBrutto`, the tip the customer paid, and
  `tipNetto`, the same less Qerko's commission on it, as decimal strings,
  `"0"` without a tip. Neither has to do with VAT.
- The tip is in no item; the parts carry it: they add up to the items, the
  tip, less a discount.
- The tip is fixed when Qerko creates its payment, so `paymentStart` already
  carries it; `paymentProcessed` and `paymentClosed` carry only ids.
- The receipt Qerko draws is the POS's items and `taxInfo`, nothing else, so
  a tip the POS does not list is not on it.
- A Qerko bill has no field for a tip already chosen: a tip set on Payky's
  tip screen cannot reach Qerko but as an item.
- A restaurant that takes Qerko without its receipt gets `tipBrutto` `"0"`.
- Cancelling a paid Qerko payment returns all of it, the tip included.

A Payky payment has a fixed amount, its tip included, before a method is
chosen, and money above the amount reads as an overpayment. A tip added in
Qerko on top of it would show as paid more than once, overpay the bill, be
reported to EET as extra money even when tips belong to employees
(`eet/0005`), and be refunded as goods.

## Decision

- Qerko is offered the payment's goods, its amount less its tip
  (`qerko/0014`), with `allowTip` true, and the customer tips in Qerko. The
  payment's own tip never goes to Qerko as an item, nor on the receipt.
  Paying through Qerko, the tip is the one the customer chose there, zero
  included.
- `paymentStart` is checked against the goods. It records `tipBrutto` as the
  attempt's `tipAmount` and `tipNetto` as its `tipNetAmount`, written once
  with its start (`qerko/0013`); a missing one reads as zero.
- The receipt lists the bill's items alone, the goods. Neither the
  payment's own tip nor the one the customer chose in Qerko is an item on
  it or in any VAT row.
- The money is recorded only when Qerko says `PAID`, from `paymentClosed` or
  from `get-payment`, through `markPaymentPaid` with what the parts add up
  to. Any other final state, one Qerko adds later included, is a failed
  payment. `paymentProcessed` answers the receipt and records nothing.
- When the parts less `tipBrutto` are exactly the payment's goods, Qerko's
  tip replaces the payment's own (`payment/0018`): the payment's `tipAmount`
  becomes `tipBrutto` and its amount the goods plus it, a zero tip included.
  `tipBrutto` is read from Qerko's `Payment`, or from the attempt when the
  `Payment` lacks it. When the sums do not match, the money is recorded as
  charged and the difference shows as an overpayment or a shortfall.
- Neither Qerko's fee nor its commission on the tip (`tipBrutto` less
  `tipNetto`) is recorded as money; `tipNetAmount` stays on the attempt.

## Alternatives considered

- Recording at `paymentProcessed`: Qerko can still cancel the payment after
  it.
- Sending the tip from Payky's tip screen as an item and allowing no tip in
  Qerko (`qerko/0008`, `qerko/0014` before this): the customer cannot tip in
  Qerko, and a customer who would tip there pays the tip staff typed.
- Allowing a tip in Qerko on top of a bill that carries the Payky tip: the
  customer would be asked for a tip twice, and Qerko's tip would read as an
  overpayment.
- Recording Qerko's tip as an overpayment: it overpays the bill, reaches EET
  as extra money and is refunded as goods.
- Recording `tipNetto` as the tip: the customer paid `tipBrutto`, the other
  Qerko integrations record it, and Qerko's other fees are not deducted
  either.
- Rewriting the payment whatever the parts add up to: a part payment or a
  discount Qerko let through would then be taken for a tip.

## Consequences

`paymentClosed` carries only the state, so a `PAID` is read with
`get-payment` for what was charged and by whom. The money lands before the
attempt is closed, so a crash in between leaves a paid payment with a
thinner trail, not money taken that reads as unpaid. Once paid, a Qerko
payment's amount and tip are what the customer paid, so EET, a refund (the
tip apart, `refund.isTip`), the bill's coverage, the statistics and the
history read the tip like any other. Staff who set a tip on Payky's tip
screen and then let the customer pay through Qerko see it replaced. A card
terminal's tip (`qerko/0002`) is unchanged and still reads as an
overpayment.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > PAID records what Qerko charged, once, whoever reports it`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > %s is a failed payment, no money`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > marks the attempt processing and answers a receipt that adds up`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > Qerko payment states > %s is %s`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoBill > lets the customer tip in Qerko and offers only the goods, never the payment's tip`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > readQerkoTip > reads %j as %s and %s`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > deriveQerkoChargedTip > money that is %s takes the tip %s, %s`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > lists a covered bill's lines at their totals, no tip among them`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > leaves the payment's own tip off the receipt`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > resolveQerkoBill > offers the goods alone and lets the customer tip in Qerko, whatever tip the payment carries`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > checks the items against the payment's goods, not its tip`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > records Qerko's tip with the start, once`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > processQerkoPayment > lists neither the customer's Qerko tip nor the payment's own on the receipt`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > takes the customer's Qerko tip in place of the payment's own and closes its bill as paid: %s`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > records the money as charged when it is not the goods and Qerko's tip`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > reads the customer's tip from the attempt when the Payment carries none`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: extra money > reports a payment the customer tipped in Qerko without the tip or extra money while tips belong to employees`
- `packages/core/src/modules/refund/refund-qerko-payment-actions.test.ts > refundQerkoPayment > returns the tip the customer chose in Qerko as the tip, not the one Payky's screen set`
