# 0004 Finito: home switches between the keypad and Sales, Notifications take Sales' tab

Status: accepted
Date: 2026-11-05

## Context

navigation/0002 took the tables grid off Finito's home and made it Sales,
the catalog tab's root, and navigation/0003 left Sales that tab's only
screen. In use, a business that sells at tables reaches for the grid as
often as for the keypad, and one that sells over a counter never needs
the grid at all: both want their own selling screen to be the one the app
opens on, which a tab one tap away is not. Payky already lets an account
choose this (`enabledHomeModesJson`, settings/0004) and remembers on each
device which of the enabled modes it showed last. Notifications, kept as a
row under Settings, were the one destination the menu had no tab for.

## Decision

Finito alone; Payky is unchanged.

- **Home is the keypad or Sales.** Home shows the mode the device last
  chose among the modes the account enables (`enabledHomeModesJson`, the
  setting Payky uses, synced), falling back to the first enabled one as
  Payky does. When both are enabled, a switch at the top left of home
  changes between them; with one enabled there is no switch.
- **The modes are set up under Settings**, in the SALES group beside Items
  and Tables (`/settings/home-screen`, needing `settings` as on Payky); at
  least one stays on (settings/0004).
- **There is no Sales tab.** `/catalog` and `/catalog/sales` are gone. The
  bill, opened from the grid or by a scan on home, belongs to the
  terminal's tab, so the rail marks the terminal while a bill is edited.
- **Notifications are a tab** (`/notifications`, a bell, needing nothing),
  in Sales' place on the phone's bar and on the rail: Home, Activity,
  Notifications, Settings. The Settings row for them is gone.

What navigation/0002 and navigation/0003 decided otherwise still holds
and is restated here: the terminal is the rail's first entry and the
phone's bar keeps it as Home while home keeps its hamburger; the
business's picture at the top of the rail opens its profile; on a wide
window a detail opens beside its root; items and tables are set up under
Settings; a category is made on the item; a settings row is one line.

## Alternatives considered

- Keeping Sales as a tab and adding a home setting only for the keypad:
  two ways to reach the same grid, and the tab marked while home shows
  the grid.
- A home setting with no switch, one mode at a time: a business using
  both would go to Settings to change what home shows.
- Notifications behind a bell on home, as on Payky: home's header now
  holds the switch on the left and the hamburger on the right.

## Consequences

- `menu-routes.ts` has the tabs `terminal`, `activity`, `notifications`
  and `settings`; `/bill` is the terminal's. `route-access.ts` lists
  `/notifications` (`free`) and `/settings/home-screen` (`settings`).
- `PosOverviewPage` moved to `src/features/terminal-home`; native's
  `useTerminalHomeMode` keeps the device's choice under Payky's key
  (`payky.terminalHomeMode`) in its view-state store.
- Maestro flows reach the grid through home's switch
  (`subflows/open-sales.yaml`), and the notifications flow opens its tab.
- navigation/0003 is superseded by this record.

## Enforced by

- `apps/native-app/src/core/menu-routes.test.ts > menu section (navigation/0001) > draws the tabs in web's order, after the terminal`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, home's modes, notifications and nesting (navigation/0004) > gives the terminal its own tab, with home, the bill and the payment steps`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, home's modes, notifications and nesting (navigation/0004) > keeps the tables grid a mode of home, with no Sales tab or route`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, home's modes, notifications and nesting (navigation/0004) > sets up items, tables and home's modes under Settings`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, home's modes, notifications and nesting (navigation/0004) > gives notifications a tab of their own, which anyone can open`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, home's modes, notifications and nesting (navigation/0004) > nests a detail under the longest root above it, or its tab's root`
- `apps/native-app/src/core/menu-routes.test.ts > the terminal, home's modes, notifications and nesting (navigation/0004) > nests nothing under a root screen, the terminal, the bill or outside the tabs`
- `apps/native-app/src/core/master-pane.test.ts > master pane (navigation/0002) > marks the row of the detail shown, and of a screen under it`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > resolveTerminalHomeMode > keeps the remembered mode while it is enabled`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > resolveTerminalHomeMode > falls back to the first enabled mode when the remembered one is disabled`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > a category is made on the item (navigation/0003) > creates the category the first time and reuses it by name afterwards`
