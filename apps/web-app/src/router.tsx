import type { RouteAccess } from "@payky/core/modules/access/access-types"
import { createRouter } from "@tanstack/react-router"
import { jotaiStore } from "@/atoms/store.ts"
import type { MenuTab } from "@/components/menu-nav.tsx"
import { routeTree } from "@/routeTree.gen.ts"

const normalizePath = (pathname: string | undefined) =>
  pathname?.replace(/\/$/, "") || "/"

/**
 * Stacks that push and pop from home: the menu section's tabs, and
 * Notifications behind home's bell. Depth inside
 * one of them decides the direction, so every `/settings/*` and `/activity/*`
 * level animates the same way its root does. Moving from one stack to
 * another (a tab switch) swaps instantly.
 *
 * Deliberately not listed: `/bill` and `/payment/*`. They sit on the money
 * path, walked dozens of times a shift, and a view transition cannot be
 * interrupted the way the platform's own animation can — 450ms of dead input
 * per step is a worse trade there than an instant swap.
 */
const stackRoots = ["/activity", "/catalog", "/settings", "/notifications"]

interface StackPosition {
  /** The stack the screen sits in; `null` for home, the floor of every one. */
  readonly root: string | null
  readonly depth: number
}

/** Where a screen sits; anything outside a stack has no position. */
const stackPosition = (pathname: string): StackPosition | undefined => {
  if (pathname === "/") return { root: null, depth: 0 }

  const root = stackRoots.find(
    (stackRoot) =>
      pathname === stackRoot || pathname.startsWith(`${stackRoot}/`)
  )

  return root === undefined
    ? undefined
    : { root, depth: pathname.split("/").length - 1 }
}

export const router = createRouter({
  routeTree,
  context: { jotaiStore },
  // Android-style slide between screens, driven by CSS in index.css. Anything
  // that is not a push or a pop within one stack returns false and swaps
  // instantly, as before — including every `replace: true` navigation, which
  // has nothing to go back to.
  defaultViewTransition: {
    types: ({ fromLocation, toLocation }) => {
      const from = stackPosition(normalizePath(fromLocation?.pathname))
      const to = stackPosition(normalizePath(toLocation.pathname))

      if (from === undefined || to === undefined || from.depth === to.depth) {
        return false
      }
      if (from.root !== null && to.root !== null && from.root !== to.root) {
        return false
      }

      return to.depth > from.depth ? ["forward"] : ["backward"]
    },
  },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }

  interface StaticDataRouteOption {
    /**
     * What a `_terminal` route needs (access/0003): a permission, or `free`.
     * Every one declares it, layouts included; a unit test over the route
     * tree fails on one that does not.
     */
    readonly access?: RouteAccess
    /**
     * The menu tab a route belongs to (navigation/0001). `root` marks a
     * tab's root screen, the only kind that draws the phone's bottom bar
     * (whose Home leads out) and no Back. Every route of the section declares
     * it; a unit test over the route tree fails on one that does not.
     */
    readonly menu?: {
      readonly tab: MenuTab
      readonly root?: true
    }
    readonly terminalLayout?: {
      readonly mainClassName?: string
      readonly viewportClassName?: string
    }
  }
}
