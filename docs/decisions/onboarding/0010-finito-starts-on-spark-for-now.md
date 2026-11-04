# 0010 Finito starts on Spark for now

Status: accepted
Date: 2026-11-04

## Context

onboarding/0009 had a fresh Finito account enable the Cashu wallet shared
with Linky instead of Spark, and the payment-method list kept quiet about
it. With the Bitcoin screen now viewing every wallet and naming the main
one (settings/0003), the shared wallet is one switch away, and the Spark
wallet Payky starts on is the one the rest of the product and its flows
are built around today.

## Decision

Finito alone; Payky keeps onboarding/0007.

- A newly onboarded Finito account enables cash and Spark, as Payky does
  (`finishOnboarding`); Cashu stays off until the Bitcoin screen's switch
  turns it on. The Linky-wallet variant of onboarding is removed.
- The default bitcoin wallet, for the methods list's switch and the
  Bitcoin screen's first tab, is Spark (settings/0003). "For now": the
  shared Linky wallet is expected to take the default back once its
  flows are as complete.

## Alternatives considered

- Keep starting on the Linky wallet (onboarding/0009): a fresh account on
  a wallet whose withdrawal and QR options are still being built.

## Consequences

- `apps/native-app/src/features/onboarding/onboarding-page.tsx` finishes
  through `finishOnboarding` alone.
- Maestro flows enable the Cashu wallet through the Bitcoin screen
  (`enable-cashu.yaml`).

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > enables cash and Spark without a bank account and leaves Cashu disabled`
- `packages/app-shared/src/bitcoin-payment-method.test.ts > one Bitcoin method (settings/0002) > starts on Spark for now (settings/0003)`
