# 0001 Activity, catalog and settings are one menu section

Status: accepted
Date: 2026-11-03

## Context

Home had two icons, a clock to the payment history (`/activity`) and a
gear to settings, and the statistics sat behind a third icon in the
Activity header. Each was a destination of its own, reached from home and
left by Back, and the list kept growing: the catalog is leaving settings
(access/0010) and notifications are coming. Home has no room for another
icon on a small phone, and a manager moving between the history, the
numbers and the catalog went home and back each time.

## Decision

- **One section, three tabs, in this order:** Activity, Catalog,
  Settings, after Home. The tab table in
  `apps/web-app/src/components/menu-nav.tsx` holds each tab's icon, label,
  root screen and permission; a new tab is a new row.
- **Home has one way in:** a hamburger (`nav.menu`) that opens Activity.
  The clock and the gear are gone.
- **A route joins the section through `staticData.menu`** (`{ tab, root? }`),
  as it declares `staticData.access`, rather than through a layout route
  that would rename every route file. `_terminal.tsx` reads the deepest
  one.
- **The statistics are Activity's third tab** (Payments, Bills,
  Statistics) at `/activity/stats`: both look back at what sold. The tab
  is always shown and needs `stats`, so the access gate asks for the PIN
  there (access/0012).
- **Notifications are a bell on home**, beside the hamburger, opening
  `/notifications` as a screen of its own with Back, outside the section:
  they are a state to check, not a place to work in. Nothing raises one
  yet, so the bell carries no count. (Since navigation/0005 an active
  notification lights a dot on the bell.)
- **The root screens** are `/activity`, `/activity/bills` and `/activity/stats`,
  `/catalog/items`, `/catalog/categories` and `/catalog/tables`,
  and `/settings`. Each tab opens on its first.
- **On a phone, the bottom bar shows only on a root screen.** A sub-screen
  (Settings › Language, an item's form) keeps the whole height and its
  Back arrow.
- **On a large monitor (`lg`), the sidebar shows on every screen of the
  section**, and the viewport and the header move right to make room.
- **The bar and the sidebar open with Home** (`nav.home`), ahead of the
  tabs, and a root screen's header has no Back and no close button. Home
  leaves the section the way it was entered: switching tabs replaces the
  history entry, so going back returns home; a root screen opened by URL
  has nothing to go back to and goes home instead. Home is never the
  active entry, since home is not part of the section.
- **The bar shows icons alone**, each named by its label for assistive
  tech; the sidebar spells the labels out. The active icon grows a little
  and rises over a small half-circle marker that slides between tabs.
- **Every tab is always shown.** A gated tab asks for the PIN through the
  access gate (access/0012).

## Alternatives considered

- Five tabs, with Statistics and Notifications beside the others: with
  Home that made six entries on a phone bar, past the three to five a
  bottom bar holds before its targets get too narrow to tell apart.
- A `_terminal._menu` layout route: it would rename some 80 route files and
  their route ids, for the same result as one `staticData` field.
- Hiding the tabs a device cannot open: the owner would have no way to open
  them with the PIN on that device.
- Showing the bar on sub-screens too: it takes a sixth of a small phone's
  height on screens that are forms, and a tab switch from inside a form
  would drop the stack under it without asking.

## Consequences

- Finito has the same section (since navigation/0002 with the terminal as
  a tab of the rail, Sales as the catalog's root, notifications under
  Settings and details beside their root on a wide window). Expo Router
  has no per-route data, so its
  tabs come from a table of paths (`apps/native-app/src/core/menu-routes.ts`)
  rather than `staticData.menu`; the root layout draws the bar or the
  sidebar beside its stack, and the withdrawal screens, which sit at the
  top of its routes, count as Settings. Its Maestro flows in
  `e2e/flows/menu/` mirror `menu.spec.ts`.
- On a large monitor a tab switch from a sub-screen replaces that
  sub-screen's entry, so Home from the new tab's root goes back to the
  root the sub-screen was opened from, not home.
- The view transitions treat each tab as its own stack: pushing and
  popping inside one animates, a tab switch swaps instantly.

## Enforced by

- `apps/web-app/src/router.test.ts > menu section (navigation/0001) > every route of the section declares its own tab`
- `apps/web-app/src/router.test.ts > menu section (navigation/0001) > no route outside the section declares a tab`
- `apps/web-app/src/router.test.ts > menu section (navigation/0001) > each tab opens on one of its root screens, which needs the permission the table names`
- `apps/web-app/e2e/menu.spec.ts > the hamburger opens Activity, every tab switches, and Home returns home`
- `apps/web-app/e2e/menu.spec.ts > the bar is hidden on a sub-screen, which has Back instead`
- `apps/native-app/src/core/menu-routes.test.ts > menu section (navigation/0001) > opens each tab on one of its root screens, which needs the permission the table names`
- `apps/native-app/src/core/menu-routes.test.ts > menu section (navigation/0001) > puts every route of the section in its tab and leaves the rest out`
- `apps/web-app/e2e/menu.spec.ts > Home on a root screen opened by URL goes home`
- `apps/web-app/e2e/menu.spec.ts > the bell on home, dark on a fresh account, opens Notifications, which has Back and no bar`
- `apps/web-app/e2e/menu.spec.ts > a large monitor shows the sidebar on every screen of the section`
- `apps/web-app/e2e/screen-transition.spec.ts > pushes and pops inside a stack transition, the money path does not`
