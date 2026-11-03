import { type Href, router, usePathname } from "expo-router"
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
  const pathname = usePathname()
  return (href) => {
    if (root !== null) {
      if (pathname === hrefPath(href)) return
      router.dismissTo(root)
    }
    router.push(href)
  }
}
