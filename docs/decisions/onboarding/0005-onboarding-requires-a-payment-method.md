# 0005 Onboarding requires a payment method

Status: superseded by onboarding/0006
Date: 2026-10-16

## Context

After onboarding/0003 made bank transfers follow an optional account input,
a merchant could switch off both cash and Bitcoin, leave the account blank,
and finish onboarding with no way to take a payment.

## Decision

A new account must enable at least one of cash, Bitcoin, or bank transfers
before onboarding can finish. Bank transfers count only with a valid Czech
account number or IBAN. The form checks this on submission, leaves the finish
button enabled, and shows an inline error beside the methods. The error goes
away once a valid method is selected. An invalid account also keeps its own
validation message.

Validation happens before publishing the business name (onboarding/0016).
The finish-onboarding Task independently rejects an empty method selection
before writing any rows. Later payment-method settings are unchanged.

This supersedes onboarding/0003 while preserving its other rules: the bank
input is always visible and has no checkbox; blank or whitespace-only input
skips bank transfers when another method is enabled; a nonblank account
must be valid and is stored as IBAN. The finish labels still distinguish
starting without bank transfers from starting with them, and the first
enabled method in the onboarding method order remains the default.

## Alternatives considered

- Disable the finish button: it gives no explanation for being unable to proceed.
- Automatically enable cash: it would accept a payment method the merchant
  explicitly switched off.
- Validate only in the UI: another caller could still create an unusable setup.

## Consequences

A merchant who wants only bank transfers must enter a valid bank account.
A merchant without a bank account can start with cash or Bitcoin alone.
Invalid forms neither publish a profile name nor create partial account rows.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > refuses an empty payment-method selection before writing any row`
- `apps/web-app/e2e/onboarding.spec.ts > onboarding requires a payment method and accepts cash alone`
- `apps/web-app/e2e/onboarding.spec.ts > onboarding requires a payment method and accepts btc alone`
- `apps/web-app/e2e/onboarding.spec.ts > onboarding requires a payment method and accepts iban alone`
- `apps/web-app/e2e/onboarding.spec.ts > the payment methods step derives bank transfers from the account input`
