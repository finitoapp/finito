# 0002 Onboarding does not ask for a recovery-phrase backup

Status: accepted
Date: 2026-10-14

## Context

A new account's recovery phrase is the only way to get the account back on
another device. Onboarding used to end on a screen that showed the phrase
and would not finish until the merchant ticked that they had saved it. That
asks for a backup before the merchant has anything worth backing up, at the
moment they most want to start selling.

## Decision

Onboarding of a new account ends on the payment-methods step; it neither
shows the phrase nor asks for a confirmation. The phrase stays available in
Settings > Security. Prompting the merchant to back it up later is
`account/0007`: a reminder after the first paid payment.

## Alternatives considered

- Keep the confirmation step: it was a checkbox most people tick without
  writing anything down.

## Consequences

Until the first payment brings the reminder, a merchant who never opens Settings >
Security and loses the device loses the account.

## Enforced by

- `packages/app-shared/src/onboarding-form-state.test.ts > getOnboardingSteps > includes the setup steps for a new account`
- `apps/web-app/e2e/onboarding.spec.ts > complete onboarding as a new account, without backing up the recovery phrase`
