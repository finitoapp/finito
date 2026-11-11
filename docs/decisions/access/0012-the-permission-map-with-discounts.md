# 0012 The permission map, with discounts

Status: accepted
Date: 2026-11-10

## Context

access/0010 made any cart write with a `remove` line `discard`, because it
lowers the bill's total: removing lines one by one discards the bill. A
catalog item may now cost less than nothing, a discount of a fixed amount
sold as an ordinary item (catalog/0002). Its line is an `add` line below
zero, so it lowers the total as much as a `remove` line does, and under
access/0010 anyone with `sell` could take a bill down to nothing with it.
This takes over access/0010's map, which it supersedes, and makes the rule
about what a cart write lowers rather than about its kind of line.

## Decision

Nine permissions, typed as `Permission` in this order, with labels kept
complete by `satisfies Record<Permission, TranslationKey>`:

| Permission | Covers |
|---|---|
| `sell` | home (pos, numpad), the bill including adding lines, splitting a bill, payment, tip |
| `activity` | payment and bill history, payment detail, retrying an EET delivery, the AI assistant |
| `discard` | discarding a bill, any cart write with a `remove` line or a line below zero, moving a line below zero by a split, cancelling a payment |
| `refund` | refunds, the one offered on a collision included, and acknowledging an excess settlement |
| `confirm` | marking a cash or an IBAN payment paid by hand, closing the card terminal's batch (access/0011) |
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
- **Any batch that lowers the bill's total is `discard`**: one with a
  `remove` line, or with a line below zero. Removing lines one by one
  discards the bill, and so does adding a discount as large as the bill.
  The cart writes `remove` lines through clear, undo and redo too, undoing
  an added line appends one, and a discount reaches the bill by a tap, a
  scan, a redo, or an undo that puts a removed discount back. So the check
  is on the lines about to be written (`linesNeedDiscard`: `kind ===
  "remove" || totalAmount < 0`), in one place in `use-cart-bill.ts`. A tap
  or a scan is checked on the item's price before the bill row is created.
- **The core refuses a discount the cart did not check for.** The cart
  judges a tap on the catalog row it shows, and the core reloads the row to
  price the line. `addCatalogItemToBill` takes the sign the cart judged and
  refuses the add (`CatalogItemPriceSignStale`) when the reloaded row is a
  discount where the cart saw none, or the other way round, so a stale row
  cannot let a discount through without `discard`.
- **Splitting is `sell`**: it moves lines to another open bill and takes no
  money off the books. Moving a line below zero is `discard`
  (`splitNeedsDiscard`): the target receives it as an `add` line, which
  lowers its total like a discount added by a tap.
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
nor the session grants it. The prompt names what is asked for: removing
items when a `remove` line is written, adding a discount otherwise, moving
a discount for a split.

A stored permission set is decoded tolerantly: a value the build does not
know is dropped and the known ones are kept, instead of the whole set
counting as no permissions.

## Alternatives considered

- Leaving the catalog under `settings`: see access/0010.
- A data migration adding `catalog` to every stored set that holds
  `settings`: rejected, see Consequences.
- A permission of its own for discounts: a discount lowers the bill like
  removing an item does, and a tenth switch would let staff who may not
  remove an item still take its price off.
- Gating the creation of a discount item only (`catalog`): whoever may sell
  could still add an existing discount to any bill.

## Consequences

- **No data migration for existing devices.** Migrations keep no record of
  having run (`packages/core/src/migrations/migrations.ts`), so one that
  adds `catalog` to every set holding `settings` would add it back at every
  start after the owner removed it on purpose. A device saved as Manager
  before access/0010 shows as a custom preset in Settings → Access until
  the owner reapplies Manager or Owner; until then it opens the catalog
  with the PIN, which still grants everything.
- **Tolerant decoding has already shipped**, before `stats` (access/0008),
  so a device on a current build drops `catalog` if it does not know it
  instead of locking out.
- **Finito gates alike.** Its catalog screens sit under `/catalog` too, and
  its route map gates them with `catalog`, since both brands read the same
  device permissions. Its cart and split check a discount as web's do.
