# 0006 Finito's native modules carry Finito's name

Status: accepted
Date: 2026-11-14

## Context

brand/0001 made Payky and Finito two brands over one account and kept every
identifier the user never reads as it was, naming the `PaykyNfc` and
`PaykySwitchio` modules among them. Since then the native app has grown four
local Expo modules under `apps/native-app/modules` (NFC, the SwitchioPay
terminal, the account request to Payky, FLAG_SECURE), all of them Finito's
alone: no other app builds them, and none of their names is stored or
exchanged with another app. Their Payky name only told a reader they belong
to the other app, and every new module copied it to stay consistent
(account/0010's `payky-secure-screen`).

## Decision

Payky and Finito remain two names for one product, as brand/0001 decided.
They share the account, the recovery phrase, the Evolu data and sync, and the
`payky:` URIs a device transfer scans, so an account opens in either app.

The brand is a value in the source, not a build step:
`packages/app-shared/src/brand.ts` defines `paykyBrand` and `finitoBrand`,
and each app imports its own statically through its `core/app-brand.ts` (the
web app Payky, the native app Finito). Copy names the app only through brand
placeholders, which `createTranslate` fills from the app's brand.

**Finito's native modules are named after Finito**: the directory
`apps/native-app/modules/finito-<name>`, the Kotlin package
`fit.finito.<name>` under the app's own `fit.finito.app`, and the Expo module
name `Finito<Name>` (`FinitoNfc`, `FinitoSwitchio`, `FinitoAccountRequest`,
`FinitoSecureScreen`).

What such a module stores on the device or exchanges with another app keeps
its name, because renaming it would lose data or break the other side: the
SwitchioPay result stores' SharedPreferences (`payky_switchio`,
`payky_switchio_closure`, `payky_switchio_refund`), which an update must
still find, and everything of the account request that names Payky as the
counterpart (account/0008): the `me.payky` package it calls, the
`me.payky.action.SHARE_ACCOUNT` action, its extras and result codes, and the
`payky-account-request.ts` side of it that is named after Payky.

Every other identifier the user never reads stays as it is: the `@payky/*`
packages, `EXPO_PUBLIC_PAYKY_*` and `VITE_PAYKY_*`, local storage keys, the
`payky:` URI scheme and every Evolu name and derived id.

## Alternatives considered

Keeping the Payky module names (brand/0001): a reader of Finito's native code
took them for the web app's, and each new module had to repeat the mistake
to stay consistent.

Renaming every internal `payky` identifier with them: the packages and
environment variables are shared with the web app, and the URI scheme, the
local storage keys and the Evolu names are protocol and data that a shared
account must not lose.

Replacing "Payky" with "Finito" when building the native app, and separate
products with separate accounts: rejected for the reasons brand/0001 gives.

## Consequences

A new native module is `finito-<name>`. A module that stores data or talks
to another app keeps those names when it is renamed, and says why beside
them. The web app's Capacitor plugins (`NfcPlugin`, `SwitchioPlugin`,
`AccountSharePlugin`) are Payky's and keep their names. A new user-facing
mention of the app goes through a brand placeholder, never a literal name. A
third brand is one more `Brand` value with the forms of its name.

## Enforced by

- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > names the app only through brand placeholders`
- `packages/app-shared/src/i18n/brand-copy.test.ts > brand copy > declines the name by the case the copy names`
- `apps/native-app/src/core/app-brand.test.ts > the native app's code shows no Payky`
- `apps/native-app/src/core/app-brand.test.ts > the native app's web export names no Payky`
- `apps/native-app/src/core/app-brand.test.ts > Finito's native modules carry Finito's name`
