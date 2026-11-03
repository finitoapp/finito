import {
  type ComponentRef,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { Animated, Easing, View as NativeView } from "react-native"
import { Text, useTheme, View } from "tamagui"
import { isReduceMotionEnabled } from "../platform/reduce-motion.ts"
import type { ThemeColor } from "../theme/themes.ts"
import { fontSize, fontWeight, radius } from "../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/sliding-pill.tsx`: the content of one
 * segment of a control whose active segment carries a foreground pill and a
 * label, while inactive segments show only their icon — the home mode
 * switch and the payment method tabs. The control primitive (ToggleGroup,
 * Tabs) stays the caller's, as on web; the caller draws the icon in the
 * color it is given and wraps the control in a `SlidingPillTrack`, which
 * draws its border.
 *
 * Tailwind mirrored: the pill `absolute inset-0 rounded-full bg-foreground`
 * behind the content, the label `whitespace-nowrap pl-1.5` in
 * `text-background`, the icon `text-muted-foreground
 * aria-pressed:text-background transition-colors duration-300` (a
 * cross-fade of the two colors, so it runs on the native driver).
 *
 * Motion, on web's principle (motion's layout animation, FLIP): a switch
 * lays everything out at its new size at once, and each visible box is then
 * drawn from where it was to where it is with transforms, all on one curve
 * (web's spring, bounce 0, 0.35 s, as an ease-out): the track stretches to
 * the control's new width, the pill slides and stretches from the segment
 * that had it to the new one, and every icon slides to its new spot. The
 * label fades in once the pill has mostly arrived (0.2 s delay, 0.15 s).
 * The segments themselves are transparent, so their sizes may jump.
 *
 * The boxes are read synchronously in `useLayoutEffect`, which the New
 * Architecture commits before painting, so the jump is never drawn; the
 * transforms run on the native driver, so a busy JS thread does not make
 * them stutter. Boxes are measured on views that are never transformed. The
 * pill's and track's round ends stretch with the scale while they move,
 * where web's motion corrects the radius. Reduced motion switches at once.
 * Segments must not clip, or the arriving pill is cut off.
 */

interface Box {
  readonly x: number
  readonly width: number
}

/** Where each control's pill was last drawn, in window coordinates. */
const pillBoxes = new Map<string, Box>()

const slide = { duration: 350, easing: Easing.out(Easing.cubic) }

interface FlipValues {
  readonly translateX: Animated.Value
  readonly scaleX: Animated.Value
}

/**
 * Measures `ref` after every render and, when `from` names an earlier box,
 * returns the transform that draws the element from there to its new box.
 * `from` receives the new box, so it can also remember it.
 */
function useFlip(
  ref: RefObject<ComponentRef<typeof NativeView> | null>,
  from: (to: Box) => Box | undefined
) {
  const [values, setValues] = useState<FlipValues | null>(null)

  useLayoutEffect(() => {
    if (ref.current === null) return
    const rect = ref.current.getBoundingClientRect()
    // A hidden screen (web hides one it navigated away from) lays the
    // control out at zero width; remembering that box would grow it from
    // nothing on the way back.
    if (rect.width === 0) return
    const to = { x: rect.x, width: rect.width }
    const start = from(to)
    if (
      start === undefined ||
      isReduceMotionEnabled() ||
      (start.x === to.x && start.width === to.width)
    )
      return
    // Fresh values carry the start into the committed props, so the first
    // painted frame is already the old box.
    setValues({
      translateX: new Animated.Value(
        start.x + start.width / 2 - (to.x + to.width / 2)
      ),
      scaleX: new Animated.Value(start.width / to.width),
    })
  })

  useEffect(() => {
    if (values === null) return
    const animation = Animated.parallel([
      Animated.timing(values.translateX, {
        toValue: 0,
        ...slide,
        useNativeDriver: true,
      }),
      Animated.timing(values.scaleX, {
        toValue: 1,
        ...slide,
        useNativeDriver: true,
      }),
    ])
    animation.start()
    return () => animation.stop()
  }, [values])

  return values === null
    ? []
    : [{ translateX: values.translateX }, { scaleX: values.scaleX }]
}

/** `from` for an element that moves with layout: its own previous box. */
function usePreviousBox() {
  const previous = useRef<Box | undefined>(undefined)
  return (to: Box) => {
    const start = previous.current
    previous.current = to
    return start
  }
}

const fill = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const

/**
 * The control's rounded border (and fill), drawn behind it so it can
 * stretch with the switch: web gives the group itself the layout animation.
 */
export function SlidingPillTrack({
  /** Inside the 1 px border, as a `border p-N` wrapper's. */
  padding,
  borderColor,
  bg,
  children,
}: {
  readonly padding: number
  /** A hairline around the track; fazole.fit's segmented control has none, so it is off unless named. */
  readonly borderColor?: ThemeColor
  readonly bg?: ThemeColor
  readonly children: ReactNode
}) {
  const theme = useTheme()
  const ref = useRef<ComponentRef<typeof NativeView>>(null)
  const transform = useFlip(ref, usePreviousBox())
  return (
    <NativeView ref={ref} style={{ padding: padding + 1 }}>
      <Animated.View
        pointerEvents="none"
        style={{
          ...fill,
          transform,
          borderRadius: radius.full,
          borderWidth: borderColor === undefined ? 0 : 1,
          borderColor:
            borderColor === undefined ? undefined : theme[borderColor]?.val,
          backgroundColor: bg === undefined ? undefined : theme[bg]?.val,
        }}
      />
      {children}
    </NativeView>
  )
}

export function SlidingPillSegmentContent({
  active,
  pillId,
  icon,
  label,
}: {
  readonly active: boolean
  /** Unique per control: segments sharing it are what the pill slides between. */
  readonly pillId: string
  /** Called with each color the icon cross-fades between. */
  readonly icon: (color: ThemeColor) => ReactNode
  /** Already translated; shown only on the active segment. */
  readonly label: string
}) {
  const theme = useTheme()
  const segmentRef = useRef<ComponentRef<typeof NativeView>>(null)
  const iconRef = useRef<ComponentRef<typeof NativeView>>(null)
  // Set when this segment has just become the active one, so its pill
  // starts at the box the previous one was drawn at.
  const [arriving, setArriving] = useState(false)
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    setArriving(active)
  }

  const pillTransform = useFlip(segmentRef, (to) => {
    if (!active) return undefined
    const start = pillBoxes.get(pillId)
    pillBoxes.set(pillId, to)
    if (!arriving) return undefined
    setArriving(false)
    return start
  })
  const iconTransform = useFlip(iconRef, usePreviousBox())
  const [activeIconOpacity] = useState(() => new Animated.Value(active ? 1 : 0))
  useEffect(() => {
    const toValue = active ? 1 : 0
    if (isReduceMotionEnabled()) {
      activeIconOpacity.setValue(toValue)
      return
    }
    const animation = Animated.timing(activeIconOpacity, {
      toValue,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [active, activeIconOpacity])

  return (
    <>
      {/* The segment's box, where its pill rests; draws nothing. */}
      <NativeView ref={segmentRef} pointerEvents="none" style={fill} />
      {active ? (
        <Animated.View
          pointerEvents="none"
          style={{
            ...fill,
            transform: pillTransform,
            borderRadius: radius.full,
            backgroundColor: theme.color?.val,
          }}
        />
      ) : null}
      <View flexDirection="row" items="center">
        <NativeView ref={iconRef}>
          <Animated.View style={{ transform: iconTransform }}>
            {icon("muted-foreground")}
            <Animated.View style={{ ...fill, opacity: activeIconOpacity }}>
              {icon("background")}
            </Animated.View>
          </Animated.View>
        </NativeView>
        {active ? <SlidingPillLabel label={label} fadeIn={arriving} /> : null}
      </View>
    </>
  )
}

/** Mounts with its segment's activation; fades in only when switched to. */
function SlidingPillLabel({
  label,
  fadeIn,
}: {
  readonly label: string
  readonly fadeIn: boolean
}) {
  const [opacity] = useState(
    () => new Animated.Value(fadeIn && !isReduceMotionEnabled() ? 0 : 1)
  )
  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      delay: 200,
      duration: 150,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [opacity])
  return (
    <Animated.View style={{ opacity }}>
      <Text
        pl={6}
        numberOfLines={1}
        color="background"
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.medium}
      >
        {label}
      </Text>
    </Animated.View>
  )
}
