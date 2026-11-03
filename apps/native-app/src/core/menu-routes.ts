import type { RouteAccess } from "@payky/core/modules/access/access-types"

/**
 * A tab of the menu section, the screens behind home's hamburger
 * (navigation/0001), as web's `components/menu-nav.tsx`.
 */
export type MenuTab = "activity" | "catalog" | "settings"

/**
 * Each tab's root screen, the one it opens on, and the permission that
 * screen needs, in the order the bar and the sidebar draw them. Web routes
 * declare `staticData.menu`; Expo Router has no per-route data, so the tab
 * a path belongs to comes from `menuTabPrefixes`.
 */
export const menuTabTargets = {
  activity: { href: "/activity", permission: "activity" },
  catalog: { href: "/catalog/items", permission: "catalog" },
  settings: { href: "/settings", permission: "free" },
} as const satisfies Record<
  MenuTab,
  { readonly href: string; readonly permission: RouteAccess }
>

export const menuTabOrder = Object.keys(
  menuTabTargets
) as ReadonlyArray<MenuTab>

/**
 * The paths each tab owns. Settings also owns the withdrawal screens, which
 * web keeps under `/settings/payment-accounts/*` and native at the top.
 */
const menuTabPrefixes = {
  activity: ["/activity"],
  catalog: ["/catalog"],
  settings: ["/settings", "/withdraw", "/cashu-withdraw"],
} as const satisfies Record<MenuTab, ReadonlyArray<string>>

/** The screens that draw the phone's bottom bar, with its Home, and no Back. */
export const menuRootPaths: ReadonlySet<string> = new Set([
  "/activity",
  "/activity/bills",
  "/activity/stats",
  "/catalog/items",
  "/catalog/categories",
  "/catalog/tables",
  "/settings",
])

export interface MenuPosition {
  readonly tab: MenuTab
  readonly root: boolean
}

/** Where `pathname` sits in the menu section; `undefined` outside it. */
export const menuPositionOf = (pathname: string): MenuPosition | undefined => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname
  const tab = menuTabOrder.find((candidate) =>
    menuTabPrefixes[candidate].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    )
  )
  return tab === undefined ? undefined : { tab, root: menuRootPaths.has(path) }
}
