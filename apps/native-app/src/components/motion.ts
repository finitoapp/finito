import { Animated, Easing } from "react-native"
import { isReduceMotionEnabled } from "../platform/reduce-motion.ts"

/**
 * Web's motion, shared by the native effects that port it. Everything runs
 * on RN `Animated` with the native driver, on plain `Animated.View`s (the
 * Tamagui config has no animation driver; `ui/skeleton.tsx` says why not an
 * animated Tamagui view), and every caller skips it under reduced motion
 * (`platform/reduce-motion.ts`), as web's `useReducedMotion` and
 * `motion-reduce:` do.
 */

/**
 * The change pulse of web's `useChangePulse` and the keypad's amount (motion
 * keyframes over `times` [0, 0.55, 1], 0.32 s ease-out) as one 0 → 1
 * progress interpolated over `inputRange` (web eases each segment, here the
 * eased progress spans all of them).
 */
export const changePulseKeyframes = {
  inputRange: [0, 0.55, 1],
  opacity: [0.6, 1, 1],
  scale: [0.94, 1.03, 1],
  duration: 320,
} as const

/**
 * Drives `value` to `toValue` on `timing`'s curve, or at once under reduced
 * motion: the menu pill's slide, a dragged row's neighbours making room.
 */
export const animateTo = (
  value: Animated.Value,
  toValue: number,
  timing: { readonly duration: number; readonly easing: (t: number) => number }
) => {
  if (isReduceMotionEnabled()) {
    value.setValue(toValue)
    return
  }
  Animated.timing(value, {
    toValue,
    duration: timing.duration,
    easing: timing.easing,
    useNativeDriver: true,
  }).start()
}

/** Restarts `progress` from 0 to 1, cutting off a run still in flight. */
export const replay = (progress: Animated.Value, duration: number) => {
  progress.stopAnimation()
  progress.setValue(0)
  Animated.timing(progress, {
    toValue: 1,
    duration,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  }).start()
}

/**
 * The change pulse's opacity and scale for an `Animated.View`; a settled
 * `progress` (1) draws the view as it is.
 */
export const changePulseStyle = (progress: Animated.Value) => ({
  opacity: progress.interpolate({
    inputRange: changePulseKeyframes.inputRange,
    outputRange: changePulseKeyframes.opacity,
  }),
  transform: [
    {
      scale: progress.interpolate({
        inputRange: changePulseKeyframes.inputRange,
        outputRange: changePulseKeyframes.scale,
      }),
    },
  ],
})
