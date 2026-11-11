import type { RouteAccess } from "@payky/core/modules/access/access-types"

/**
 * A tab of the rail and the bar (navigation/0001, navigation/0004): the
 * terminal, then the menu section's Activity, Notifications and Settings.
 * The terminal is the rail's first entry on a wide window and the bar's
 * Home on a phone, where its root screen keeps the hamburger instead of
 * the bar. The tables grid is a mode of home, not a tab.
 */
export type MenuTab = "terminal" | "activity" | "notifications" | "settings"

/**
 * Each tab's root screen, the one it opens on, and the permission that
 * screen needs, in the order the bar and the sidebar draw them. Web routes
 * declare `staticData.menu`; Expo Router has no per-route data, so the tab
 * a path belongs to comes from `menuTabPrefixes`. Notifications protect
 * nothing yet (access/0012); items and tables are set up under Settings
 * (navigation/0004).
 */
export const menuTabTargets = {
  terminal: { href: "/", permission: "sell" },
  activity: { href: "/activity", permission: "activity" },
  notifications: { href: "/notifications", permission: "free" },
  settings: { href: "/settings", permission: "free" },
} as const satisfies Record<
  MenuTab,
  { readonly href: string; readonly permission: RouteAccess }
>

export const menuTabOrder = Object.keys(
  menuTabTargets
) as ReadonlyArray<MenuTab>

/**
 * The paths each tab owns. The terminal owns home, the bill (opened from
 * home's tables grid or by a scan there) and the payment steps; settings
 * also owns the withdrawal screens, which web keeps under
 * `/settings/payment-accounts/*` and native at the top. `/` matches itself
 * alone, the other prefixes their subtree too.
 */
const menuTabPrefixes = {
  terminal: ["/", "/payment", "/bill"],
  activity: ["/activity"],
  notifications: ["/notifications"],
  settings: ["/settings", "/withdraw", "/cashu-withdraw"],
} as const satisfies Record<MenuTab, ReadonlyArray<string>>

/**
 * The screens that draw the phone's bottom bar, with its Home, and no Back.
 * Home itself is a root too, for the rail: on a phone it keeps the
 * hamburger instead of the bar.
 */
export const menuRootPaths: ReadonlySet<string> = new Set([
  "/",
  "/activity",
  "/activity/bills",
  "/activity/stats",
  "/notifications",
  "/settings",
])

export interface MenuPosition {
  readonly tab: MenuTab
  readonly root: boolean
}

const normalizePath = (pathname: string): string =>
  pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname

const underPrefix = (path: string, prefix: string): boolean =>
  prefix === "/"
    ? path === "/"
    : path === prefix || path.startsWith(`${prefix}/`)

/** Where `pathname` sits in the tabs; `undefined` outside them (onboarding, pairing). */
export const menuPositionOf = (pathname: string): MenuPosition | undefined => {
  const path = normalizePath(pathname)
  const tab = menuTabOrder.find((candidate) =>
    menuTabPrefixes[candidate].some((prefix) => underPrefix(path, prefix))
  )
  return tab === undefined ? undefined : { tab, root: menuRootPaths.has(path) }
}

/**
 * The root screen a detail screen nests under on a wide window
 * (navigation/0002): the longest root of its tab above it (`/activity/bills`
 * for a bill's detail), or the tab's own root when none is (`/settings` for
 * an item's form or a withdrawal). `undefined` for a root screen itself,
 * for the terminal's payment steps and for the bill, which take the whole
 * width.
 */
export const menuDetailRootOf = (pathname: string): string | undefined => {
  const path = normalizePath(pathname)
  const position = menuPositionOf(path)
  if (
    position === undefined ||
    position.root ||
    position.tab === "terminal" ||
    path === "/bill"
  )
    return undefined
  const above = [...menuRootPaths]
    .filter((root) => root !== "/" && path.startsWith(`${root}/`))
    .sort((a, b) => b.length - a.length)
  return above[0] ?? menuTabTargets[position.tab].href
}
