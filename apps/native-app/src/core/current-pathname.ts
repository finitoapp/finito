import { useSyncExternalStore } from "react"

/**
 * The route the root layout last rendered, for a press handler that needs
 * it once, when pressed, and for a component that needs one fact about it.
 * `usePathname` renders its component again on every navigation: the
 * menu's four links did, through the root layout, on every screen change,
 * while only their `onPress` read it, and so did every row of a list
 * covered by the screen it opened. The root layout subscribes anyway (it
 * draws the menu by the route), so it records it here.
 */
let current = "/"
const listeners = new Set<() => void>()

/**
 * Called by the root layout in a layout effect, so a component selecting
 * from the route renders again before the new screen is painted.
 */
export const recordPathname = (pathname: string): void => {
  if (pathname === current) return
  current = pathname
  for (const listener of listeners) listener()
}

export const currentPathname = (): string => current

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * One fact about the current route, such as whether a row's detail is open
 * or which tab it is: the component renders again only when that fact
 * changes, not on every navigation. `select` must return a primitive (or
 * an otherwise stable value), as `useSyncExternalStore` compares it by
 * identity.
 */
export const usePathnameSelect = <T>(select: (pathname: string) => T): T =>
  useSyncExternalStore(subscribe, () => select(current))
