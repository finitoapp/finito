/**
 * The route the root layout last rendered, for a press handler that needs
 * it once, when pressed. `usePathname` renders its component again on every
 * navigation: the menu's four links did, through the root layout, on every
 * screen change, while only their `onPress` read it. The root layout
 * subscribes anyway (it draws the menu by the route), so it records it here.
 */
let current = "/"

export const recordPathname = (pathname: string): void => {
  current = pathname
}

export const currentPathname = (): string => current
