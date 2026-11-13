import { createAnimations } from "@tamagui/animations-react-native"

/**
 * The kit's transitions, Linky's (`packages/ui/src/animations.ts`) on React
 * Native's `Animated`; the PWA takes `animations.web.ts`, CSS transitions
 * of the same names. A view opts in with `transition="fast"`: `fast` is the
 * fade of a fill between rest, hover and press.
 */
export const animations = createAnimations({
  fast: { type: "timing", duration: 150 },
})
