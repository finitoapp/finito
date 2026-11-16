# 0025 A payment whose card attempt is unknown is canceled only once confirmed

Status: accepted
Date: 2026-11-16

## Context

A card attempt with an unknown outcome, on SwitchioPay or on Qerko's
terminal, may have charged the card (payment/0006). Another attempt on the
same payment therefore needs staff's confirmation that they checked the
terminal (`retryUnresolved`). Canceling the payment needed no such
confirmation. Staff could cancel it and charge a new payment for the same
bill, which charged the card a second time without the question payment/0006
exists to ask.

## Decision

`cancelPayment` refuses with `PaymentAttemptUnresolved` when the payment's
SwitchioPay or Qerko terminal attempt has an unknown outcome. It goes ahead
only when the caller passes `confirmUnresolved`, which records staff's
confirmation. Before canceling such a payment, both apps ask the way a
retry does: the last card attempt's result is unknown, so cancel only after
checking on the terminal that it did not go through.

A payment with no unknown attempt is canceled as before. A result that
arrives after the cancel still records its money (payment/0004).

## Alternatives considered

- **Refusing to cancel at all until the attempt is settled.** A terminal
  that never answers would then leave the payment, and the bill it locks,
  stuck.
- **Asking only in the app.** The check would then depend on each screen
  that cancels, so it belongs in the Task.

## Consequences

After an unknown card result, canceling takes one more confirmation. The
refusal names the attempt's request id, which the dialog shows, as the
retry dialog does.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > canceling a payment whose card attempt is unknown (payment/0025) > is refused until staff confirm they checked the terminal`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > canceling a payment whose card attempt is unknown (payment/0025) > needs no confirmation once the attempt is settled as declined`
- `packages/core/src/modules/payment/payment-qerko-actions.test.ts > qerko terminal payment > a payment whose attempt is unknown is canceled only once staff confirm they checked the terminal (payment/0025)`
