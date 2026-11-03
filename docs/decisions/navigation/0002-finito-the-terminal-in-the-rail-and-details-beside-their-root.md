# 0002 Finito: the terminal in the rail, Sales as a tab, details beside their root

Status: superseded by navigation/0003
Date: 2026-11-03

## Context

navigation/0001 gave both apps one menu section, Activity, Catalog and
Settings, behind home's hamburger, with a bell for notifications beside
it, and home itself a switch between the keypad and the tables grid
(settings/0001). On a wide window Finito drew the section's rail only
inside the section: the terminal, the screen a shop lives on, had no rail,
and every setting opened over the whole width, the list it came from gone.
Linky's desktop keeps its rail on every screen and opens a detail beside
the list it was chosen from, and Finito is meant to feel like Linky.

## Decision

Finito alone; Payky keeps navigation/0001 as it is.

- **The terminal is a tab.** The rail's first entry, a calculator, is home,
  and the rail stays on every screen of the tabs (`/`, the bill and the
  payment steps included) on a window of 961 px or more. On a phone the
  bar keeps the calculator entry as Home and home keeps its hamburger; the
  bar still shows only on a menu tab's root screen.
- **Sales is a screen, not a mode.** Home is the keypad alone; the tables
  grid (web's pos mode) is `/catalog/sales`, the catalog tab's root and
  first tab, ahead of Items, Categories and Tables, labelled `nav.pos` and
  needing `sell` so staff who sell reach it. The catalog's other tabs keep
  `catalog`. Finito has no home-screen setting; `enabledHomeModesJson`
  stays Payky's.
- **Notifications are a row under Settings** (`/settings/notifications`),
  not a bell on home.
- **The business's picture opens its profile.** The rail's tile shows the
  account's published picture (the app icon until it has one) and opens
  `/settings/profile`, the name and picture editor, beside Settings.
- **On a wide window a detail opens beside its root.** A screen under a
  tab's root (`menuDetailRootOf`) is drawn right of that root's page,
  mounted a second time by the root layout (`masterPages` in
  `app/_layout.tsx`): `/settings` beside every setting and the withdrawal
  screens, the payment or bill history beside a detail, each catalog list
  beside its form. In that master pane (`src/core/master-pane.ts`) the row
  of the detail shown is tinted, choosing another row replaces the detail
  (`useOpenDetail`: the stack is dismissed to the root first, so Back from
  the new detail returns to the root), and hardware scans are left to the
  detail. The terminal's bill and payment steps nest nothing: they take
  the whole width as before.

## Alternatives considered

- Keeping the tables grid a mode of home: a switch in the header on a
  screen whose header otherwise goes away under the rail, and a mode a
  device remembers while the rail shows a tab that does not.
- A fifth tab for Sales beside Catalog: one more entry on the phone's bar,
  for a grid that already opens the catalog's bills.
- Rendering the root page inside each detail's screen (`screenLayout`):
  the list would remount on every detail chosen and lose its scroll.
- Hiding notifications until something raises one: a settings row costs
  nothing and keeps the place known.

## Consequences

- `menu-routes.ts` has a `terminal` tab; `/` is a root path, so the rail
  marks it, and the bar excludes it. `/catalog` redirects to Sales.
- Maestro flows reach the grid through Sales (`subflows/open-sales.yaml`,
  `goto catalog/sales`), and web's home-mode flows have no native twin.
- The profile is one TanStack query (`useNostrProfile`) shared by the rail,
  the settings card and the editor, which records what it published.
- The parity map keeps `pos-overview-page.tsx` matched against web's,
  under `src/features/catalog/sales`.

## Enforced by

- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002) > gives the terminal its own tab, with home, the bill and the payment steps`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002) > opens the catalog on Sales, which selling staff can reach`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002) > keeps notifications under Settings rather than on home`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002) > nests a detail under the longest root above it, or its tab's root`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, Sales and nesting (navigation/0002) > nests nothing under a root screen, the terminal or outside the tabs`
- `apps/native-app/src/core/master-pane.test.ts > master pane (navigation/0002) > marks the row of the detail shown, and of a screen under it`
