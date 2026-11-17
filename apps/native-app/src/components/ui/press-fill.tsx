import { useRef, useState } from "react"
import { Animated, StyleSheet, View } from "react-native"
import { isWeb } from "tamagui"
import { useAppColors } from "../../theme/app-colors.ts"
import type { ThemeColor } from "../../theme/themes.ts"
import { duration } from "../../theme/tokens.ts"

/**
 * No web counterpart: web's `hover:bg-*`/`active:bg-*` is CSS. The fill a
 * pressable kit control fades to under the finger, drawn on native as a
 * layer of its own: an `Animated.View` filling the frame (`absoluteFill`, at
 * the frame's radius, first child, so the content draws over it) whose
 * color one `Animated.Value` crossfades on the native driver, started by
 * the frame's own `onPressIn`/`onPressOut`. The frame keeps the layout, the
 * shape and the press, and carries no `transition`.
 *
 * Not a `transition="fast"` view with a `press:` clause, for two reasons:
 * - Tamagui's React Native driver animates every key the transition
 *   covers, eleven on a kit Button (the fill, four border widths, four
 *   radii, its height), on the JS driver whenever a height is among them.
 * - A press reaches an animated Tamagui view through its style emitter,
 *   which retargets a color by building a new interpolation the committed
 *   view never receives; the press fill then shows only when something
 *   else re-renders it, and can stay after release.
 *
 * On the PWA this draws nothing: the frame keeps the flat clause
 * (`pressFillClause`) and `transition="fast"`, which web runs as a CSS
 * transition.
 *
 * The recipe: `const fill = usePressFill({ disabled, onPressIn, onPressOut })`,
 * hand `fill.onPressIn`/`fill.onPressOut` to the frame (through `useButton`
 * where there is one, which strips them from a nested button), render
 * `<PressFill progress={fill.progress} colors={...} rounded={...} />` as its
 * first child, and on web give the frame `bg={pressFillClause(colors)}` and
 * `transition="fast"`. The `rounded` must be the frame's: React Native has
 * no inherited radius, and clipping the frame (`overflow="hidden"`) would
 * cut the fill's corners without antialiasing on Android.
 */

/** A fill at rest and under the finger (or the pointer, on web), as theme keys. */
export interface PressFillColors {
  readonly rest: ThemeColor | "transparent"
  readonly pressed: ThemeColor
}

/** The flat clause web draws the same fill with, on the frame itself. */
export const pressFillClause = (
  colors: PressFillColors
): `${string} ${string}` => {
  // Widened: the template over every theme key pair is too large a union.
  const { rest, pressed }: { readonly rest: string; readonly pressed: string } =
    colors
  return `${rest} hover:${pressed} press:${pressed}`
}

const fadeTo = (progress: Animated.Value, toValue: 0 | 1) => {
  Animated.timing(progress, {
    toValue,
    duration: duration.fast,
    useNativeDriver: true,
  }).start()
}

/**
 * The progress a `PressFill` draws and the frame's press handlers, the
 * caller's own composed after the fill's, so the fill starts before
 * whatever work the press does. On web it returns the caller's handlers as
 * they are.
 *
 * The animated layer is mounted on the first press, not with the control:
 * a list drew an animated view per row that nobody touched. `progress` is
 * `null` until then, and `PressFill` draws only the rest color, plainly.
 *
 * Every change of `disabled` starts again at rest. A frame that
 * turns disabled under the finger drops its handlers before the release
 * arrives (`pending` set by its own `onPress`), and one that turns active
 * (a menu tab, a nav row) unmounts its `PressFill` mid-press; fading the
 * old value back instead loses a race on the native driver, whose detached
 * node reports its last value (pressed) after the fade, so the fill came
 * back pressed when the control was pressable again.
 */
export function usePressFill<Event>({
  disabled,
  onPressIn,
  onPressOut,
}: {
  readonly disabled: boolean
  readonly onPressIn?: ((event: Event) => void) | undefined
  readonly onPressOut?: ((event: Event) => void) | undefined
}) {
  const [state, setState] = useState<{
    readonly disabled: boolean
    readonly progress: Animated.Value | null
  }>(() => ({ disabled, progress: null }))
  if (state.disabled !== disabled) setState({ disabled, progress: null })
  // The value a release fades back: a release can land before the render
  // that mounts the layer the press created it for.
  const pressedRef = useRef<Animated.Value | null>(null)
  const { progress } = state
  if (isWeb) return { progress, onPressIn, onPressOut }
  return {
    progress,
    onPressIn: (event: Event) => {
      const value = progress ?? new Animated.Value(0)
      if (progress === null) setState({ disabled, progress: value })
      pressedRef.current = value
      fadeTo(value, 1)
      onPressIn?.(event)
    },
    onPressOut: (event: Event) => {
      if (pressedRef.current !== null) fadeTo(pressedRef.current, 0)
      onPressOut?.(event)
    },
  }
}

interface PressFillProps {
  /** `null` until the first press: nothing is drawn until then. */
  readonly progress: Animated.Value | null
  readonly colors: PressFillColors
  /** The frame's corner radius. */
  readonly rounded: number
}

export function PressFill({ progress, ...props }: PressFillProps) {
  if (isWeb) return null
  return progress === null ? (
    <RestFill {...props} />
  ) : (
    <NativePressFill progress={progress} {...props} />
  )
}

/**
 * The fill before the first press: the rest color as a plain view, as the
 * frame draws none of its own on native, or nothing for a transparent one
 * (a list row), where the saving is.
 */
function RestFill({ colors, rounded }: Omit<PressFillProps, "progress">) {
  const appColors = useAppColors()
  return colors.rest === "transparent" ? null : (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: rounded, backgroundColor: appColors[colors.rest] },
      ]}
    />
  )
}

function NativePressFill({
  progress,
  colors,
  rounded,
}: PressFillProps & { readonly progress: Animated.Value }) {
  const appColors = useAppColors()
  const color = (key: ThemeColor | "transparent") =>
    key === "transparent" ? key : appColors[key]
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: rounded,
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [color(colors.rest), color(colors.pressed)],
          }),
        },
      ]}
    />
  )
}
