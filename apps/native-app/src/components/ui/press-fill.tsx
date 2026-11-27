import { useState } from "react"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import type { ThemeColor } from "../../theme/themes.ts"

/**
 * No web counterpart: web's `hover:bg-*`/`active:bg-*` is CSS. A pressable
 * control carries its fill under the finger as a flat clause on its own
 * frame (`bg={pressFillClause(colors)}`) with `transition={useFastTransition()}`,
 * which Tamagui fades on React Native's driver and the PWA as a CSS
 * transition.
 *
 * Until 2026-11 the fill was a separate `Animated.View` layer on native
 * (`PressFill`), because Tamagui's driver once left a pressed fill showing
 * after release; a device trial of the kit Button on Tamagui 3.3.3 no longer
 * showed it, so every control went back to the clause.
 */

/** A fill at rest and under the finger (or the pointer, on web), as theme keys. */
export interface PressFillColors {
  readonly rest: ThemeColor | "transparent"
  readonly pressed: ThemeColor
}

/** The flat clause a frame draws its fill with. */
export const pressFillClause = (
  colors: PressFillColors
): `${string} ${string}` => {
  // Widened: the template over every theme key pair is too large a union.
  const { rest, pressed }: { readonly rest: string; readonly pressed: string } =
    colors
  return `${rest} hover:${pressed} press:${pressed}`
}

/**
 * The kit's `fast` transition, or none under reduced motion (the device's
 * choice, by default the system's setting, settings/0007), which Tamagui's
 * React Native driver ignores. Read once per mount: Tamagui must not see a
 * view gain or lose its transition while mounted, so the root layout mounts
 * the screens again when the choice changes.
 *
 * A key a transition animates must stay in the view's style: when one
 * leaves it (a `disabled` variant's opacity on enabling), the driver drops
 * its native-driven value, and Fabric, which never held that value, keeps
 * the view at it. So a frame whose variant sets an opacity sets
 * `opacity: 1` at rest (`ui-kit.test.ts`).
 */
export function useFastTransition() {
  return useKitTransition("fast")
}

/** Any kit preset (`theme/animations.ts`), off under reduced motion as `useFastTransition`. */
export function useKitTransition<Preset extends "fast" | "slide">(
  preset: Preset
) {
  const [transition] = useState(() =>
    isReduceMotionEnabled() ? undefined : preset
  )
  return transition
}
