# 0007 A SwitchioPay card refund is recorded only once the terminal approved it

Status: accepted
Date: 2026-11-08

## Context

Finito takes card payments on the SwitchioPay terminal of the phone it runs
on and is to refund them to the card (plan `docs/plans/switchio-refund.md`).
The ECR protocol (v6.19.0) offers a referral refund (section 5.17): it names
the original payment by the `refundId` its result carried (payment/0009),
may return less than was paid, and is declined when the terminal cannot find
that payment, so the money cannot go to another card. Its result comes back
as an Android activity result on the phone that launched SwitchioPay, and on
no other: there is nothing to poll, as Qerko has. Android may kill Finito
while SwitchioPay is in front, and a cancelled result with no data may hide
a refund that went through (payment/0006). The terminal can be asked what
became of a transaction by its id (`get_transaction`, section 5.12).

## Decision

A refund to the card through SwitchioPay works like Qerko's (qerko/0004): it
starts as a `cardSwitchioRefundAttempt`, and the `refund` row, its goods
lines and the negative transaction on the card account are written together
only when the terminal approves. The same checks as any refund decide what
may be asked for, and a payment without a `refundId` cannot be refunded to
the card. On top:

- Each attempt has its own random id and its row is never reused, so the
  request id stored before SwitchioPay is launched never changes. A result
  that comes back late — restored after Android killed the app, or asked of
  the terminal — finds its attempt even after another one began.
- The refund's id is fixed when the attempt starts, and the money
  movement's derives from it, so the same approval written twice writes the
  same rows. A tip refund takes the tip's one id per payment (refund/0004).
- An approval is recorded without repeating the checks the start made: the
  money went back, so what the terminal did is recorded even when another
  device refunded part of the payment meanwhile, and the excess shows.
- A decline keeps the attempt as failed, to be shown; it blocks nothing. A
  refund the terminal never started (busy, not initialised, SwitchioPay not
  installed) leaves nothing. An unreadable answer leaves the attempt
  unknown, and it blocks another refund of the payment.
- The phone that launched an attempt asks its terminal about a pending or
  unknown one when nothing is waiting on SwitchioPay, and applies a definite
  answer. A pending attempt the terminal cannot account for becomes unknown.
  Whether the terminal's answer for an id it never saw can be read as "not
  refunded" is still to be checked on a device; until then it changes
  nothing.
- Staff can take an attempt away from any device after checking
  SwitchioPay, a pending one included, which is the only way out when the
  launching phone is gone. An approved result that comes back for it later
  is still recorded.

Only the launching phone writes an attempt's status; another device only
takes it away, through its own column, so the two never overwrite each
other.

## Alternatives considered

Qerko's single attempt row whose id is the refund's, which a new attempt
would overwrite, losing the request id a late result is matched by. A plain
refund without `refundId` (section 5.2), which could send money to any
card. Writing the refund at once and reversing it on a decline, rejected
for Qerko already (qerko/0004).

## Consequences

Queries over refunds, the sales statistics and EET need no change: EET
reverses a refund once its row exists, under the launching phone, which the
refund always names. A refund taken away and then recorded after staff had
also recorded it by hand is a duplicate the payment detail shows; a missing
one would not show. Payky labels these refunds but does not offer them.

## Enforced by

- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > records the refund and the money going out once the terminal approves`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > refunds the tip on its own, under the tip's one id`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > a declined refund is kept to be shown and does not block another try`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > a refund the terminal never started leaves nothing behind`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > an unknown result blocks another refund until staff dismiss it`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > a pending attempt of another phone can be dismissed`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > refuses a payment the terminal gave no refund id, or one not paid by card`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a refund result that comes back later > is recorded once, however often it is settled`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a refund result that comes back later > is recorded even after staff dismissed its attempt, since the money went back`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a refund result that comes back later > of an older attempt is recorded after another one began`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > a refund result that comes back later > is recorded even when another device refunded part of the payment meanwhile`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > asking the terminal what became of a refund > records an approval the terminal reports`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > asking the terminal what became of a refund > keeps a decline the terminal reports as failed`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > asking the terminal what became of a refund > turns a pending attempt nothing answers any more into an unknown one`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > asking the terminal what became of a refund > is not asked from a phone whose terminal never saw the refund`
- `packages/core/src/switchio.test.ts > interpretSwitchioRefundResult > reports a cancelled result with no payload as an unknown outcome, not a decline`
- `packages/core/src/switchio.test.ts > interpretSwitchioRefundResult > reports busy and not initialised as a refund that never started`
- `packages/core/src/switchio.test.ts > interpretSwitchioTransactionLookup > never takes an answer about another transaction for this one`
- `packages/core/src/switchio.test.ts > interpretSwitchioTransactionLookup > leaves everything else unknown, an answer for an unseen id included`
