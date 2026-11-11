# 0017 A payment offers only what its screen can settle

Status: accepted
Date: 2026-11-10

## Context

`createPayment` creates a payment only where at least one method it offers
can collect its goods once it rounds them (payment/0012). Two inputs to that
check differed from what the payment screen settles by, so a payment could
be created that nothing on its screen could take:

- For a bill, the check judged the bill's goods, while `markPaymentPaidCash`
  and the screen's cash tab judge the payment's own amount without its tip
  (`isCashPayable`). A payment of 0.40 against a bill of 100 CZK passed in a
  cash-only shop, and cash then refused it.
- The methods counted included the card terminal outside the native app and
  Qerko payments without a paired restaurant, although the screen shows no
  tab for either there. A browser with cash and a card terminal turned on
  created a payment of 0.40 CZK, which cash refused and no card tab took.

Such a payment sits on the wait screen until someone cancels it.

## Decision

- The methods a payment offers (`derivePaymentMethodsOffered`) are the ones
  the payment screen shows a tab for: the card terminal only where the
  creating device can drive it (`cardTerminalLinked`, true in the native
  app), Qerko payments only with the pairing's restaurant.
  `createPayment` takes `cardTerminalLinked` from the app that creates the
  payment and reads the pairing itself; it defaults to false, which the CLI
  and the browser are.
- The payment's own goods, its amount without its tip, are judged against
  those methods, and for a bill the bill's goods too (payment/0012), so a
  tip line still cannot lift goods that come to nothing.
- The cart's Charge (`deriveBillCheckout`) takes the same device checks.

## Alternatives considered

Leaving a payment no method on screen can take to be canceled by hand, which
is what happened. Having the wait screen show the card tab everywhere, which
renders a button that can never work outside the native app.

## Consequences

A browser or PWA in a shop whose only other method is the card terminal
refuses a CZK charge of 0.01–0.49, as a cash-only shop does. A partial bill
payment cash rounds to nothing is refused in a cash-only shop rather than
created. Another device of the same account may still settle a payment by a
method this one did not count; it is judged by the device that creates it.

## Enforced by

- `packages/core/src/modules/account/account-utils.test.ts > derivePaymentMethodsOffered > leaves out the card terminal where the device cannot drive it, and Qerko payments without a paired restaurant`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a payment cash rounds to nothing is not created where the card terminal is turned on but this device cannot show it`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > a bill payment is judged by its own amount, which is what settling it in cash judges`
- `packages/app-shared/src/bill-checkout.test.ts > deriveBillCheckout > counts the card terminal and Qerko payments only where the payment screen will show them`
