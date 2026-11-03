import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import type { AnyRoute } from "@tanstack/react-router"
import { describe, expect, test } from "vitest"

import { type MenuTab, menuTabs } from "@/components/menu-nav.tsx"
import { router } from "@/router.tsx"

interface RouteNode {
  readonly id: string
  readonly access: unknown
  readonly hasLoader: boolean
  readonly ancestors: ReadonlyArray<{ readonly access: unknown }>
}

const isTerminal = (id: string) =>
  id === "/_terminal" || id.startsWith("/_terminal/")

const terminalRoutes = (): ReadonlyArray<RouteNode> =>
  Object.values(router.routesById as unknown as Record<string, AnyRoute>)
    .filter((route) => isTerminal(route.id))
    .map((route) => {
      const ancestors: Array<{ readonly access: unknown }> = []
      for (
        let parent: AnyRoute | undefined = route.parentRoute;
        parent !== undefined && isTerminal(parent.id);
        parent = parent.parentRoute
      ) {
        ancestors.push({ access: parent.options.staticData?.access })
      }
      return {
        id: route.id,
        access: route.options.staticData?.access,
        hasLoader: route.options.loader !== undefined,
        ancestors,
      }
    })

describe("_terminal route access (access/0003)", () => {
  const routes = terminalRoutes()

  test("finds the terminal routes", () => {
    expect(routes.length).toBeGreaterThan(40)
  })

  test("every route declares a permission or free, layouts included", () => {
    const undeclared = routes
      .filter(({ access }) => access === undefined)
      .map(({ id }) => id)

    expect(undeclared).toEqual([])
  })

  test("no free route sits under a layout that declares a permission", () => {
    const lockedFree = routes
      .filter(
        (route) =>
          route.access === "free" &&
          route.ancestors.some((ancestor) => ancestor.access !== "free")
      )
      .map(({ id }) => id)

    expect(lockedFree).toEqual([])
  })

  test("no route has a loader, which would run before the gate", () => {
    expect(
      routes.filter(({ hasLoader }) => hasLoader).map(({ id }) => id)
    ).toEqual([])
  })
})

/**
 * The menu section (navigation/0001): every screen of a tab declares the
 * tab it belongs to, so the layout knows when to draw the bar and the
 * sidebar, and the tab table opens each tab on one of its root screens.
 */
describe("menu section (navigation/0001)", () => {
  const sectionPrefixes = {
    activity: "/activity",
    catalog: "/catalog",
    settings: "/settings",
  } satisfies Record<MenuTab, string>

  const routes = Object.values(
    router.routesById as unknown as Record<string, AnyRoute>
  ).map((route) => ({
    path: route.fullPath.replace(/(.)\/$/u, "$1"),
    menu: route.options.staticData?.menu,
    access: route.options.staticData?.access,
  }))

  const tabOfPath = (path: string) =>
    (Object.entries(sectionPrefixes) as ReadonlyArray<[MenuTab, string]>).find(
      ([, prefix]) => path === prefix || path.startsWith(`${prefix}/`)
    )?.[0]

  test("every route of the section declares its own tab", () => {
    const wrong = routes.flatMap(({ path, menu }) => {
      const tab = tabOfPath(path)
      return tab !== undefined && menu?.tab !== tab
        ? [`${path}: ${menu?.tab ?? "no menu"}`]
        : []
    })

    expect(wrong).toEqual([])
  })

  test("no route outside the section declares a tab", () => {
    expect(
      routes
        .filter(({ path, menu }) => menu !== undefined && !tabOfPath(path))
        .map(({ path }) => path)
    ).toEqual([])
  })

  test("each tab opens on one of its root screens, which needs the permission the table names", () => {
    const mismatches = (
      Object.entries(menuTabs) as ReadonlyArray<
        [MenuTab, (typeof menuTabs)[MenuTab]]
      >
    ).flatMap(([tab, { to, permission }]) => {
      // An index route shares its path with the layout above it.
      const opensOnRoot = routes.some(
        (route) =>
          route.path === to &&
          route.menu?.tab === tab &&
          route.menu.root === true &&
          route.access === permission
      )
      return opensOnRoot ? [] : [tab]
    })

    expect(mismatches).toEqual([])
  })
})

/**
 * A route file is thin: it declares the route and hands the screen to a
 * feature `*Page`, which renders the whole page, header included. A route
 * drawing `FadeHeader` itself is a page written inline or a wrapper around a
 * feature component that is not a page after all.
 */
describe("route files stay thin", () => {
  const routesDir = path.join(import.meta.dirname, "routes")
  const routeFiles = readdirSync(routesDir).filter((file) =>
    file.endsWith(".tsx")
  )

  test("finds the route files", () => {
    expect(routeFiles.length).toBeGreaterThan(40)
  })

  test("no route renders the page header itself", () => {
    expect(
      routeFiles.filter((file) =>
        readFileSync(path.join(routesDir, file), "utf8").includes(
          "@/components/fade-header.tsx"
        )
      )
    ).toEqual([])
  })
})
