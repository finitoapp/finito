import { useState } from "react"
import { styled, View } from "tamagui"
import { createSwitch, SwitchStyledContext } from "tamagui/unstyled"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import { control } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/switch.tsx`: track `bg-primary` when
 * checked and `bg-input` (dark `bg-input/80`) when not, thumb
 * `bg-background` (dark: `primary-foreground` checked, `foreground` not)
 * sitting inside the track and sliding across it
 * (`transition-transform`), `disabled:opacity-50`.
 *
 * Base: Tamagui `Switch` (`createSwitch`), controlled through `checked`,
 * with the kit's own track and thumb: their `active` variants read the
 * switch's styled context, and the thumb slides by Tamagui's `x` on the
 * `fast` transition (React Native's driver, native-driven). Not RN
 * `Switch`, whose Android thumb overhangs a thin track and takes its own
 * tint. The track is Material 3's 52 × 32 (thumb 26), the kit's small
 * control height, so it stands beside a 44-high field rather than
 * shrinking next to it, and reaches 48 through `hitSlop`. Web's
 * `size="sm"` is not ported.
 */

const TRACK_WIDTH = 52
const TRACK_HEIGHT = control.sm
const THUMB_INSET = 3
const THUMB_SIZE = TRACK_HEIGHT - 2 * THUMB_INSET

const SwitchTrack = styled(View, {
  name: "Switch",
  context: SwitchStyledContext,
  w: TRACK_WIDTH,
  h: TRACK_HEIGHT,
  rounded: TRACK_HEIGHT / 2,
  p: THUMB_INSET,
  // Tamagui renders the frame as a `<button>` on web; drop the browser's border.
  borderWidth: 0,
  justify: "center",
  hitSlop: (48 - TRACK_HEIGHT) / 2,
  cursor: "web:pointer",

  variants: {
    active: {
      true: { bg: "primary" },
      false: { bg: "switch-track-off" },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

const SwitchThumb = styled(View, {
  name: "SwitchThumb",
  context: SwitchStyledContext,
  w: THUMB_SIZE,
  h: THUMB_SIZE,
  rounded: THUMB_SIZE / 2,

  variants: {
    active: {
      true: { bg: "switch-thumb-on" },
      false: { bg: "switch-thumb-off" },
    },
  } as const,
})

const TamaguiSwitch = createSwitch({ Frame: SwitchTrack, Thumb: SwitchThumb })

export interface SwitchProps {
  readonly checked: boolean
  readonly onCheckedChange: (checked: boolean) => void
  readonly disabled?: boolean
  /** Already translated; a switch has no visible text of its own. */
  readonly "aria-label": string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  "aria-label": ariaLabel,
}: SwitchProps) {
  // Read once per mount: Tamagui must not see a view gain or lose its
  // transition while mounted, and its React Native driver ignores the
  // system's reduce-motion setting.
  const [transition] = useState(() =>
    isReduceMotionEnabled() ? undefined : "fast"
  )

  return (
    <TamaguiSwitch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      // Tamagui sets the role only on web.
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      // Its name as testID too: an e2e flow's `id:` then hits this switch,
      // not a same-named control on a screen mounted under it (Android).
      testID={ariaLabel}
    >
      <TamaguiSwitch.Thumb transition={transition} />
    </TamaguiSwitch>
  )
}
