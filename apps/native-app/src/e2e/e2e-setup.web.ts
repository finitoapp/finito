import { nativeEnv } from "../core/native-env.ts"
import { routeE2eSelfPayRelays } from "./e2e-self-pay-relays.ts"

if (nativeEnv.EXPO_PUBLIC_PAYKY_E2E) routeE2eSelfPayRelays()

/**
 * Two gaps between Maestro's web driver and React Native Web, closed in an
 * e2e build only.
 *
 * Scrolling: the driver (`scroll`, `scrollUntilVisible`, swipes) calls
 * `window.scroll({ top: window.scrollY ± half a viewport })`, but React
 * Native Web never scrolls the window: each screen scrolls inside its own
 * ScrollView element. `window.scroll` moves the scrollable element under the
 * viewport's center instead, by `top` — the window's own `scrollY` stays 0,
 * so `top` is the driver's offset (it is left alone: React Native Web
 * measures layout with it).
 *
 * Typing: `inputText` finds the focused element again through
 * `maestro.createXPathFromElement`, whose path steps by `class` without an
 * index, and Tamagui gives sibling inputs the same classes — so it typed into
 * the first input of a form. Its path here indexes every step.
 */
const scroller = (): Element | undefined => {
  for (
    let element = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    element !== null;
    element = element.parentElement
  ) {
    if (
      element.scrollHeight > element.clientHeight &&
      /auto|scroll/.test(getComputedStyle(element).overflowY)
    )
      return element
  }
  return undefined
}

const xPath = (element: Element | null): string | null => {
  const steps: string[] = []
  for (
    let node = element;
    node !== null && node !== document.documentElement;
    node = node.parentElement
  ) {
    const name = node.localName
    const siblings = Array.from(node.parentElement?.children ?? [node])
    const index =
      siblings.filter((sibling) => sibling.localName === name).indexOf(node) + 1
    steps.unshift(`*[local-name()="${name}"][${index}]`)
  }
  return element === null ? null : `/html/${steps.join("/")}`
}

if (nativeEnv.EXPO_PUBLIC_PAYKY_E2E) {
  // `scrollTop`, not the element's `scrollTo`: React Native Web replaces that
  // with its ScrollView's own `scrollTo({ x, y })`.
  window.scroll = (options?: ScrollToOptions | number): void => {
    const element = scroller()
    if (element !== undefined && typeof options === "object")
      element.scrollTop += options.top ?? 0
  }
  // The driver injects its script before or after this one and assigns
  // `createXPathFromElement` onto `window.maestro`; this one keeps winning.
  const holder = window as { maestro?: object }
  holder.maestro ??= {}
  Object.defineProperty(holder.maestro, "createXPathFromElement", {
    configurable: true,
    get: () => xPath,
    set: () => {},
  })
}
