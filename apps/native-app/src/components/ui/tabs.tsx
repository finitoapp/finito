import { createContext, type ReactNode, useContext, useState } from "react"
import { type GetProps, styled, Text, View } from "tamagui"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/tabs.tsx`, horizontal and
 * `variant="default"`, the only form web pages use (`line` and vertical tabs
 * have no user and are not ported).
 *
 * Tailwind mirrored: `Tabs` `flex-col gap-2`; `TabsList` `h-8 rounded-lg
 * p-[3px] bg-muted`; `TabsTrigger` `flex-1 rounded-md border
 * border-transparent px-1.5 py-0.5 text-sm font-medium text-foreground/60`
 * (dark `text-muted-foreground`), active `bg-background text-foreground`
 * (dark `border-input bg-input/30`); `TabsContent` `flex-1`. The active
 * trigger's light-theme `shadow-sm` is left out.
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

export const TabsList = styled(View, {
  name: "TabsList",
  role: "tablist",
  flexDirection: "row",
  items: "center",
  justify: "center",
  h: 32,
  p: 3,
  rounded: radius.lg,
  bg: "muted",
})

const TriggerFrame = styled(View, {
  name: "TabsTrigger",
  flex: 1,
  self: "stretch",
  flexDirection: "row",
  items: "center",
  justify: "center",
  gap: 6,
  px: 6,
  rounded: radius.md,
  borderWidth: 1,
  borderColor: "transparent",
  hitSlop: { top: 8, bottom: 8 },
  cursor: "web:pointer",

  variants: {
    active: { true: { bg: "tabs-active", borderColor: "tabs-active-border" } },
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
    active: { true: { color: "color" } },
  } as const,
})

export interface TabsTriggerProps
  extends Omit<GetProps<typeof TriggerFrame>, "children" | "active"> {
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
  const active = tabs.value === value
  return (
    <TriggerFrame
      active={active}
      disabled={disabled}
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
