# 0033 The card tab opens the terminal when staff switch to it

Status: accepted
Date: 2026-11-28

## Context

On the payment screen, the card tab only offered a button that opens
SwitchioPay. Staff who picked the card tab had already said the customer
pays by card, so the tap on the button was one step too many at every card
payment.

Opening SwitchioPay is not free, though. It covers the whole screen, and
closing it with Back answers `RESULT_CANCELED` with no data. That is an
unknown outcome (payment/0006). The attempt stays unresolved until
SwitchioPay is asked about it (payment/0019), and the next attempt needs
staff to confirm it. A terminal that opens when nobody meant it leaves such
an attempt behind.

The screen opens on the first method in the merchant's order. When that is
the card, the card tab is on screen without anyone choosing it.

## Decision

The card terminal's account chooses when the card tab opens SwitchioPay by
itself, under Payment methods → Payment card (`accountCardSwitchio.autoLaunch`):

- **As soon as the payment opens** (`open`): when the screen opens on the
  card tab, and when staff switch to it.
- **On switching to card** (`select`): only when staff tap the card tab.
  This is the default, kept as `null` until the account chooses.
- **Only with the button** (`button`): never.

"Opens on the card tab" means the tab the screen showed first, not the first
method in the order. The terminal opens once, as soon as the tab is
prepared, and not again after SwitchioPay answers. The button stays for
another attempt.

The terminal never opens by itself while the last attempt's outcome is
unknown. That attempt may have charged the card, so another one waits for
staff to confirm it from the button (payment/0019).

The choice is the account's and syncs to every device. It applies the same
way in both apps.

## Alternatives considered

- **Open the terminal on a card terminal by default and with the button on a
  phone**, telling the two apart by the device maker as settings/0008 does.
  A tap on the card tab says what staff want on either device. The rule
  about the tap also needs no device detection, which the web app cannot do.
- **Open the terminal whenever the card tab shows, by default.** A merchant
  whose first method is the card would land in SwitchioPay at every payment,
  even one the customer pays in cash. Every such payment would leave an
  unresolved attempt after Back.
- **A choice per device.** No merchant has asked for different behavior on
  two devices of one account.

## Consequences

- With `open`, a payment the customer pays another way first has to close
  SwitchioPay. Closing it with Back leaves an attempt to check. The option
  says so.
- With `open`, a payment screen that opens again on the card tab opens the
  terminal again, for example after Android ended the app during a payment
  and the result was a decline.
- The card account's id derives from its currency, so changing the
  currency starts a new account with the default choice.

## Enforced by

- `packages/core/src/modules/account/account-utils.test.ts > cardTerminalOpensItself > by default only a switch to the card tab opens the terminal`
- `packages/core/src/modules/account/account-utils.test.ts > cardTerminalOpensItself > open also opens it with the screen, button never does`
- `packages/core/src/modules/account/account-utils.test.ts > cardTerminalOpensItself > an attempt whose outcome is unknown waits for the button`
