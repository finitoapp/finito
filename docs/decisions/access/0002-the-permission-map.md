# 0002 The permission map

Status: superseded by access/0008
Date: 2026-10-08

## Context

Access control (access/0001) needs a fixed list of what a device can be
allowed to do, and every route and action has to land on one entry of it.
Several placements are not obvious and each was argued for.

## Decision

Seven permissions, typed as `Permission`, with labels kept complete by
`satisfies Record<Permission, TranslationKey>`:

| Permission | Covers |
|---|---|
| `sell` | home (pos, numpad), the bill including adding lines, splitting a bill, payment, tip |
| `activity` | payment and bill history, payment detail, retrying an EET delivery, the AI assistant |
| `discard` | discarding a bill, any cart write with a `remove` line, cancelling a payment |
| `refund` | refunds, the one offered on a collision included, and acknowledging an excess settlement |
| `confirm` | marking a cash or an IBAN payment paid by hand |
| `settings` | catalog (and creating an item from the bill page), categories, tables, legal entity, tax rates, number series, tips, home screen modes, support chat |
| `admin` | payment accounts and withdraw, accounts (switch, add, restore, transfer, remove another), profile, security, EET, Evolu export, debug console, AI data access, the Access section |

`free` routes: the settings list, language, theme, about (privacy, terms),
donations, and the layouts above them. Whatever a `free` route writes stays
on the device; the AI data access switch on the privacy page is gated by
`admin` as an action.

Why the less obvious ones sit where they do:

- **Any batch with a `remove` line is `discard`.** Removing lines one by
  one discards the bill. The cart writes `remove` lines through clear, undo
  and redo too, and undoing an added line appends one, so the check is on
  the lines about to be written, in one place in `use-cart-bill.ts`.
- **Splitting is `sell`**: it moves lines to another open bill and takes no
  money off the books.
- **Cancelling a payment is `discard`**: a keypad sale has no bill, so it
  is the only way to discard one.
- **`confirm` stands apart from `sell`**: "the transfer came" with no
  evidence is the usual way staff steal on a transfer payment. Confirming
  despite a cancellation stays `sell`: it marks no new money.
- **Excess settlement is `refund`**: acknowledging it silences the warning
  that would expose a false claim.
- **Payment accounts and EET are `admin`**: whoever edits them can drain
  the wallet, redirect later payments, or take the certificate that signs
  fiscal receipts.
- **Home screen modes and the bill page's create-item dialog are
  `settings`**: both write the account's synced data.
- **The payment and bill screens serve only an open one.** Opened on a paid
  or cancelled payment, or on a closed or cancelled bill (a typed URL,
  Back), they redirect to the activity screen, which needs `activity`. A
  bill with a cancellation collision stays, since confirming it is `sell`.
- **The AI assistant is `activity`**: its tools read the history.

An action with no route of its own calls `useRequirePermission` before it
acts (rule 15), which raises a one-shot PIN prompt when neither the device
nor the session grants it.

## Alternatives considered

Finer permissions (catalog apart from payment settings, for one). Code
works with a list of permissions, so a split later is a new value plus a
migration of stored sets.

## Consequences

- A shop without the FIO plugin confirms every IBAN payment by hand, so
  every one needs a device with `confirm` or the PIN.
- End-to-end tests hold the gates where staff take money: removing,
  clearing and undoing in the cart, discarding a bill, cancelling a payment,
  confirming cash and a transfer by hand, and refunds. The remaining action
  gates (excess settlement, confirming a payment or bill despite a
  cancellation, the bill page's create-item dialog, switching and removing
  accounts, withdraw, AI data access) are held by review. No preset grants
  `activity` without `sell`, so the cancellation gates matter only to a
  device whose permissions were edited by hand.

## Enforced by

- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > clearing the cart needs discard`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > undoing an added line needs discard, since it writes a remove`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > adding a line needs no discard`
- `apps/web-app/e2e/access.spec.ts > a refund asks for the PIN when its screen opens, naming the permission it needs`
- `apps/web-app/e2e/access-gates.spec.ts > every cart write that takes items off the bill asks a Basic device for the PIN`
- `apps/web-app/e2e/access-gates.spec.ts > cancelling a payment and confirming money by hand ask a Basic device for the PIN`
- `apps/web-app/e2e/bill.spec.ts > shows the right message for a closed or missing bill`
- `apps/web-app/e2e/bill.spec.ts > locks a bill while its payment is pending, and unlocks it once that payment is canceled`
