import { type Href, router } from "expo-router"
import { currentPathname } from "../core/current-pathname.ts"
import { hrefPath, useMasterPane } from "../core/master-pane.ts"

/**
 * Opens a detail screen from a list: a push, as on a phone, except from a
 * master pane on a wide window (navigation/0002), where the list sits
 * beside the detail it opened: there the new detail takes the current
 * one's place — the stack is first dismissed to the pane's root, so Back
 * from the new detail returns to the root rather than through every detail
 * opened before it — and the detail already shown is left alone.
 */
export function useOpenDetail(): (href: Href) => void {
  const root = useMasterPane()
  // Read when pressed: subscribing would render every list row again on
  // every navigation.
  return (href) => {
    if (root !== null) {
      if (currentPathname() === hrefPath(href)) return
      router.dismissTo(root)
    }
    router.push(href)
  }
}
