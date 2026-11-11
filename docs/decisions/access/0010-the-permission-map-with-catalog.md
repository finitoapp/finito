# 0010 The permission map, with catalog

Status: superseded by access/0012
Date: 2026-11-03

## Context

access/0008 put the catalog (items, categories, tables, and creating an
item from the bill page) under `settings`, together with the business
details, taxes, number series, tips and the home screen modes. The catalog
is now a tab of its own in the menu section (navigation/0001), and it is
what a shop hands to a manager or a chef long before the tax setup: what is
on sale, at what price, at which table. Keeping it in `settings` would make
the owner grant both or neither. This adds a ninth permission and narrows
access/0008, which it supersedes.

## Decision

Nine permissions, typed as `Permission` in this order, with labels kept
complete by `satisfies Record<Permission, TranslationKey>`:

| Permission | Covers |
|---|---|
| `sell` | home (pos, numpad), the bill including adding lines, splitting a bill, payment, tip |
| `activity` | payment and bill history, payment detail, retrying an EET delivery, the AI assistant |
| `discard` | discarding a bill, any cart write with a `remove` line, cancelling a payment |
| `refund` | refunds, the one offered on a collision included, and acknowledging an excess settlement |
| `confirm` | marking a cash or an IBAN payment paid by hand |
| `stats` | the sales statistics screen |
| `catalog` | the catalog under `/catalog`: items, categories, tables, and creating an item from the bill page |
| `settings` | legal entity, tax rates, number series, tips, home screen modes, support chat |
| `admin` | payment accounts and withdraw (Cashu included, access/0009), accounts (switch, add, restore, transfer, remove another), profile, security, EET, Evolu export, debug console, AI data access, the Access section |

The Manager preset grants `stats`, `catalog` and `settings`; Owner grants
every permission; Basic, Staff and Shift lead grant neither `catalog` nor
`settings`. Every tab of the menu section is always shown, the catalog's
included, and the access gate asks for the PIN.

`free` routes: the settings list, language, theme, about (privacy, terms),
donations, notifications, and the layouts above them. Whatever a `free`
route writes stays on the device; the AI data access switch on the privacy
page is gated by `admin` as an action.

Why the less obvious ones sit where they do:

- **`catalog` stands apart from `settings`**: editing what is sold and at
  what price is everyday work a shop delegates, while the business details,
  taxes and number series are set once and feed the fiscal receipts.
- **The bill page's create-item dialog is `catalog`**: it writes a catalog
  item, the same row the catalog screens write.
- **`stats` stands apart from `activity` and `settings`**: revenue and the
  takings of a day are more sensitive than a list of payments, and the
  screen writes nothing.
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
- **Home screen modes are `settings`**: they write the account's synced
  data.
- **The payment and bill screens serve only an open one.** Opened on a paid
  or cancelled payment, or on a closed or cancelled bill (a typed URL,
  Back), they redirect to the activity screen, which needs `activity`. A
  bill with a cancellation collision stays, since confirming it is `sell`.
- **The AI assistant is `activity`**: its tools read the history.

An action with no route of its own calls `useRequirePermission` before it
acts (rule 15), which raises a one-shot PIN prompt when neither the device
nor the session grants it.

A stored permission set is decoded tolerantly: a value the build does not
know is dropped and the known ones are kept, instead of the whole set
counting as no permissions.

## Alternatives considered

- Leaving the catalog under `settings`: see above.
- A data migration adding `catalog` to every stored set that holds
  `settings`: rejected, see Consequences.

## Consequences

- **No data migration for existing devices.** Migrations keep no record of
  having run (`packages/core/src/migrations/migrations.ts`), so one that
  adds `catalog` to every set holding `settings` would add it back at every
  start after the owner removed it on purpose. A device saved as Manager
  before this change shows as a custom preset in Settings → Access until
  the owner reapplies Manager or Owner; until then it opens the catalog
  with the PIN, which still grants everything.
- **Tolerant decoding has already shipped**, before `stats` (access/0008),
  so a device on a current build drops `catalog` if it does not know it
  instead of locking out.
- **Finito gates alike.** Its catalog screens sit under `/catalog` too, and
  its route map gates them with `catalog`, since both brands read the same
  device permissions.
- **No notice about the new permission.** Settings → Access shows no banner
  or prompt about `catalog`; the owner finds it in the device's permission
  list.
- The AI assistant stays under `activity`, knowingly, as in access/0008.
- End-to-end tests hold the gates where staff take money, the statistics
  gate and the catalog gate. The remaining action gates (excess
  settlement, confirming a payment or bill despite a cancellation, the bill
  page's create-item dialog, switching and removing accounts, withdraw, AI
  data access) are held by review.

## Enforced by

- `packages/core/src/modules/access/access-utils.test.ts > access presets (access/0010) > the catalog is granted from Manager up, and to no lower preset`
- `apps/web-app/e2e/catalog-items.spec.ts > a Basic device opening the catalog gets the PIN prompt`
- `packages/core/src/modules/access/access-utils.test.ts > device permissions > an unknown permission is dropped and the known ones kept`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > clearing the cart needs discard`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > undoing an added line needs discard, since it writes a remove`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > adding a line needs no discard`
- `apps/web-app/e2e/stats.spec.ts > a Basic device opening the statistics gets the PIN prompt`
- `apps/web-app/e2e/stats.spec.ts > a Manager device opens the statistics without the PIN`
- `apps/web-app/e2e/access.spec.ts > a refund asks for the PIN when its screen opens, naming the permission it needs`
- `apps/web-app/e2e/access-gates.spec.ts > every cart write that takes items off the bill asks a Basic device for the PIN`
- `apps/web-app/e2e/access-gates.spec.ts > cancelling a payment and confirming money by hand ask a Basic device for the PIN`
- `apps/web-app/e2e/bill.spec.ts > shows the right message for a closed or missing bill`
- `apps/web-app/e2e/bill.spec.ts > locks a bill while its payment is pending, and unlocks it once that payment is canceled`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before diagnostic account mutations`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires admin and sell before creating a diagnostic cash payment`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires confirm for both diagnostic cash settlements`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before adding a received account`
