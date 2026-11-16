# 0022 Money an outside system took is recorded whatever became of its account

Status: accepted
Date: 2026-11-16

## Context

When an outside system reports that it took money for a payment, Payky
records the money on the account the attempt was made with. Three systems
do this:

- **SwitchioPay** approves a card. The approval can arrive through the
  launch's promise, a result restored after Android killed the app
  (payment/0008) or the terminal's answer to a lookup (payment/0019).
- **Qerko's terminal** approves a card.
- **Qerko** reports an online payment as `PAID`.

Recording went through `markPaymentPaid`, which first checks that the
account is still turned on in the payment's currency. That check is right
when staff confirm money by hand. For money the system has already taken,
it is wrong.

Turning a payment method off deletes its account. Switching its currency
deletes it too, because each of these accounts has an id derived from its
currency. If either happened between the start and the answer, recording
failed with the account's not-found error. The attempt stayed unresolved or
open, and every later poll, lookup or restored result failed the same way.
The customer had paid, but the payment stayed unpaid for good.

## Decision

Money an outside system has taken is recorded through `markPaymentCharged`.
It writes the same account transaction and claim as `markPaymentPaid`, in
one batch, but without checking the account. The money is recorded on the
account the attempt was made with. Its currency is the payment's, which is
the currency the system charged in. The system has already taken the
money, so no later change to the account can undo it.

Starting a new attempt still checks the account (`payPaymentWithSwitchioCard`,
`startQerkoTerminalPayment`, and preparing a payment method). A payment
cannot be started on a method that is turned off or set to another
currency.

## Alternatives considered

- **Recording the money on the method's account as it is now.** That
  account may not exist, and if it does, it is in another currency than
  the charge.
- **Failing with a dedicated error and asking staff to settle it by hand.**
  The money is known to have moved, so there is nothing for staff to
  decide.

## Consequences

A payment can be paid on an account that has since been deleted. Its
detail screen then shows no account name, just as it does for any payment
whose account was removed after the money arrived.

The errors for a missing account or a currency mismatch no longer appear
where money is recorded: Switchio's restored and looked-up results, Qerko's
terminal polls and Qerko payment settlement. The screens that handled them
there no longer name them.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records the money on the account the card was charged on, though card payments were turned off meanwhile`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records the money in the payment's currency, though the card terminal switched currency meanwhile`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records an approval the terminal answered when asked, after card payments were turned off`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records a restored approval after card payments were turned off`
- `packages/core/src/modules/payment/payment-qerko-actions.test.ts > qerko terminal payment > an approval that arrives after %s still records the money on the account it was charged on (payment/0022)`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > PAID after %s still records the money on the account Qerko took it on (payment/0022)`
