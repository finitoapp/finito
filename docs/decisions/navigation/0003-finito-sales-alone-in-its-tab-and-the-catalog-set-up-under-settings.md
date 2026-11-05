# 0003 Finito: Sales alone in its tab, the catalog set up under Settings, a category made on the item

Status: superseded by navigation/0004
Date: 2026-11-03

## Context

navigation/0002 made Sales, the tables-and-bills grid, the catalog tab's
root, with Items, Categories and Tables as tabs beside it. Selling staff
open that tab many times a day and only ever need the grid; the three
lists are set-up work the owner does once, and the tab bar above the grid
cost height on a phone for the two screens nobody used while selling. The
bill, started from a table or the "no table" strip, was counted as the
terminal's, so the rail jumped from Sales to the calculator the moment a
table was opened. And a category needed a screen of its own before an
item could be put in it, although Linky makes a contact group from the
name typed on the contact, which is where the merchant is when the need
comes up.

## Decision

Finito alone; Payky keeps its catalog tabs.

- **Sales is the catalog tab's only screen.** `/catalog/sales` is the tab's
  root and sole route; the tab bar is gone.
- **Items and tables are set up under Settings**, in a SALES group at the
  top of the list: `/settings/items` and `/settings/tables`, with their
  forms below them (`/settings/items/new`, `/settings/items/:id`, the same
  for tables). They need the `catalog` permission as before. On a wide
  window they open beside Settings, as every setting does; the form then
  takes the list's place in that pane.
- **The bill belongs to Sales.** `/bill` is the catalog tab's path, so the
  rail marks Sales while a bill is edited; it still takes the whole width.
- **A category is made on the item.** The item form shows the categories
  there as chips and a field for a new name; a typed name becomes a
  category on save (`findOrCreateCatalogCategory`), or the one already
  spelt that way, case and spaces aside. There is no categories screen,
  so a category has no rename or delete of its own: one nobody uses is
  simply not offered in the filters, which list only the categories in
  use.
- **A settings row is one line**: its title and, at most, its current
  value; no second line explaining the screen behind it.

## Alternatives considered

- Keeping the lists as tabs under Sales but hiding them from selling
  staff: the tabs would appear and vanish with the PIN session.
- `/catalog/items` kept as a root screen reached from Settings: its phone
  screen would have no Back, and the rail would mark Sales for a list the
  merchant opened from Settings.
- A categories list under Settings beside items and tables: one more
  screen for a name that is typed where it is used.
- Counting the payment steps as Sales' too: a payment also starts from the
  terminal's keypad, which has no bill.

## Consequences

- `menu-routes.ts` owns `/bill` under `catalog` and excludes it from the
  master pane; `menuRootPaths` keeps `/catalog/sales` as the tab's one
  root. `route-access.ts` lists the items and tables routes under
  `/settings`.
- `CatalogListShell` draws no tabs; Sales passes `startAddon={null}`, the
  lists under Settings keep Back.
- Maestro flows reach the lists by `settings/items` and `settings/tables`;
  `add-catalog-item` types the category's name; `open-locked-catalog`
  goes Settings → Items. The category flows of their own are gone.
- The parity map has no categories entries and a native-only
  `category-field.tsx`.
- navigation/0002 is superseded by this record; what it decided about
  the terminal tab, notifications, the profile tile and nesting still
  holds and is restated by the tests below.

## Enforced by

- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002, navigation/0003) > gives the terminal its own tab, with home and the payment steps`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002, navigation/0003) > opens the catalog on Sales, which selling staff can reach, and the bill is Sales' too`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002, navigation/0003) > keeps Sales the catalog tab's only screen, items and tables under Settings`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002, navigation/0003) > keeps notifications under Settings rather than on home`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002, navigation/0003) > nests a detail under the longest root above it, or its tab's root`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002, navigation/0003) > nests nothing under a root screen, the terminal, the bill or outside the tabs`
- `apps/native-app/src/core/master-pane.test.ts > master pane (navigation/0002) > marks the row of the detail shown, and of a screen under it`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > a category is made on the item (navigation/0003) > creates the category the first time and reuses it by name afterwards`
