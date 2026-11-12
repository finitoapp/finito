import { type ReactNode, useEffect, useState } from "react"
import {
  type EdgeInsets,
  SafeAreaInsetsContext,
} from "react-native-safe-area-context"
import { insetsFromPadding, sameInsets } from "./env-insets.ts"

/**
 * The page's safe area as the browser states it, `env(safe-area-inset-*)`,
 * read off a hidden probe padded by it.
 *
 * Expo Router wraps the app in a `SafeAreaProvider` that on the web hands
 * out zero insets, always, to keep server rendering stable. An installed
 * iPhone web app draws under the black-translucent status bar and over the
 * home indicator, so with zero insets home's hamburger sat under the status
 * bar, out of sight and out of reach, and the menu bar's tabs in the home
 * indicator's strip, where iOS takes a tap for its own gesture. This one,
 * nested inside, gives the screens the browser's real insets.
 *
 * react-native-safe-area-context's own web provider is no substitute: it
 * clamps the insets to the part of its view inside `window.innerHeight`,
 * which an installed iOS 26 web app sizes short of the screen by the status
 * bar (WebKit 301108, see `public/index.html`), and would count that
 * shortfall into the bottom inset. The page is the screen in an installed
 * app and the window in a browser, so the insets apply to it as they are.
 */
let probe: HTMLElement | undefined

const getProbe = (): HTMLElement => {
  if (probe !== undefined) return probe
  const element = document.createElement("div")
  const { style } = element
  style.position = "fixed"
  style.left = "0"
  style.top = "0"
  style.width = "0"
  style.height = "0"
  style.visibility = "hidden"
  style.pointerEvents = "none"
  // A change of the insets (rotation, the status bar appearing) runs a
  // transition, which is what tells us.
  style.transitionProperty = "padding"
  style.transitionDuration = "0.05s"
  style.paddingTop = "env(safe-area-inset-top)"
  style.paddingRight = "env(safe-area-inset-right)"
  style.paddingBottom = "env(safe-area-inset-bottom)"
  style.paddingLeft = "env(safe-area-inset-left)"
  document.body.append(element)
  probe = element
  return element
}

const readInsets = (): EdgeInsets =>
  insetsFromPadding(window.getComputedStyle(getProbe()))

/** Re-reads on every event after which iOS is known to settle its insets. */
const windowEvents = [
  "resize",
  "orientationchange",
  "pageshow",
  "visibilitychange",
] as const

export function WindowSafeArea({ children }: { readonly children: ReactNode }) {
  const [insets, setInsets] = useState(readInsets)
  useEffect(() => {
    const update = () =>
      setInsets((current) => {
        const next = readInsets()
        return sameInsets(current, next) ? current : next
      })
    const element = getProbe()
    element.addEventListener("transitionend", update)
    for (const event of windowEvents) window.addEventListener(event, update)
    window.visualViewport?.addEventListener("resize", update)
    // The insets may have settled between the first render and now.
    update()
    return () => {
      element.removeEventListener("transitionend", update)
      for (const event of windowEvents)
        window.removeEventListener(event, update)
      window.visualViewport?.removeEventListener("resize", update)
    }
  }, [])
  return (
    <SafeAreaInsetsContext value={insets}>{children}</SafeAreaInsetsContext>
  )
}
