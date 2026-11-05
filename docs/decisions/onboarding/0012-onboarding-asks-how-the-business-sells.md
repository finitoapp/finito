# 0012 Onboarding asks how the business sells, with tips on unless switched off

Status: accepted
Date: 2026-11-05

## Context

A new account opened on the keypad with both home modes on (settings/0001),
so a counter business met a switch to a tables grid it never uses, and a
business that sells at tables started on a keypad it rarely needs. Which
of the two a business uses is plain to its owner and hard to guess, and
the onboarding already sets the account up for selling. Tips started on
without the owner having been asked.

## Decision

Payky and Finito alike.

- **Setting up a new account ends with "How do you sell?"**, after the
  business's name and bank account: the final amount on a keypad, or bills
  built from items. Each choice is a card with a picture of it. Opening an
  existing account (restore, transfer, from Payky) never asks: that
  account has its settings already.
- **Nothing is preselected.** Finishing stays unavailable until one of the
  two is picked, so the choice is made, not overlooked.
- **The choice is the one mode home offers.** There is no "both" card; a
  business that wants both turns the other on under Settings › Home
  screen, which then shows the switch on home.
- **Tips are a switch on the same step, on by default.**
- The business's name is published and the account written only on this
  last step, so going back to the name and account loses nothing.

## Alternatives considered

- A third card for both modes: the choice would read as a setting rather
  than a question about the business, and most businesses use one.
- Preselecting the keypad: the merchant could finish without noticing the
  question.
- Asking about tips on a step of their own: one switch does not earn a
  screen.

## Consequences

- The onboarding form holds `homeMode` (`null` until picked) and
  `tipsEnabled`; `finishOnboarding` writes them in the same batch as the
  rest of the settings (`enabledHomeModesJson` with the one mode).
- The business-details step continues instead of finishing; the profile
  publish failure and its retry moved to the last step.
- Accounts seeded for tests or the demo keep every mode on; only the
  onboarding narrows the set.

## Enforced by

- `packages/app-shared/src/onboarding-form-state.test.ts > how the business sells (onboarding/0012) > is asked last when setting up an account, never when opening one`
- `packages/app-shared/src/onboarding-form-state.test.ts > how the business sells (onboarding/0012) > starts with no way of selling chosen and tips on`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > offers home only the mode the merchant chose and keeps their tips choice`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > starts with tips on when the merchant leaves them on`
- `apps/web-app/e2e/onboarding.spec.ts > a new account picks how it sells before it can finish, and home opens in that mode alone`
