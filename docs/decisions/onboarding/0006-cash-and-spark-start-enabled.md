# 0006 Cash and Spark start enabled

Status: superseded by onboarding/0007
Date: 2026-10-16

## Context

The cash and Bitcoin switches in business setup repeat defaults that new
merchants can adjust later in settings. They also require selection state
and validation solely to prevent a merchant from disabling every method.

## Decision

Onboarding shows the optional business name and optional bank account,
without cash or Bitcoin switches or a message about their defaults.
The finish-onboarding Task always enables the cash register in the chosen
currency and the Spark account. It takes no flags for these methods.
Cashu stays disabled and can be enabled later in payment-method settings.

This supersedes onboarding/0005. An empty method selection is no longer
possible, so its UI and Task validation are removed. A blank or whitespace-only
bank input skips bank transfers; a nonblank input must be a valid Czech
account number or IBAN, stored as IBAN. Validation still precedes business-name
publication, and the finish labels distinguish starting with or without bank
transfers. The profile publication rules of onboarding/0016 remain in effect.

With a bank account, the initial method order is bank transfer, card, Spark,
Cashu, cash, and bank transfer is the default. Without a bank account, Spark
is the default and the order is Spark, Cashu, bank transfer, card, cash. This
keeps Cashu immediately after Spark even when the default moves to the front.
Only enabled and available methods are offered during payment.

Existing onboarded accounts retain their enabled methods and stored order.
Restoring or transferring an onboarded account does not apply these defaults.

## Alternatives considered

- Keep the switches: two choices that duplicate the defaults.
- Keep an explanation of automatic enablement: unnecessary onboarding copy.
- Reorder existing accounts: would overwrite the merchant's preferences.

## Consequences

A merchant can finish without a bank account and immediately accept cash and
Bitcoin. Disabling either method is a later settings action. Cashu is placed
next to Spark before it is enabled.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > enables cash and Spark without a bank account and leaves Cashu disabled`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > writes no row on an onboarded account`
- `packages/app-shared/src/onboarding-utils.test.ts > onboarding payment method order > places Cashu immediately after Spark with bank transfer first`
- `packages/app-shared/src/onboarding-utils.test.ts > onboarding payment method order > keeps Cashu immediately after Spark when bank transfer is off`
- `apps/web-app/e2e/onboarding.spec.ts > onboarding enables cash and Spark with bank transfers`
- `apps/web-app/e2e/onboarding.spec.ts > onboarding enables cash and Spark without bank transfers`
- `apps/web-app/e2e/onboarding.spec.ts > the payment methods step derives bank transfers from the account input`
