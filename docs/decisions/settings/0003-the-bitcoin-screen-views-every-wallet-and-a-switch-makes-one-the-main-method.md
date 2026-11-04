# 0003 The Bitcoin screen views every wallet and a switch makes one the main method

Status: accepted
Date: 2026-11-04

## Context

settings/0002 made the three bitcoin wallets one "Bitcoin" method whose
screen chooses the wallet with a segmented control: tapping a segment
switched the wallet at once. A merchant looking at the Spark wallet's
balance or the Lightning address's form could not do so without making it
the wallet customers pay into, and the row in the methods list said
nothing for the Linky (Cashu) wallet. The Cashu wallet's QR always carried
both legs, which a merchant whose customers' wallets read only one of them
could not change.

## Decision

Finito alone; Payky keeps its three rows.

- **The segments only look.** The Bitcoin screen's tabs (Cashu, Lightning
  address, Spark) show that wallet's settings; switching tabs changes no
  account.
- **A "Main method" switch on each wallet** makes it the one the payment
  screen offers and turns the others off in the same run; off turns
  bitcoin off altogether, as the Bitcoin switch in the methods list does.
  The Lightning address's switch waits for a saved address; saving one
  no longer selects it.
- **Spark is the default, for now**: the wallet the methods list's Bitcoin
  switch turns on from off, and the tab the screen opens on while none is
  the main one.
- **The methods list names the main wallet** beside "Bitcoin": "Cashu",
  "Spark", or the Lightning address itself.
- **The Cashu wallet's QR carries both legs unless narrowed**: the wallet
  settings choose both (the default), the Cashu request alone or the
  Lightning invoice alone, stored on the Cashu account
  (`accountCashu.paymentRequestLegs`); one leg alone is written bare, not
  as a `bitcoin:` URI.

## Alternatives considered

- Keep the tabs switching: no way to look at a wallet without choosing it.
- A "Set as main" button instead of a switch: no way to turn bitcoin off
  from the wallet's own screen.
- Cashu as the default (settings/0002, onboarding/0009): deferred; the
  shared Linky wallet is one switch away.

## Consequences

- `apps/native-app/src/features/settings/payment-accounts/bitcoin-settings-page.tsx`
  holds the tabs and the switch; `useBitcoinWallet.select` is still the
  one place the three accounts are switched from Finito's UI.
- `buildCashuPaymentUri` takes the legs; the payment screen reads them
  from the Cashu account row.
- Maestro flows that need the Cashu wallet open the Bitcoin screen, pick
  the Cashu tab and turn its switch on (`enable-cashu.yaml`); a saved
  Lightning address is made the main method the same way.

## Enforced by

- `packages/app-shared/src/bitcoin-payment-method.test.ts > one Bitcoin method (settings/0002) > starts on Spark for now (settings/0003)`
- `packages/app-shared/src/bitcoin-payment-method.test.ts > one Bitcoin method (settings/0002) > folds the three wallets into one row where the first of them sits`
- `packages/core/src/modules/account/account-cashu-legs.test.ts > the Cashu account's payment QR legs (settings/0003) > start as both and narrow to one leg on the account row`
- `packages/core/src/modules/cashu/cashu-cross-app.test.ts > cross-app Cashu vectors (shared with Linky) > the payment QR narrows to one leg when the Cashu account says so (settings/0003)`
