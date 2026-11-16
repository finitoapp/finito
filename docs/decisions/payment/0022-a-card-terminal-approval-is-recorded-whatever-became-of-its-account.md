# 0022 A card terminal approval is recorded whatever became of its account

Status: accepted
Date: 2026-11-16

## Context

An approval from SwitchioPay is recorded as money on the card account the
attempt was made with. That approval can arrive through the launch's
promise, a result restored after Android killed the app (payment/0008) or
the terminal's answer to a lookup (payment/0019). Recording it went through
`markPaymentPaid`, which first checks that the account is still turned on in
the payment's currency. That check is right when staff confirm money by hand.
For a card the terminal has already charged, it is wrong.

Turning card payments off deletes the card account. Switching the
terminal's currency deletes it too, because a card account's id is derived
from its currency. If either happened between the launch and the approval,
the approval failed with `CardSwitchioAccountNotFound` and the attempt's
unresolved marker stayed set. Every later lookup or restored result failed
the same way. The card was charged, but the payment stayed unpaid for good.

## Decision

An approval is recorded through `markPaymentCharged`. It writes the same
account transaction and claim as `markPaymentPaid`, in one batch, but
without checking the account. The money is recorded on the account the
attempt was made with and in the payment's currency, which is the currency
the card was charged in. The terminal has already taken the money, so no
later change to the account can undo it.

Launching a new card payment still checks the account
(`payPaymentWithSwitchioCard`). A payment cannot be started on a card
terminal that is turned off or set to another currency.

## Alternatives considered

Recording the money on the card account as it is now. That account may not
exist, and if it does, it is in another currency than the charge. Failing
the approval with a dedicated error and asking staff to settle it by hand.
The money is known to have moved, so there is nothing for staff to decide.

## Consequences

A payment can be paid on an account that has since been deleted. Its
detail screen then shows no account name, just as it does for any payment
whose account was removed after the money arrived. The restored-result
screens no longer name `CardSwitchioAccountNotFound` or
`AccountCurrencyMismatch`, because those errors can no longer reach them.
Qerko's terminal and its online payments still check the account before
recording money they have already taken. They are not changed here.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records the money on the account the card was charged on, though card payments were turned off meanwhile`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records the money in the payment's currency, though the card terminal switched currency meanwhile`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records an approval the terminal answered when asked, after card payments were turned off`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > an approval after its card account changed (payment/0022) > records a restored approval after card payments were turned off`
