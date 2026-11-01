# 0001 Payky and Finito are two brands over one account

Status: accepted
Date: 2026-11-01

## Context

The web app on payky.me and its Capacitor shell (`me.payky`) ship as Payky.
The native app in `apps/native-app` (Expo, React Native) and the PWA exported
from it ship as Finito, on finito.fit and app.finito.fit, with the Android
package `fit.finito.app`. Both apps share `packages/core` and the copy in
`packages/app-shared`, and a merchant must be able to move between them.

## Decision

Payky and Finito are two names for one product. They share the account, the
recovery phrase, the Evolu data and sync, and the `payky:` URIs a device
transfer scans, so an account opens in either app.

The brand is a value in the source, not a build step: `packages/app-shared/src/brand.ts`
defines `paykyBrand` and `finitoBrand`, and each app imports its own
statically through its `core/app-brand.ts` (the web app Payky, the native app
Finito). Copy names the app only through brand placeholders, which
`createTranslate` fills from the app's brand.

Identifiers the user never reads stay as they are: the `@payky/*` packages,
`EXPO_PUBLIC_PAYKY_*` and `VITE_PAYKY_*`, the `PaykyNfc` and `PaykySwitchio`
modules, local storage keys, the `payky:` URI scheme and every Evolu name and
derived id.

## Alternatives considered

Replacing "Payky" with "Finito" when building the native app: rejected. The
word is also protocol and data (`payky:pair`, `payky-device-settings`), which
a shared account must not lose; a replace cannot decline the name in Czech
and Slovak; and the tests would check source that differs from what ships.

Separate products with separate accounts: rejected, a merchant moving to
Finito would have to start over.

## Consequences

A new user-facing mention of the app goes through a brand placeholder, never
a literal name. Renaming an internal identifier is never part of a brand
change. A third brand is one more `Brand` value with the forms of its name.

## Enforced by

- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > names the app only through brand placeholders`
- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > declines the name by the case the copy names`
- `apps/native-app/src/core/app-brand.test.ts > the native app's code shows no Payky`
- `apps/native-app/src/core/app-brand.test.ts > the native app's web export names no Payky`
