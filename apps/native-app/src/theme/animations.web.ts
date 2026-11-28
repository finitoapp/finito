// `extras` adds the animated-number hooks `ui/dialog`'s Tamagui Sheet slides on.
import { createAnimations } from "@tamagui/animations-css/extras"
import { duration } from "./tokens.ts"

/**
 * `animations.ts` as CSS transitions (Linky's `animations.web.ts`): a
 * hovered or pressed fill fades in over 150 ms, ease-out; a pill slides
 * over 220 ms, ease-out cubic.
 */
export const animations = createAnimations({
  fast: `ease-out ${duration.fast}ms`,
  slide: `cubic-bezier(0.33, 1, 0.68, 1) ${duration.slide}ms`,
  instant: "linear 0ms",
})
