import { useEffect, useState } from "react"
import { Animated, Easing, StyleSheet } from "react-native"
import { styled, useTheme, View } from "tamagui"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import { control } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/switch.tsx`: track `bg-primary` when
 * checked and `bg-input` (dark `bg-input/80`) when not, thumb
 * `bg-background` (dark: `primary-foreground` checked, `foreground` not)
 * sitting inside the track and sliding across it
 * (`transition-transform`), `disabled:opacity-50`.
 *
 * Base: a controlled Tamagui `View` with the switch role, not RN `Switch`,
 * whose Android thumb overhangs a thin track and takes its own tint, and
 * not Tamagui `Switch`, whose uncontrolled state adds nothing here. The
 * track is Material 3's 52 × 32 (thumb 26), the kit's small control
 * height, so it stands beside a 44-high field rather than shrinking next
 * to it, and reaches 48 through `hitSlop`. Web's `size="sm"` is not ported.
 */

const TRACK_WIDTH = 52
const TRACK_HEIGHT = control.sm
const THUMB_INSET = 3
const THUMB_SIZE = TRACK_HEIGHT - 2 * THUMB_INSET
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - 2 * THUMB_INSET

const SwitchTrack = styled(View, {
  name: "Switch",
  w: TRACK_WIDTH,
  h: TRACK_HEIGHT,
  rounded: TRACK_HEIGHT / 2,
  p: THUMB_INSET,
  justify: "center",
  hitSlop: (48 - TRACK_HEIGHT) / 2,
  cursor: "web:pointer",

  variants: {
    checked: {
      true: { bg: "primary" },
      false: { bg: "switch-track-off" },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

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
  const theme = useTheme()
  const [progress] = useState(() => new Animated.Value(checked ? 1 : 0))

  useEffect(() => {
    const toValue = checked ? 1 : 0
    if (isReduceMotionEnabled()) {
      progress.setValue(toValue)
      return
    }
    // Tailwind's default transition: 150 ms, ease-in-out.
    const animation = Animated.timing(progress, {
      toValue,
      duration: 150,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [checked, progress])

  return (
    <SwitchTrack
      checked={checked}
      disabled={disabled}
      onPress={disabled ? undefined : () => onCheckedChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      // Its name as testID too: an e2e flow's `id:` then hits this switch,
      // not a same-named control on a screen mounted under it (Android).
      testID={ariaLabel}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: checked
              ? theme["switch-thumb-on"]?.val
              : theme["switch-thumb-off"]?.val,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, THUMB_TRAVEL],
                }),
              },
            ],
          },
        ]}
      />
    </SwitchTrack>
  )
}

const styles = StyleSheet.create({
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
})
