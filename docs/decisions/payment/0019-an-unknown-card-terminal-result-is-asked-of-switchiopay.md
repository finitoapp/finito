# 0019 An unknown card terminal result is asked of SwitchioPay

Status: accepted
Date: 2026-11-13

## Context

A SwitchioPay payment whose answer was lost or unreadable is an unknown
outcome (payment/0006): the card may have been charged, the attempt stays
unresolved, and another attempt needs staff to confirm they checked
SwitchioPay. Until now that check was all by hand, in the SwitchioPay app.
Finito runs on the payment terminal next to SwitchioPay, and SwitchioPay
answers questions about its own transactions by their request id
(`get_transaction`, ECR section 5.12). Finito already asks it about refunds
whose result was lost (refund/0007). There, tried on a device, the terminal
answered `FAILED`, "Transaction not found", for a reversal it had just
approved. Whether it answers a payment that never reached it in a way that
can be told apart has not been tried on a terminal yet.

## Decision

Finito asks SwitchioPay about a card payment whose outcome is unknown:

- right after a payment comes back unknown,
- at start-up and whenever the app comes back to the foreground, for each
  payment whose unknown attempt went to this device, once per run (asking
  opens SwitchioPay, whose return brings Finito to the foreground again),
- and when staff tap "Ask SwitchioPay" on the payment's card tab.

Only the device the attempt went to asks, since no other terminal saw it.
That device is written with each attempt before SwitchioPay is launched;
for a paid payment it stays the device that charged the card
(payment/0009). An attempt written before the device was kept is asked from
any device, which at worst learns nothing.

Only an approval of the transaction asked for is an answer. It is recorded
exactly as the approval itself would have been, through the same path, so
asking twice, or a restored result arriving as well, records the payment
once. Anything else — "not found", a decline, an answer about another
transaction, a reversal, an unreadable or missing answer — leaves the
outcome unknown, and charging the card again still needs staff's
confirmation. "Not found" is not read as "not charged" until a terminal
shows that SwitchioPay says so only of a payment it never started.

This adds a way out of an unknown outcome to payment/0006 and narrows
nothing in it: no answer is ever read as a decline. It is the SwitchioPay
counterpart of qerko/0003, where Qerko is polled instead.

## Alternatives considered

Clearing the attempt when the terminal does not find it, as the plan first
proposed. Rejected for now: SwitchioPay said "not found" of a reversal it
had approved, so the same answer for a payment could hide a charged card,
and the customer would be charged twice. Asking on every return to the
foreground, which never ends, since each question opens SwitchioPay.
Asking from any device, which cannot work: only the terminal that took the
attempt knows it.

## Consequences

Most unknown outcomes settle without staff, as soon as SwitchioPay confirms
the payment. One that SwitchioPay does not confirm still needs the check by
hand and the confirmed retry. Web (Payky) does not ask: its Capacitor bridge
has no `get_transaction`. What SwitchioPay answers for a payment that never
reached it, and whether it answers while busy, is to be verified on the
NEXGO terminal; if "not found" turns out to be reliable for payments, a new
decision can clear such an attempt.

## Enforced by

- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentLookup > reads an approval of the payment asked for as the payment's own result`
- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentLookup > never reads a payment the terminal does not confirm as not charged`
- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentLookup > never takes an answer about another transaction, or a reversal, for the payment`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > writes the device an attempt goes to before the terminal is launched`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > asking the terminal about an unknown result (payment/0019) > records an approval the terminal reports as the approval itself would be, once`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > asking the terminal about an unknown result (payment/0019) > keeps the outcome unknown, and the retry confirmation, on anything but an approval`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > asking the terminal about an unknown result (payment/0019) > is not asked from a device the attempt never went to`
- `apps/native-app/src/platform/switchio-restore.test.ts > asking SwitchioPay about a card payment (payment/0019) > reads the terminal's approval of the payment asked for`
- `apps/native-app/src/platform/switchio-restore.test.ts > asking SwitchioPay about a card payment (payment/0019) > is unknown when the terminal does not find it or the module refuses`
- `apps/native-app/src/platform/switchio-restore.test.ts > asking SwitchioPay about a card payment (payment/0019) > never interrupts a payment waiting on SwitchioPay`
