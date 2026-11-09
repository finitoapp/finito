# 0006 A card terminal failure without an answer is an unknown outcome

Status: accepted
Date: 2026-10-18

## Context

SwitchioPay returns its result as an Android activity result: a result code
and, usually, the terminal's own JSON answer. Code 0 is documented as a
failure, and Payky treated it as a decline: it cleared the attempt's
unresolved marker and told staff the card was declined. But Android also
answers 0, with no data, when the terminal app crashes or is killed, and
when it was already running and, with the reorder-to-front flag Payky uses,
the result comes back at once while the terminal still takes the card. A
charged card then showed as an unpaid payment with no warning.

## Decision

A result code 0 with no readable answer from the terminal is an unknown
outcome, never a decline: the attempt stays unresolved and staff are told to
check SwitchioPay before charging again. Code 0 with the terminal's own
answer is still a decline, and so are the busy and initialisation codes,
which are known to precede any charge.

## Alternatives considered

Keeping code 0 as a decline, which was rejected because the cost of the
mistake is a customer charged twice or a sale lost, against a confirmation
that is asked once after a real cancel.

## Consequences

After staff cancels on the terminal, the next attempt asks for a
confirmation that SwitchioPay was checked. It applies on every platform that
drives the terminal, web in the Android app and the native app alike.

## Enforced by

- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentResult > reports a failure result code with no payload as an unknown outcome, not a decline`
- `packages/core/src/switchio.test.ts > interpretSwitchioPaymentResult > still reports a failure result code with the terminal's own answer as declined`
- `packages/core/src/switchio.test.ts > every SwitchioPay answer (payment/0006) > reads %s the same for a payment, a closure and a refund`
