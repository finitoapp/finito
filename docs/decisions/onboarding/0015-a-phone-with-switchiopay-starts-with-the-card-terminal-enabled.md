# 0015 A phone with SwitchioPay starts with the card terminal enabled

Status: accepted
Date: 2026-11-28

## Context

Onboarding enables cash and Spark without asking, and bank transfers when
an account is entered (onboarding/0007). Card payments over SwitchioPay
started off, so a merchant onboarding on a card terminal, or on a phone
that already runs SwitchioPay, had to find the switch in Settings > Payment
methods before taking the first card. The app already asks Android whether
anything answers the `switchio.pay.ECR` payment intent it launches, to warn
in settings when SwitchioPay is missing.

## Decision

Both apps; it adds to onboarding/0007 and changes none of its rules.

- When onboarding finishes, the device is asked whether it can launch
  SwitchioPay (the same intent probe as settings). If it can,
  `finishOnboarding` enables the card terminal in the onboarding currency;
  if it cannot, the card terminal stays off, as before.
- The probe is made at the finish, not when onboarding opens, so a
  SwitchioPay installed while the wizard waited counts.
- Onboarding shows no switch or copy about it, as with cash and Spark
  (onboarding/0006). Turning it off is a later settings action.
- Outside Android (the PWA, a browser) the probe answers no.

## Alternatives considered

- A switch in onboarding: a choice the device has already answered, the
  kind onboarding/0006 removed.
- Enabling it on any device that could later drive a terminal: a card tab
  on a phone without SwitchioPay, whose every launch fails.

## Consequences

- The stored method order is unchanged (bank transfer, card, Spark, Cashu,
  cash), so without a bank account the payment screen opens on the card
  instead of Spark.
- The probe proves SwitchioPay is installed, not activated or under
  contract; an unactivated SwitchioPay refuses the payment itself
  (payment/0020).
- The card account is account data and syncs; another device of the
  account without SwitchioPay meets it as it would after the switch had
  been turned on by hand.
- Restored accounts, transferred accounts and the demo account do not pass
  through `finishOnboarding` and are unaffected.
- The native Maestro flows `onboarding/card-terminal-with-switchio.yaml`
  and `onboarding/card-terminal-without-switchio.yaml` cover it end to end
  over the fake SwitchioPay.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > enables the card terminal in the account's currency when SwitchioPay was found`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > leaves the card terminal off when SwitchioPay was not found`
