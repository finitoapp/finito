import { createAnimations } from "@tamagui/animations-react-native"
import { duration } from "./tokens.ts"

/**
 * The kit's transitions, Linky's (`packages/ui/src/animations.ts`) on React
 * Native's `Animated`; the PWA takes `animations.web.ts`, CSS transitions
 * of the same names. A view opts in with `transition="fast"`: `fast` is the
 * fade of a fill between rest, hover and press, `slide` a pill moving to
 * the active entry.
 *
 * `useNativeDriver` is explicit because the driver's own default never
 * turns it on: it detects Fabric by `global.__nativeFabricUIManager`
 * (3.0.18 through 3.3.3), which React Native 0.88 names
 * `nativeFabricUIManager`. Unpatched, the driver also put a whole node on the
 * JS driver as soon as its transition covered a numeric height, width or
 * min/max size, as `fast` does a kit Button's: every frame of a pressed fill
 * then ran on the JS thread, ~0.16 s of a payment terminal's per keypad tap.
 * `patches/@tamagui%2Fanimations-react-native@3.3.3.patch` paints those sizes
 * as static styles, so the node keeps the native driver; a size never
 * animates through a transition (`ui/collapsible.tsx` animates its own).
 */
export const animations = createAnimations(
  {
    fast: { type: "timing", duration: duration.fast },
    slide: {
      type: "timing",
      duration: duration.slide,
      // Ease-out cubic; the driver turns a CSS curve into `Easing.bezier`.
      easing: "cubic-bezier(0.33, 1, 0.68, 1)",
    },
    // No motion (settings/0007): a view without any transition gets the
    // driver's unconfigured "0ms" path, which paints a press but never its
    // release (`useKitTransition`).
    instant: { type: "timing", duration: 0 },
  },
  { useNativeDriver: true }
)
