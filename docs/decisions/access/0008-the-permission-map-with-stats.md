# 0008 The permission map, with stats

Status: superseded by access/0010
Date: 2026-10-10

## Context

access/0002 fixed seven permissions. The sales statistics screen (`/stats`)
shows revenue, expected cash, what sells and how each device does, and it
has to land on one of them. Neither fits: `activity` is granted to every
Basic device, and revenue is more sensitive than a list of payments; the
screen changes nothing, so it is not `settings`. This adds an eighth
permission and narrows access/0002, which it supersedes.

## Decision

Eight permissions, typed as `Permission` in this order, with labels kept
complete by `satisfies Record<Permission, TranslationKey>`:

| Permission | Covers |
|---|---|
| `sell` | home (pos, numpad), the bill including adding lines, splitting a bill, payment, tip |
| `activity` | payment and bill history, payment detail, retrying an EET delivery, the AI assistant |
| `discard` | discarding a bill, any cart write with a `remove` line, cancelling a payment |
| `refund` | refunds, the one offered on a collision included, and acknowledging an excess settlement |
| `confirm` | marking a cash or an IBAN payment paid by hand |
| `stats` | the sales statistics screen |
| `settings` | catalog (and creating an item from the bill page), categories, tables, legal entity, tax rates, number series, tips, home screen modes, support chat |
| `admin` | payment accounts and withdraw, accounts (switch, add, restore, transfer, remove another), profile, security, EET, Evolu export, debug console, AI data access, the Access section |

The Manager preset grants `stats` and Owner grants every permission; Basic,
Staff and Shift lead do not. The statistics entry in the Activity header is
always shown, and the access gate asks for the PIN.

`free` routes: the settings list, language, theme, about (privacy, terms),
donations, and the layouts above them. Whatever a `free` route writes stays
on the device; the AI data access switch on the privacy page is gated by
`admin` as an action.

Why the less obvious ones sit where they do:

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

A stored permission set is decoded tolerantly: a value the build does not
know is dropped and the known ones are kept, instead of the whole set
counting as no permissions.

## Alternatives considered

- Finer permissions (catalog apart from payment settings, for one). Code
  works with a list of permissions, so a split later is a new value.
- Putting the statistics under `activity` or `settings`: see above.
- A data migration adding `stats` to every stored set that holds
  `settings`: rejected, see Consequences.

## Consequences

- **The AI assistant stays under `activity`, knowingly.** Its tools read the
  payment history, so a device with `activity` can have it derive revenue
  that the statistics screen would ask the PIN for. Gating it behind
  `stats` would take it from every Basic device; the owner accepted the gap.
- **No data migration for existing devices.** Migrations keep no record of
  having run (`packages/core/src/migrations/migrations.ts`), so one that adds `stats`
  to every set holding `settings` would add it back at every start after
  the owner removed it on purpose. A device saved as Manager before this
  change shows as a custom preset in Settings → Access until the owner
  reapplies Manager or Owner; until then it gets the statistics with the
  PIN, which still grants everything.
- **Tolerant decoding shipped first, in its own release.** A device on a
  build that decoded the whole set strictly treats a set holding `stats` as
  no permissions and locks out as soon as the owner grants it anywhere. The
  tolerant `decodePermissions` went out before `stats` existed, so most
  devices already drop the value they do not know. A device that skipped
  that release still locks out until it updates, and the PIN still opens it.
- **No notice about the new permission.** Settings → Access shows no banner
  or prompt about `stats`; the owner finds it in the device's permission
  list.
- A shop without the FIO plugin confirms every IBAN payment by hand, so
  every one needs a device with `confirm` or the PIN.
- End-to-end tests hold the gates where staff take money: removing,
  clearing and undoing in the cart, discarding a bill, cancelling a payment,
  confirming cash and a transfer by hand, and refunds, and the statistics
  gate. The remaining action gates (excess settlement, confirming a payment
  or bill despite a cancellation, the bill page's create-item dialog,
  switching and removing accounts, withdraw, AI data access) are held by
  review. No preset grants `activity` without `sell`, so the cancellation
  gates matter only to a device whose permissions were edited by hand.

## Enforced by

- `packages/core/src/modules/access/access-utils.test.ts > device permissions > an unknown permission is dropped and the known ones kept`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > clearing the cart needs discard`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > undoing an added line needs discard, since it writes a remove`
- `packages/app-shared/src/cart-lines.test.ts > linesNeedDiscard (access/0002) > adding a line needs no discard`
- `apps/web-app/e2e/stats.spec.ts > a Basic device opening the statistics gets the PIN prompt`
- `apps/web-app/e2e/stats.spec.ts > a Manager device opens the statistics without the PIN`
- `apps/web-app/e2e/access.spec.ts > a refund raises the one-shot PIN prompt naming the permission it needs`
- `apps/web-app/e2e/access-gates.spec.ts > every cart write that takes items off the bill asks a Basic device for the PIN`
- `apps/web-app/e2e/access-gates.spec.ts > cancelling a payment and confirming money by hand ask a Basic device for the PIN`
- `apps/web-app/e2e/bill.spec.ts > shows the right message for a closed or missing bill`
- `apps/web-app/e2e/bill.spec.ts > locks a bill while its payment is pending, and unlocks it once that payment is canceled`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before diagnostic account mutations`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires admin and sell before creating a diagnostic cash payment`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires confirm for both diagnostic cash settlements`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before adding a received account`