- **No notice about the new permission.** Settings → Access shows no banner
  or prompt about `catalog`; the owner finds it in the device's permission
  list.
- **Removing a discount takes `discard` too**, though it raises the total:
  a `remove` line is checked by its kind, not by what it does to the total.
  It keeps the rule one line, and the person who added the discount held
  `discard` anyway.
- **A bill below zero can only be discarded** (payment/0015), which needs
  `discard`; whoever took it there held it already.
- **The core's sign check is best effort**, like every guard: it compares
  with the row this device has synced. An older app, which knows nothing of
  discounts, checks nothing (catalog/0002).
- The AI assistant stays under `activity`, knowingly, as in access/0008.
- End-to-end tests hold the gates where staff take money, the statistics
  gate and the catalog gate. The remaining action gates (excess
  settlement, confirming a payment or bill despite a cancellation, the bill
  page's create-item dialog, switching and removing accounts, withdraw, AI
  data access) are held by review; adding a discount is held end to end,
  and adding or moving one by the unit tests below and the ordering checks
  of both carts.

## Enforced by

- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0012) > adding a line needs no discard`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0012) > clearing the cart needs discard`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0012) > undoing an added line needs discard, since it writes a remove`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0012) > adding a discount by a tap or a scan needs discard`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0012) > undoing and redoing a discount need discard`
- `packages/app-shared/src/cart-lines.test.ts > cartWriteDiscardAction > names removing items whenever a remove line is written, adding a discount otherwise`
- `packages/app-shared/src/split-selection.test.ts > split selection > a selection with a discount line in it needs discard, goods alone do not (access/0012)`
- `packages/core/src/modules/bill/bill-actions.test.ts > bills with a discount > refuses adding an item whose price became a discount, or stopped being one, since the cart saw it (access/0012)`
- `apps/web-app/src/features/bill/use-cart-bill.test.ts > a tap or a scan checks discard on the item's price before the bill row is created`
- `apps/web-app/src/features/bill/use-cart-bill.test.ts > removing, clearing, undo and redo check discard on the lines they write`
- `apps/web-app/src/features/bill/use-cart-bill.test.ts > a split that moves a discount asks for discard before it writes`
- `apps/native-app/src/features/bill/use-cart-bill.test.ts > a tap or a scan checks discard on the item's price before the bill row is created`
- `apps/native-app/src/features/bill/use-cart-bill.test.ts > removing, clearing, undo and redo check discard on the lines they write`
- `apps/native-app/src/features/bill/use-cart-bill.test.ts > a split that moves a discount asks for discard before it writes`
- `packages/core/src/modules/access/access-utils.test.ts > access presets (access/0012) > the catalog is granted from Manager up, and to no lower preset`
- `apps/web-app/e2e/catalog-items.spec.ts > a Basic device opening the catalog gets the PIN prompt`
- `packages/core/src/modules/access/access-utils.test.ts > device permissions > an unknown permission is dropped and the known ones kept`
- `apps/web-app/e2e/stats.spec.ts > a Basic device opening the statistics gets the PIN prompt`
- `apps/web-app/e2e/stats.spec.ts > a Manager device opens the statistics without the PIN`
- `apps/web-app/e2e/access.spec.ts > a refund asks for the PIN when its screen opens, naming the permission it needs`
- `apps/web-app/e2e/access-gates.spec.ts > every cart write that takes items off the bill asks a Basic device for the PIN`
- `apps/web-app/e2e/access-gates.spec.ts > tapping a discount on the bill asks a Basic device for the PIN`
- `apps/web-app/e2e/access-gates.spec.ts > cancelling a payment and confirming money by hand ask a Basic device for the PIN`
- `apps/web-app/e2e/bill.spec.ts > shows the right message for a closed or missing bill`
- `apps/web-app/e2e/bill.spec.ts > locks a bill while its payment is pending, and unlocks it once that payment is canceled`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before diagnostic account mutations`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires admin and sell before creating a diagnostic cash payment`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires confirm for both diagnostic cash settlements`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before adding a received account`
