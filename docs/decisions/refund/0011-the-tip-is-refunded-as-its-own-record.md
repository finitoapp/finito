# 0011 The tip is refunded as its own record, alone or with the goods

Status: accepted
Date: 2026-11-09

## Context

refund/0004 made the tip its own refund: a refund by amount did not say what
it returned, and a tip returned as an amount was reversed in EET like goods.
It refunded the tip by a separate action, so returning everything took two
confirmations, goods and tip. The refund screen (refund/0010) returns the
whole payment in one step, which 0004's consequences ruled out. Its rules
about the tip still hold and are carried over here.

## Decision

A refund by amount or by items returns goods only, so its limit and its
prefilled amount leave out the payment's tip. The tip is refunded as a record
of its own: the whole tip, once per payment, under the tip's one id
(`refund:tip:<payment>`), by any method, whoever it belongs to. It is
refunded alone ("only the tip") or beside the goods when the whole payment is
returned, which writes two records, the goods' and the tip's, in one step.
The partly or fully refunded state counts goods only, and the refund list
labels a tip refund as the tip.

## Alternatives considered

A rule about what an amount returns first. Goods first is the error above,
and tip first shrinks the storno of a returned item by the tip. A "part of it
is the tip" field on every refund by amount, which every refund of a tipped
payment would carry and a field left at its default would repeat the error.
Offering the tip refund only for a tip that belongs to the business, which
would record a card terminal's refund of the whole charge short by the
employees' tip. One refund row for a whole payment, goods and tip together,
which would bring back the error above.

## Consequences

Returning everything takes one confirmation (refund/0010). While goods
remain, staff can still enter the tip's amount as goods under part, which is
reversed as goods; the whole payment and "only the tip" on the refund screen,
and the note that part leaves the tip out, are what steer them to the tip's
own record. How a tip refund reaches EET is eet/0011. In cash, the whole tip
is the tip the cash brought above the goods (see payment/0003).

## Enforced by

- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > leave the tip out of a refund by amount`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > leave the tip out of the cash received`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > return the whole tip once, in cash from the cash register`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > return the tip after all the goods`
- `packages/core/src/modules/refund/refund-actions.test.ts > refunds of a payment with a tip > refuse a tip refund without a tip or before the payment is paid`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > records the goods and the tip as two refunds in one batch`
- `packages/core/src/modules/refund/refund-actions.test.ts > refundWholePayment > writes only the tip once the goods are all back`
- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundableTipAmount > offers the whole tip until a tip refund returns it`
- `packages/core/src/modules/refund/refund-utils.test.ts > summarizeRefundsByPayment > leaves a tip refund out of the refunded state`
- `apps/web-app/e2e/eet.spec.ts > a refunded tip reaches EET only while tips belong to the business`
- `apps/web-app/e2e/refund.spec.ts > refund a whole payment in cash: the goods and the tip come back as two refunds`
