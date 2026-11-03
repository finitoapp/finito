# 0009 Finito starts on the Linky wallet

Status: accepted
Date: 2026-11-03

## Context

Onboarding enables cash and Spark (onboarding/0006, onboarding/0007), so a
fresh account takes bitcoin into a Spark wallet nobody else holds. Finito
offers bitcoin as one method with a wallet to choose, Cashu first
(settings/0002): the wallet shared with Linky, the one its owner already
carries, which Fazole uses as well. A Finito merchant who turns Bitcoin on
should land in that wallet without a second choice, and the row should
read "Bitcoin" with nothing about the technology behind it.

## Decision

Finito alone; Payky keeps onboarding/0007.

- A newly onboarded Finito account enables cash and the Cashu wallet shared
  with Linky; Spark stays off (`finishOnboardingOnLinkyWallet`). The stored
  order and default are onboarding/0007's.
- The account is onboarded first and the wallet enabled after it: a wallet
  that cannot be enabled (its shards unreachable) leaves an onboarded
  account whose Bitcoin row is off, which the settings fix with one switch,
  not an account stuck in onboarding.
- The payment-method list names no wallet technology for the Linky wallet:
  the Bitcoin row's status is empty while it is the wallet in use, and the
  wallet choice on the Bitcoin screen calls it the Linky wallet, not Cashu.

## Alternatives considered

- Keep Spark first and let the merchant switch: one more screen before the
  first bitcoin payment, into a wallet they will switch away from.
- Enable both: two bitcoin tabs on the payment screen (settings/0002).

## Consequences

- `apps/native-app/src/features/onboarding/onboarding-page.tsx` finishes
  through the Cashu run and falls back to `finishOnboarding` (Spark) when
  that run cannot be made.
- Maestro flows that enable Cashu through the Bitcoin switch find it on
  already on a fresh account.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboardingOnLinkyWallet > enables the Cashu wallet shared with Linky instead of Spark (onboarding/0009)`
