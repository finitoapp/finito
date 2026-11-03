import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
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

describe("menu section (navigation/0001)", () => {
  it("draws the tabs in web's order", () => {
    expect(menuTabOrder).toEqual(["activity", "catalog", "settings"])
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
    const placed = Object.fromEntries(
      routePaths.map((path) => [path, menuPositionOf(path)?.tab ?? null])
    )
    expect(placed["/"]).toBeNull()
    expect(placed["/bill"]).toBeNull()
    expect(placed["/payment/:paymentId"]).toBeNull()
    expect(placed["/activity/:paymentId"]).toBe("activity")
    expect(placed["/catalog/items/:catalogItemId"]).toBe("catalog")
    expect(placed["/settings/language"]).toBe("settings")
    expect(placed["/withdraw/new"]).toBe("settings")
    expect(placed["/activity/stats"]).toBe("activity")
    // Behind home's bell, a screen of its own rather than a tab.
    expect(placed["/notifications"]).toBeNull()
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
