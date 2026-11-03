import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  menuDetailRootOf,
  menuPositionOf,
  menuRootPaths,
  menuTabOrder,
  menuTabTargets,
} from "./menu-routes.ts"
import { resolveRouteAccess } from "./route-access.ts"

const appDir = join(import.meta.dirname, "../../app")

/** `app/x/index.tsx` is `/x`, `[id]` is `:id`, as in `route-access.test.ts`. */
const routePaths = (readdirSync(appDir, { recursive: true }) as string[])
  .filter(
    (file) =>
      file.endsWith(".tsx") &&
      !file.split("/").some((part) => part.startsWith("+")) &&
      !file.endsWith("_layout.tsx")
  )
  .map(
    (file) =>
      `/${file
        .replace(/\.tsx$/, "")
        .replace(/(^|\/)index$/, "")
        .replace(/\[(\w+)\]/g, ":$1")}`.replace(/\/$/u, "") || "/"
  )

const placed = Object.fromEntries(
  routePaths.map((path) => [path, menuPositionOf(path)?.tab ?? null])
)

describe("menu section (navigation/0001)", () => {
  it("draws the tabs in web's order, after the terminal", () => {
    expect(menuTabOrder).toEqual([
      "terminal",
      "activity",
      "catalog",
      "settings",
    ])
  })

  it("opens each tab on one of its root screens, which needs the permission the table names", () => {
    const mismatches = menuTabOrder.filter((tab) => {
      const { href, permission } = menuTabTargets[tab]
      const position = menuPositionOf(href)
      return (
        position?.tab !== tab ||
        !position.root ||
        resolveRouteAccess(href) !== permission
      )
    })
    expect(mismatches).toEqual([])
  })

  it("has a route file for every root screen", () => {
    const paths = new Set(routePaths)
    expect([...menuRootPaths].filter((path) => !paths.has(path))).toEqual([])
  })

  it("puts every route of the section in its tab and leaves the rest out", () => {
    expect(placed["/activity/:paymentId"]).toBe("activity")
    expect(placed["/settings/items/:catalogItemId"]).toBe("settings")
    expect(placed["/settings/language"]).toBe("settings")
    expect(placed["/withdraw/new"]).toBe("settings")
    expect(placed["/activity/stats"]).toBe("activity")
    expect(placed["/onboarding"]).toBeNull()
    expect(placed["/pair"]).toBeNull()
    expect(placed["/e2e/:action"]).toBeNull()
  })

  it("marks only the roots, with or without a trailing slash", () => {
    expect(menuPositionOf("/settings")).toEqual({ tab: "settings", root: true })
    expect(menuPositionOf("/settings/")).toEqual({
      tab: "settings",
      root: true,
    })
    expect(menuPositionOf("/settings/language")).toEqual({
      tab: "settings",
      root: false,
    })
    expect(menuPositionOf("/catalog")).toEqual({ tab: "catalog", root: false })
    expect(menuPositionOf("/activity/stats")).toEqual({
      tab: "activity",
      root: true,
    })
    expect(menuPositionOf("/activityx")).toBeUndefined()
  })
})

describe("the terminal, Sales and nesting (navigation/0002, navigation/0003)", () => {
  it("gives the terminal its own tab, with home and the payment steps", () => {
    expect(placed["/"]).toBe("terminal")
    expect(placed["/payment/:paymentId"]).toBe("terminal")
    expect(placed["/payment/tip"]).toBe("terminal")
    expect(menuPositionOf("/")).toEqual({ tab: "terminal", root: true })
  })

  it("opens the catalog on Sales, which selling staff can reach, and the bill is Sales' too", () => {
    expect(menuTabTargets.catalog).toEqual({
      href: "/catalog/sales",
      permission: "sell",
    })
    expect(placed["/catalog/sales"]).toBe("catalog")
    expect(menuPositionOf("/catalog/sales")?.root).toBe(true)
    expect(placed["/bill"]).toBe("catalog")
    expect(menuPositionOf("/bill")).toEqual({ tab: "catalog", root: false })
  })

  it("keeps Sales the catalog tab's only screen, items and tables under Settings", () => {
    expect(
      [...menuRootPaths].filter((path) => path.startsWith("/catalog"))
    ).toEqual(["/catalog/sales"])
    expect(routePaths.filter((path) => path.startsWith("/catalog/"))).toEqual([
      "/catalog/sales",
    ])
    expect(placed["/settings/items"]).toBe("settings")
    expect(placed["/settings/items/new"]).toBe("settings")
    expect(placed["/settings/tables/:tableId"]).toBe("settings")
    expect(routePaths.some((path) => path.includes("categories"))).toBe(false)
  })

  it("keeps notifications under Settings rather than on home", () => {
    expect(routePaths).not.toContain("/notifications")
    expect(placed["/settings/notifications"]).toBe("settings")
  })

  it("nests a detail under the longest root above it, or its tab's root", () => {
    expect(menuDetailRootOf("/settings/language")).toBe("/settings")
    expect(menuDetailRootOf("/settings/payment-accounts/spark")).toBe(
      "/settings"
    )
    expect(menuDetailRootOf("/withdraw/new")).toBe("/settings")
    expect(menuDetailRootOf("/activity/abc")).toBe("/activity")
    expect(menuDetailRootOf("/activity/bills/abc")).toBe("/activity/bills")
    expect(menuDetailRootOf("/settings/items/new")).toBe("/settings")
    expect(menuDetailRootOf("/settings/tables/abc/")).toBe("/settings")
  })

  it("nests nothing under a root screen, the terminal, the bill or outside the tabs", () => {
    expect(menuDetailRootOf("/settings")).toBeUndefined()
    expect(menuDetailRootOf("/activity/stats")).toBeUndefined()
    expect(menuDetailRootOf("/")).toBeUndefined()
    expect(menuDetailRootOf("/bill")).toBeUndefined()
    expect(menuDetailRootOf("/payment/abc")).toBeUndefined()
    expect(menuDetailRootOf("/onboarding")).toBeUndefined()
  })
})
