import { createContext, type ReactNode, useContext, useState } from "react"
import type { LayoutRectangle } from "react-native"
import { type GetProps, styled, Text, View } from "tamagui"
import { Tabs as TamaguiTabs } from "tamagui/unstyled"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import {
  type PressFillColors,
  pressFillClause,
  useFastTransition,
  useKitTransition,
} from "./press-fill.tsx"

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
 * view under the triggers that slides to the active one (web's
 * `ActivityTabs` slides Base UI's indicator the same way), on the menu
 * pill's 220 ms ease-out; reduced motion moves it at once. It slides by
 * `translateX` on the native driver, so a screen mounting on the JS thread
 * at the same moment (a tab that is its own route) cannot stall it; the
 * triggers share the list equally, so it takes the active one's width as
 * it is rather than animating it. A list mounted
 * anew (a tab that is its own route) places it without sliding, so a pill
 * that should travel needs its list to stay mounted, as `ActivityLayout`
 * keeps Activity's.
 *
 * Base: Tamagui `Tabs` (roles, ids, roving focus, press activation), always
 * controlled by the kit's own value so a trigger knows whether it is
 * active; the selected trigger reports its layout through `onInteraction`,
 * which places the pill.
 *
 * An inactive trigger's hover and press fill is a flat clause on its frame,
 * faded by the kit's `fast` transition (`press-fill.tsx`).
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
      <TamaguiTabs value={value} onValueChange={select} gap={8}>
        {props.children}
      </TamaguiTabs>
    </TabsContext>
  )
}

const ListFrame = styled(TamaguiTabs.List, {
  name: "TabsList",
  flexDirection: "row",
  items: "center",
  justify: "center",
  h: 36,
  p: 3,
  rounded: shape.pill,
  bg: "neutral-soft",
})

/** Where the selected trigger sits in its list, for the pill. */
const SelectedLayoutContext = createContext<
  ((layout: LayoutRectangle) => void) | undefined
>(undefined)

/**
 * The accent pill under the selected trigger, sliding to it on the kit's
 * `slide` transition. Its size sits on a still frame and only the inner
 * view moves, by `x` alone: a transition covering a width would take the
 * node off the native driver. A pill mounted anew (its first measure, a
 * list that is its own route) is placed without sliding.
 */
export function SlidingPill({
  layout,
  rounded,
}: {
  readonly layout: LayoutRectangle
  readonly rounded: number
}) {
  const transition = useKitTransition("slide")
  return (
    <View
      pointerEvents="none"
      aria-hidden
      position="absolute"
      t={layout.y}
      l={0}
      w={layout.width}
      h={layout.height}
    >
      <View
        position="absolute"
        t={0}
        r={0}
        b={0}
        l={0}
        rounded={rounded}
        bg="primary"
        x={layout.x}
        transition={transition}
      />
    </View>
  )
}

export type TabsListProps = GetProps<typeof ListFrame>

export function TabsList({ children, ...frameProps }: TabsListProps) {
  const [target, setTarget] = useState<LayoutRectangle>()
  return (
    <ListFrame {...frameProps}>
      {target === undefined ? null : (
        <SlidingPill layout={target} rounded={shape.pill} />
      )}
      <SelectedLayoutContext value={setTarget}>
        {children}
      </SelectedLayoutContext>
    </ListFrame>
  )
}

const TriggerFrame = styled(TamaguiTabs.Tab, {
  name: "TabsTrigger",
  // Tamagui renders the trigger as a `<button>` on web.
  borderWidth: 0,
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
  // At rest too, so enabling fades back (`useKitTransition`).
  opacity: 1,

  variants: {
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

/**
 * Web's `hover:text-foreground` as a fill a step above the list's, which
 * fades in; the active trigger takes none, so it never covers the pill.
 */
const triggerFill = {
  rest: "transparent",
  pressed: "button-outline-pressed",
} as const satisfies PressFillColors

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
  extends Omit<
    GetProps<typeof TriggerFrame>,
    "children" | "rounded" | "bg" | "backgroundColor"
  > {
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
  ...frameProps
}: TabsTriggerProps) {
  const tabs = useTabs()
  const reportSelected = useContext(SelectedLayoutContext)
  const active = tabs.value === value
  const transition = useFastTransition()
  return (
    <TriggerFrame
      value={value}
      disabled={disabled}
      // Tamagui's list is a Group, which squares inner corners; keep pills.
      rounded={shape.pill}
      bg={active ? "transparent" : pressFillClause(triggerFill)}
      transition={transition}
      onInteraction={(type, layout) => {
        if (type === "select" && layout !== null) reportSelected?.(layout)
      }}
      onPress={onPress}
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
  return (
    <TamaguiTabs.Content value={value} flex={1}>
      {children}
    </TamaguiTabs.Content>
  )
}
