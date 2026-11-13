# 0020 A refused SwitchioPay launch is not an unknown outcome

Status: accepted
Date: 2026-11-13

## Context

Finito does not launch SwitchioPay while a launch of the same kind (a
payment, a closure, a refund) is still waiting on it, or while a result of
that kind nobody has settled yet is stored: a second launch would take the
first one's answer, or overwrite a result the terminal already gave
(payment/0008, payment/0011). Such a refused launch came back as an
unreadable result. A card payment had already written its attempt as
unresolved before the launch, so it then read as an unknown outcome
(payment/0006): staff were told the card might have been charged and had
to confirm a retry, although SwitchioPay never opened.

## Decision

A refused launch is its own error, `SwitchioLaunchRefused`. The native
module rejects with the code `SWITCHIO_LAUNCH_REFUSED` before it stores or
launches anything, and the app refuses the same cases before it calls the
module. Nothing left for the terminal, so:

- a card payment puts its row back as it was before the attempt: the
  previous attempt's request id and unresolved marker return, so a stored
  result of that attempt still finds its payment, and a payment with no
  earlier attempt is left with none. Staff see that SwitchioPay is busy and
  can simply try again;
- a refund to the card leaves no attempt behind, as one the terminal never
  started (refund/0007);
- a closure writes nothing and says SwitchioPay is busy.

Any other rejection of the module may still come after the terminal acted,
and stays an unknown outcome (payment/0006).

## Alternatives considered

Keeping the refusal an unreadable result, which asks staff to check
SwitchioPay and confirm a retry for a charge that never happened. Clearing
the unresolved marker on a refusal, which would drop the marker of an
earlier attempt whose outcome is still unknown.

## Consequences

Matches qerko/0003, where a refusal to start clears the attempt. The code is
shared by the Kotlin module, the app and the fake module end-to-end tests
use, and a test fails when the module and the app name it differently.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > a launch SwitchioPay refused (payment/0020) > leaves no unknown outcome behind, so the next attempt needs no confirmation`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > a launch SwitchioPay refused (payment/0020) > puts back the earlier attempt whose outcome is unknown, so its stored result still finds it`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > a refund SwitchioPay refused to launch leaves nothing behind and blocks nothing`
- `packages/core/src/modules/card-switchio-closure/card-switchio-closure-actions.test.ts > closeCardSwitchioBatch > reports a launch SwitchioPay refused as refused, not unknown, and writes nothing`
- `apps/native-app/src/platform/switchio-restore.test.ts > a launch SwitchioPay refused (payment/0020) > is refused, not unknown, while a payment result nobody settled is stored`
- `apps/native-app/src/platform/switchio-restore.test.ts > a launch SwitchioPay refused (payment/0020) > reads the Kotlin module's refusal as refused for a payment, a closure and a refund`
- `apps/native-app/src/platform/switchio-restore.test.ts > a launch SwitchioPay refused (payment/0020) > still reads any other rejection as an unknown outcome`
- `apps/native-app/src/platform/switchio.test.ts > uses the same launch-refused rejection code on both sides`
- `apps/native-app/src/platform/switchio.test.ts > refuses each launch before it stores or launches anything`
