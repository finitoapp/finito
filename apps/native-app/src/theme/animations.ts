import { createAnimations } from "@tamagui/animations-react-native"

/**
 * The kit's transitions, Linky's (`packages/ui/src/animations.ts`) on React
 * Native's `Animated`; the PWA takes `animations.web.ts`, CSS transitions
 * of the same names. A view opts in with `transition={fadeTransition}`
 * (`transitions.ts`): `fast` is the fade of a fill between rest, hover and
 * press.
 */
export const animations = createAnimations(
  {
    fast: { type: "timing", duration: 150 },
  },
  {
    // On the JS driver, as every kit fill ran before `fadeTransition`. On
    // Fabric the driver defaults to the native one for a node whose
    // transition covers no height or width, and on a PAX A920Pro a keypad
    // key's pressed fill then never faded back after a long press or two
    // quick taps (2026-11-17). `fadeTransition` still keeps each fade to
    // three values, where a bare `fast` animated eleven or twelve.
    useNativeDriver: false,
  }
)
