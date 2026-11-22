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
 * `nativeFabricUIManager`. A node whose
 * transition covers a numeric height, width or min/max size still runs on
 * the JS driver (the driver decides that per node).
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
  },
  { useNativeDriver: true }
)
