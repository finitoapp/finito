# 0002 Finito offers one Bitcoin method with a wallet to choose

Status: superseded by settings/0003
Date: 2026-11-03

## Context

Payky lists bitcoin three times among the payment methods: Spark
(labelled "Bitcoin"), Cashu and the merchant's own Lightning address,
each with a switch, a place in the order and a settings screen. To a
merchant they are one thing, taking bitcoin, and the choice between them
is which wallet the money lands in. Three rows also let two of them be on
at once, which showed the customer two bitcoin tabs that differ only in
the wallet behind them.

## Decision

Finito alone; Payky keeps the three rows.

- **One "Bitcoin" row**, with the bitcoin icon, in the payment-method
  list. Its switch turns bitcoin on or off; it is reordered as one, and
  the stored order keeps the three wallets together where the row sits
  (`groupPaymentMethodOrder`, `expandPaymentMethodOrder`).
- **At most one wallet is on.** Its screen offers Cashu, the Lightning
  address and Spark as a single choice; picking one switches the others
  off in the same run. Picking the Lightning address shows its form when
  none is saved yet, and saving the address is what picks it.
- **Cashu is the default**: the wallet the switch turns on from off. A
  wallet chosen earlier is not remembered across an off and on.
- **The customer sees "Bitcoin"** on the payment screen's tab whichever
  wallet is behind it, with the bitcoin icon.
- The row's status names the wallet in use, or the Lightning address.

## Alternatives considered

- Remembering the last wallet across off and on: a setting for a case
  that is rare, and the default is one tap away.
- Keeping the three tabs' own labels on the payment screen: the merchant
  turned on "Bitcoin" and would look for that word.
- Three rows under a "Bitcoin" heading: still three switches to keep in
  step.

## Consequences

- `useBitcoinWallet` (`src/features/settings/payment-accounts/`) is the
  one place the three accounts are switched from Finito's UI; the
  standalone Cashu, Lightning address and Spark routes stay for their
  sub-screens and e2e links, their bodies shared with the Bitcoin screen.
- Onboarding still enables Spark (`finishOnboarding`), so a fresh
  account's Bitcoin row starts on Spark; the default applies to the
  switch.
- Maestro flows enable Cashu through the Bitcoin switch and open the
  wallet screens through the Bitcoin row.

## Enforced by

- `packages/app-shared/src/bitcoin-payment-method.test.ts > one Bitcoin method (settings/0002) > folds the three wallets into one row where the first of them sits`
- `packages/app-shared/src/bitcoin-payment-method.test.ts > one Bitcoin method (settings/0002) > expands the row back to the wallets in their stored order`
- `packages/app-shared/src/bitcoin-payment-method.test.ts > one Bitcoin method (settings/0002) > moves the Bitcoin row as one, past a method or not at all at the edge`
