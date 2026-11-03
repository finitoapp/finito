import type { Href } from "expo-router"
import { createContext, useContext } from "react"

/**
 * The root screen a wide window draws beside a detail screen
 * (navigation/0002), as Linky's desktop split view: the root layout
 * renders that root's page a second time, left of the stack, under this
 * context carrying its path. A list rendered there marks the row the
 * detail belongs to, opens another detail in place of the current one
 * (`useOpenDetail`), and leaves hardware scans to the screen on the right.
 * `null` everywhere else, the stack included.
 */
export const MasterPaneContext = createContext<string | null>(null)

/** The root path of the master pane this renders in, or `null` outside one. */
export const useMasterPane = (): string | null => useContext(MasterPaneContext)

/**
 * The path an expo-router `Href` leads to, its search left out: a string
 * as is, an object with its `[param]` segments filled in.
 */
export const hrefPath = (href: Href): string => {
  if (typeof href === "string") return href.split("?")[0] ?? href
  const params: Record<string, unknown> = href.params ?? {}
  return Object.entries(params).reduce(
    (path, [name, value]) => path.replace(`[${name}]`, String(value)),
    href.pathname
  )
}

/** Whether the screen at `pathname` is `href` or one of its descendants. */
export const isDetailOf = (pathname: string, href: Href): boolean => {
  const target = hrefPath(href)
  return pathname === target || pathname.startsWith(`${target}/`)
}
