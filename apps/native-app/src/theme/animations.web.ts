import { createAnimations } from "@tamagui/animations-css"
import { duration } from "./tokens.ts"

/**
 * `animations.ts` as CSS transitions (Linky's `animations.web.ts`): a
 * hovered or pressed fill fades in over 150 ms, ease-out.
 */
export const animations = createAnimations({
  fast: `ease-out ${duration.fast}ms`,
})
