import ChevronDown from "lucide-react-native/icons/chevron-down"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"
import { Animated, Easing, View as NativeView, StyleSheet } from "react-native"
import { type GetProps, View } from "tamagui"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import type { ThemeColor } from "../../theme/themes.ts"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/collapsible.tsx` (Base UI
 * `Collapsible`): `Collapsible` holds `open` (controlled with
 * `onOpenChange`, or from `defaultOpen`), `CollapsibleTrigger` toggles it
 * and announces `expanded`, `CollapsibleContent` mounts only while open
 * (and while it closes).
 * Web styles the trigger per call site, so the trigger takes view props;
 * `useCollapsible()` gives a chevron inside it the current state.
 *
 * Motion: web's call sites ease the panel's height open and shut
 * (`h-(--collapsible-panel-height) transition-[height] duration-200
 * ease-out`) and rotate a `ChevronDown` with `transition-transform`, so
 * `CollapsibleContent` animates its height here and `CollapsibleChevron`
 * is that rotating chevron. Neither moves under reduced motion.
 */

interface CollapsibleContextValue {
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
}

const CollapsibleContext = createContext<CollapsibleContextValue>({
  open: false,
  setOpen: () => {},
})

export const useCollapsible = () => useContext(CollapsibleContext)

export function Collapsible({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly children: ReactNode
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen)
  const open = openProp ?? uncontrolled
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolled(next)
    onOpenChange?.(next)
  }
  return (
    <CollapsibleContext value={{ open, setOpen }}>
      {children}
    </CollapsibleContext>
  )
}

export function CollapsibleTrigger({
  children,
  disabled = false,
  ...viewProps
}: Omit<GetProps<typeof View>, "onPress" | "disabled"> & {
  readonly children: ReactNode
  /** As web's trigger `disabled`: the panel stays as it is. */
  readonly disabled?: boolean
}) {
  const { open, setOpen } = useCollapsible()
  return (
    <View
      role="button"
      aria-expanded={open}
      aria-disabled={disabled}
      hitSlop={8}
      cursor={disabled ? undefined : "web:pointer"}
      onPress={disabled ? undefined : () => setOpen(!open)}
      {...viewProps}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  measure: { position: "absolute", top: 0, left: 0, right: 0 },
  fill: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
})

/**
 * Opening mounts the content and eases its height from 0 to the measured
 * content height (200 ms, Tailwind's `ease-out`); closing eases it back and
 * unmounts once shut. Height cannot run on the native driver, so this one
 * panel animates on the JS thread. While it moves, the content lays out
 * at its own height in an absolute box the panel clips; settled open, it
 * lays out normally, so a panel whose content grows follows it. The tree
 * stays the same either way, so the content keeps its state.
 *
 * `fillHeight`, settled, has the panel take the rest of its parent column,
 * as the bill's side panel does on a large monitor (web's `lg:flex
 * lg:min-h-0 lg:flex-1`): a content view with `flex={1}` then has a height
 * to fill, and a list inside it scrolls.
 */
export function CollapsibleContent({
  children,
  fillHeight = false,
  ...viewProps
}: GetProps<typeof View> & {
  readonly children: ReactNode
  readonly fillHeight?: boolean
}) {
  const { open } = useCollapsible()
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0))
  const [contentHeight] = useState(() => new Animated.Value(0))
  const [height] = useState(() => Animated.multiply(progress, contentHeight))
  const [shownOpen, setShownOpen] = useState(open)
  const [mounted, setMounted] = useState(open)
  const [animating, setAnimating] = useState(false)

  if (open !== shownOpen) {
    setShownOpen(open)
    if (isReduceMotionEnabled()) {
      setMounted(open)
      setAnimating(false)
    } else {
      if (open) setMounted(true)
      setAnimating(true)
    }
  }

  useEffect(() => {
    if (!animating) {
      progress.setValue(open ? 1 : 0)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: Easing.bezier(0, 0, 0.2, 1),
      useNativeDriver: false,
    })
    animation.start(({ finished }) => {
      if (!finished) return
      setAnimating(false)
      if (!open) setMounted(false)
    })
    return () => animation.stop()
  }, [animating, open, progress])

  if (!mounted) return null
  return (
    <Animated.View
      style={
        animating
          ? { height, overflow: "hidden" }
          : fillHeight
            ? styles.fill
            : undefined
      }
    >
      <NativeView
        style={
          animating ? styles.measure : fillHeight ? styles.fill : undefined
        }
        onLayout={(event) =>
          contentHeight.setValue(event.nativeEvent.layout.height)
        }
      >
        <View {...viewProps}>{children}</View>
      </NativeView>
    </Animated.View>
  )
}

/**
 * Web's trigger chevron, `ChevronDown` with `transition-transform
 * group-data-panel-open:rotate-180`: it turns over as the panel opens (150
 * ms, Tailwind's default transition), on the native driver. `direction` is
 * where it points while closed: `up` for a panel that opens upwards, as
 * the bill's bottom summary does.
 */
export function CollapsibleChevron({
  size,
  color,
  direction = "down",
}: {
  readonly size?: number
  readonly color?: ThemeColor
  readonly direction?: "down" | "up"
}) {
  const { open } = useCollapsible()
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0))

  useEffect(() => {
    const toValue = open ? 1 : 0
    if (isReduceMotionEnabled()) {
      progress.setValue(toValue)
      return
    }
    const animation = Animated.timing(progress, {
      toValue,
      duration: 150,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [open, progress])

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange:
                direction === "down" ? ["0deg", "180deg"] : ["180deg", "0deg"],
            }),
          },
        ],
      }}
    >
      <Icon icon={ChevronDown} size={size} color={color} />
    </Animated.View>
  )
}
