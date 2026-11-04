import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Animated, Easing, type LayoutRectangle } from "react-native"
import { type GetProps, styled, Text, useTheme, View } from "tamagui"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/tabs.tsx`, horizontal and
 * `variant="default"`, the only form web pages use (`line` and vertical tabs
 * have no user and are not ported).
 *
 * Tailwind mirrored: `Tabs` `flex-col gap-2`; `TabsList` `h-8 rounded-lg
 * p-[3px] bg-muted`; `TabsTrigger` `flex-1 rounded-md border
 * border-transparent px-1.5 py-0.5 text-sm font-medium text-foreground/60`
 * (dark `text-muted-foreground`); `TabsContent` `flex-1`. The active
 * trigger is the accent pill with the accent's text, as the menu bar's
 * (Linky's `TabBar`), where web tints it `bg-background`. The pill is one
 * view under the triggers that slides and resizes to the active one (web's
 * `ActivityTabs` slides Base UI's indicator the same way), on the menu
 * pill's 220 ms ease-out; reduced motion moves it at once. A list mounted
 * anew (a tab that is its own route) places it without sliding, so a pill
 * that should travel needs its list to stay mounted, as `ActivityLayout`
 * keeps Activity's.
 *
 * Controlled (`value` + `onValueChange`) or not (`defaultValue`), as web.
 * A trigger with its own `onPress` (web's `render={<Link />}`, a tab that is
 * a route) still selects its value. Base: Tamagui `View`s with the tab
 * roles, not Tamagui `Tabs`, which has not been tried on the device.
 */

interface TabsContextValue {
  readonly value: string
  readonly select: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

const useTabs = (): TabsContextValue => {
  const context = useContext(TabsContext)
  if (context === undefined) throw new Error("Tabs parts must be inside Tabs")
  return context
}

type TabsProps<Value extends string> = {
  readonly children: ReactNode
} & (
  | {
      readonly value: Value
      readonly onValueChange?: (value: Value) => void
      readonly defaultValue?: never
    }
  | {
      readonly defaultValue: Value
      readonly value?: never
      readonly onValueChange?: never
    }
)

export function Tabs<Value extends string>(props: TabsProps<Value>) {
  const [uncontrolled, setUncontrolled] = useState<string>(
    props.defaultValue ?? ""
  )
  const value = props.value ?? uncontrolled
  const select = (next: string) => {
    if (props.value === undefined) setUncontrolled(next)
    // Triggers carry plain strings; every one of them is a `Value`.
    else props.onValueChange?.(next as Value)
  }
  return (
    <TabsContext value={{ value, select }}>
      <View gap={8}>{props.children}</View>
    </TabsContext>
  )
}

const ListFrame = styled(View, {
  name: "TabsList",
  role: "tablist",
  flexDirection: "row",
  items: "center",
  justify: "center",
  h: 36,
  p: 3,
  rounded: shape.pill,
  bg: "neutral-soft",
})

/** Where each trigger of a list sits in it, for the pill. */
const TriggerLayoutContext = createContext<
  ((value: string, layout: LayoutRectangle) => void) | undefined
>(undefined)

/** The menu pill's slide (`menu-nav.tsx`): Linky's `base`, 220 ms ease-out. */
const slide = { duration: 220, easing: Easing.out(Easing.cubic) }

/**
 * The active trigger's box as animated values: placed at once the first
 * time it is known, slid there on every later change. Left and width are
 * layout props, which the native driver cannot animate.
 */
function usePillBox(target: LayoutRectangle | undefined) {
  const [left] = useState(() => new Animated.Value(0))
  const [width] = useState(() => new Animated.Value(0))
  const placed = useRef(false)
  const x = target?.x
  const w = target?.width
  useEffect(() => {
    if (x === undefined || w === undefined) return
    if (!placed.current || isReduceMotionEnabled()) {
      left.setValue(x)
      width.setValue(w)
      placed.current = true
      return
    }
    Animated.parallel([
      Animated.timing(left, { toValue: x, ...slide, useNativeDriver: false }),
      Animated.timing(width, { toValue: w, ...slide, useNativeDriver: false }),
    ]).start()
  }, [x, w, left, width])
  return { left, width }
}

export type TabsListProps = GetProps<typeof ListFrame>

export function TabsList({ children, ...frameProps }: TabsListProps) {
  const theme = useTheme()
  const { value } = useTabs()
  const [layouts, setLayouts] = useState<
    Readonly<Record<string, LayoutRectangle>>
  >({})
  const target = layouts[value]
  const { left, width } = usePillBox(target)
  const report = (trigger: string, layout: LayoutRectangle) => {
    setLayouts((current) => {
      const known = current[trigger]
      return known !== undefined &&
        known.x === layout.x &&
        known.y === layout.y &&
        known.width === layout.width &&
        known.height === layout.height
        ? current
        : { ...current, [trigger]: layout }
    })
  }
  return (
    <ListFrame {...frameProps}>
      {target === undefined ? null : (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: target.y,
            height: target.height,
            left,
            width,
            borderRadius: shape.pill,
            backgroundColor: theme.primary.val,
          }}
        />
      )}
      <TriggerLayoutContext value={report}>{children}</TriggerLayoutContext>
    </ListFrame>
  )
}

const TriggerFrame = styled(View, {
  name: "TabsTrigger",
  // An equal share of the list, written as its longhands: Yoga reads an
  // explicit `flexBasis: "auto"` as no basis at all, so under the `flex: 1`
  // shorthand a trigger sized by its content (the payment screen's methods)
  // still started from a zero basis on Android and lost its label.
  grow: 1,
  flexBasis: 0,
  self: "stretch",
  flexDirection: "row",
  items: "center",
  justify: "center",
  gap: 6,
  px: 6,
  // fazole.fit's segmented control: pills, the active one filled.
  rounded: shape.pill,
  hitSlop: { top: 8, bottom: 8 },
  cursor: "web:pointer",

  variants: {
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

const TriggerText = styled(Text, {
  name: "TabsTriggerText",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  fontWeight: fontWeight.medium,
  color: "tabs-trigger",

  variants: {
    active: { true: { color: "primary-foreground" } },
  } as const,
})

export interface TabsTriggerProps
  extends Omit<GetProps<typeof TriggerFrame>, "children"> {
  readonly value: string
  /** Already translated text, or custom content. */
  readonly children: ReactNode
  readonly disabled?: boolean
  readonly onPress?: () => void
}

export function TabsTrigger({
  value,
  children,
  disabled = false,
  onPress,
  onLayout,
  ...frameProps
}: TabsTriggerProps) {
  const tabs = useTabs()
  const report = useContext(TriggerLayoutContext)
  const active = tabs.value === value
  return (
    <TriggerFrame
      disabled={disabled}
      onLayout={(event) => {
        report?.(value, event.nativeEvent.layout)
        onLayout?.(event)
      }}
      onPress={
        disabled
          ? undefined
          : () => {
              tabs.select(value)
              onPress?.()
            }
      }
      role="tab"
      aria-selected={active}
      aria-disabled={disabled}
      {...frameProps}
    >
      {typeof children === "string" ? (
        <TriggerText active={active} numberOfLines={1}>
          {children}
        </TriggerText>
      ) : (
        children
      )}
    </TriggerFrame>
  )
}

/** Renders its children only while its tab is selected. */
export function TabsContent({
  value,
  children,
}: {
  readonly value: string
  readonly children: ReactNode
}) {
  return useTabs().value === value ? <View flex={1}>{children}</View> : null
}
