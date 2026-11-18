import { type Href, router } from "expo-router"
import { currentPathname } from "./current-pathname.ts"
import { menuPositionOf } from "./menu-routes.ts"

/**
 * Shows a tab's root screen (home, Activity, Notifications, Settings) from
 * wherever the app is, without building the menu's tabs navigator
 * (`app/(menu)/_layout.tsx`) a second time (navigation/0006).
 *
 * The tabs navigator is one route of the root stack, and Expo Router picks
 * the action for it from the route on top:
 * - on a root screen the tabs navigator is on top, and `navigate` switches
 *   its tab (`dismissTo` would reach it as a pop it cannot do);
 * - on a screen above it (a setting, a detail, the bill, restore, the
 *   onboarding) `dismissTo` pops the stack down to the tabs navigator and
 *   switches its tab, or, with none below, replaces that screen with it
 *   (`replace` would stack a second tabs navigator over the first).
 */
export const showMenuRoot = (href: Href): void => {
  if (menuPositionOf(currentPathname())?.root === true) router.navigate(href)
  else router.dismissTo(href)
}
