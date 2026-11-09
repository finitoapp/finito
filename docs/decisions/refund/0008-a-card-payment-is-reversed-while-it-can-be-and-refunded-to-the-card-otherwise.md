# 0008 A card payment is reversed while it can be, and refunded to the card otherwise

Status: accepted
Date: 2026-11-08

## Context

SwitchioPay offers two ways to give a card payment's money back (ECR
protocol v6.19.0). A reversal (section 5.13) takes the whole original
transaction back, tip included — there is no partial one — and only on the
terminal that took it, until its batch is closed. A referral refund (section
5.17) returns any amount up to the payment to the card that paid, by the
payment's `refundId` (refund/0007). Neither needs the customer's card
again: both were made without it on a device. A reversal
costs the business less than a refund. A cancel (storno) interrupts a
payment still in progress; it is not a way to give money back, and Finito
does not make one.

## Decision

Finito reverses a SwitchioPay payment whenever it can, and refunds it to the
card only when it cannot (`chooseSwitchioRefundKind`). It reverses when all
of these hold:

- everything the card was charged goes back, goods and tip together: the
  payment screen offers this as one step, "refund the whole payment";
- nothing of the payment was refunded before, by any method;
- the phone asking is the one whose SwitchioPay charged the card
  (`paymentCardSwitchio.deviceId`, payment/0009);
- that phone has recorded no closure of its batch since it recorded the
  approval (`cardSwitchioClosure.closedAt` after `approvedAt`, both by its
  own clock, so the phone never reads a stale closure of its own).

Anything else — part of the goods, the tip alone, another phone, an earlier
refund, a closure since — is a referral refund. The whole payment refunded
to the card is one referral refund of goods and tip together.

A reversal names the approved attempt's `transactionId`, always: without it
the terminal reverses its last transaction, whatever that is. A reversal's
goods refund has the payment's one id (`refund:reversal:<payment>`) and its
tip the tip's (refund/0004), so two reversals of one payment, or a reversal
written twice, record it once.

A closure made outside Finito (in SwitchioPay, or its automatic one) is not
known to it, so the terminal may decline a reversal Finito chose. Any
declined reversal then offers a refund to the card, whatever the terminal's
reason (after a closure it answers `TransactionInvalidData`, "Trn not
found"); it is started again as a referral refund, not chosen anew. A
reversal of a payment already taken back — by an attempt whose result was
lost — is declined the same way, so before offering the refund Finito asks
the terminal about the payment: when it reads as reversed (`isReversed`),
its money is back, and the reversal is recorded instead of refunding twice.

## Alternatives considered

Always a referral refund, which is simpler but costs more for the most
common return, a whole payment the same day. Reversing a part of a payment,
which the protocol does not have. Deciding the closure from the terminal's
answer alone, without Finito's own closures, which would send a reversal it
knows to be declined. Telling a closed batch apart by `responseCode`, which
is not documented; it only sharpens the message.

## Consequences

The reversed payment leaves the batch's debits; a referral refund shows in
its credits, which the closure's reconciliation can count. A whole payment
once partly refunded can only be refunded to the card. The screen does not
ask for the card either way.

## Enforced by

- `packages/core/src/modules/refund/refund-switchio-utils.test.ts > chooseSwitchioRefundKind > reverses the whole payment on the phone that charged it, before its batch closed`
- `packages/core/src/modules/refund/refund-switchio-utils.test.ts > chooseSwitchioRefundKind > refunds to the card when %s`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > takes the whole payment back on the phone that charged it, tip included`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > reverses a refund of every goods amount of a payment without a tip`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > two reversals of one payment write one refund of the goods and one of the tip`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > refunds to the card when %s`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > refunds the whole payment to the card as one refund from another phone`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > refunds to the card once the charging phone closed its batch`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > refunds to the card what is left after an earlier refund`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > a reversal the terminal declines lets a refund to the card follow`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > a declined reversal of a payment already taken back is recorded, not refunded again`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a reversal before the refund to the card (refund/0008) > a restored answer that is not a reversal leaves the reversal unknown`
- `packages/core/src/switchio.test.ts > interpretSwitchioReversalResult > takes an approval that says it is no reversal as an unknown outcome`
- `apps/native-app/src/platform/switchio.test.ts > takes a payment back through the v8 reversal intent, never without the original`
