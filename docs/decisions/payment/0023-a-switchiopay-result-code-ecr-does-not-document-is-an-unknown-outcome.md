# 0023 A SwitchioPay result code ECR does not document is an unknown outcome

Status: accepted
Date: 2026-11-16

## Context

SwitchioPay answers with an Android activity result code. ECR (section 3.3)
documents four of them: -1 success, 0 failure, 1 not initialised and
2 terminal busy. Every answer is read by the same rules for a payment, a
closure and a refund (`classifySwitchioOutcome`). Those rules read any code
but success as a decline, including a code ECR does not document at all,
such as 3, -2 or one that a later SwitchioPay adds.

A decline clears the attempt's unresolved marker, so the next attempt needs
no confirmation (payment/0006). If the terminal had in fact charged the card
under such a code, staff were told it was declined and could charge the
customer again.

## Decision

Only a documented code is read as a definite outcome:

- -1 is success.
- 0 with the terminal's own answer is a failure.
- 1 and 2 are a failure, because they come before the terminal does anything.

A code ECR does not document is an unknown outcome, whatever answer it
carries, even one that says `"OK"`. The rule is shared, so it holds for a
payment, a closure, a refund and a reversal alike:

- A card payment keeps its attempt unresolved. Staff must confirm before
  the card is charged again, and the terminal can be asked about the
  attempt (payment/0019).
- A refund keeps its attempt unknown (refund/0007).
- A closure is not recorded.

## Alternatives considered

- **Reading an undocumented code by the `responseCode` it carries.** A code
  with no documented meaning gives no reason to trust the rest of its
  answer either.
- **Keeping undocumented codes a decline.** The cost of that mistake is a
  customer charged twice. The cost of an unknown outcome is one
  confirmation.

## Consequences

If a later SwitchioPay starts using a new code for an ordinary decline,
staff get the "check SwitchioPay" warning instead of "declined" until the
code is added to `switchioFailureCodes`.

## Enforced by

- `packages/core/src/switchio.test.ts > a result code ECR does not document (payment/0023) > is an unknown outcome, never a decline, %s`
- `packages/core/src/switchio.test.ts > every SwitchioPay answer (payment/0006) > reads %s the same for a payment, a closure and a refund`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > keeps an attempt answered with a code ECR does not document unknown, so the next one needs confirmation (payment/0023)`
