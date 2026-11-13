import Check from "lucide-react-native/icons/check"
import ChevronDown from "lucide-react-native/icons/chevron-down"
import { createContext, type ReactNode, useContext, useState } from "react"
import { styled, Text, View } from "tamagui"
import { control, fontSize, shape } from "../../theme/tokens.ts"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog.tsx"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/select.tsx`: `Select`,
 * `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup`,
 * `SelectLabel`, `SelectItem`, with web's `value`/`onValueChange` and
 * `items` (value → label, which `SelectValue` shows).
 *
 * Tailwind mirrored: trigger `gap-1.5 py-2 pr-2.5 pl-3 text-sm` with a
 * muted `ChevronDown`, drawn as fazole.fit's filled field (`ui/input`): 12
 * round, 44 high, no border (`sm` a 32 pill); label `px-1.5 py-1 text-xs
 * text-muted-foreground`; item `gap-1.5 rounded-md py-1 pl-1.5 text-sm
 * focus:bg-accent` with a `Check` on the selected one.
 *
 * Native differences: the list opens in `ui/dialog` (a centered sheet on the
 * proven RN `Modal`) rather than a popup anchored to the trigger, as plan
 * fallback to Tamagui `Select`'s untried `Adapt`/`Sheet`; items are at
 * least 44 high for touch, highlighted by the neutral fill. `SelectContent`
 * takes the translated `title` the sheet shows, usually the field's label.
 */

interface SelectContextValue {
  readonly value: string | null
  readonly items: Readonly<Partial<Record<string, string>>> | undefined
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
  readonly select: (value: string) => void
  readonly disabled: boolean
}

const SelectContext = createContext<SelectContextValue | undefined>(undefined)

const useSelect = (): SelectContextValue => {
  const context = useContext(SelectContext)
  if (context === undefined)
    throw new Error("Select parts must be inside Select")
  return context
}

export function Select<Value extends string>({
  value,
  onValueChange,
  items,
  disabled = false,
  children,
}: {
  readonly value: Value | null
  readonly onValueChange: (value: Value) => void
  /** Already translated labels; `SelectValue` shows the selected one. */
  readonly items?: Readonly<Partial<Record<Value, string>>>
  readonly disabled?: boolean
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <SelectContext
      value={{
        value,
        items,
        open,
        setOpen,
        select: (next) => {
          setOpen(false)
          // Items carry plain strings; every one of them is a `Value`.
          onValueChange(next as Value)
        },
        disabled,
      }}
    >
      {children}
    </SelectContext>
  )
}

const TriggerFrame = styled(View, {
  name: "SelectTrigger",
  flexDirection: "row",
  items: "center",
  justify: "space-between",
  self: "flex-start",
  gap: 6,
  py: 8,
  pr: 10,
  pl: 12,
  rounded: shape.control,
  transition: "fast",
  bg: "input-bg hover:input-50 press:input-50",
  cursor: "web:pointer",

  variants: {
    size: {
      // fazole's filled field, 44 to match the kit Input next to it in a form.
      default: { h: control.md },
      // No vertical padding: 8 of it left 10 of the 28 for 14-high text,
      // which React Native clips where CSS lets it overflow.
      sm: { h: control.sm, py: 0, rounded: shape.pill },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,

  defaultVariants: { size: "default" },
})

export function SelectTrigger({
  size,
  "aria-label": ariaLabel,
  fullWidth = false,
  children,
}: {
  readonly size?: "default" | "sm"
  /** Already translated; the field's label. */
  readonly "aria-label"?: string
  /** Web's `w-full` on the trigger. */
  readonly fullWidth?: boolean
  readonly children: ReactNode
}) {
  const select = useSelect()
  return (
    <TriggerFrame
      size={size}
      disabled={select.disabled}
      hitSlop={size === "sm" ? 10 : 8}
      onPress={select.disabled ? undefined : () => select.setOpen(true)}
      role="combobox"
      aria-label={ariaLabel}
      // As ui/switch: its name doubles as testID for e2e `id:` selectors.
      testID={ariaLabel}
      aria-expanded={select.open}
      aria-disabled={select.disabled}
      {...(fullWidth ? { self: "stretch" } : {})}
    >
      {children}
      <Icon icon={ChevronDown} color="muted-foreground" />
    </TriggerFrame>
  )
}

/**
 * `children` when given (a string is styled as a selected label: React Native
 * renders text only inside a `Text`), else the selected item's label from
 * `items`, else `placeholder`.
 */
export function SelectValue({
  placeholder,
  children,
}: {
  readonly placeholder?: string
  readonly children?: ReactNode
}) {
  const { value, items } = useSelect()
  if (children !== undefined && typeof children !== "string")
    return <View shrink={1}>{children}</View>
  const label =
    typeof children === "string"
      ? children
      : value === null
        ? undefined
        : items?.[value]
  return (
    <Text
      shrink={1}
      numberOfLines={1}
      fontSize={fontSize.sm}
      lineHeight={fontSize.sm}
      color={label === undefined ? "muted-foreground" : "color"}
    >
      {label ?? placeholder ?? ""}
    </Text>
  )
}

export function SelectContent({
  title,
  children,
}: {
  /** Already translated. */
  readonly title?: string
  readonly children: ReactNode
}) {
  const { open, setOpen } = useSelect()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        {title === undefined ? null : (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <View gap={4}>{children}</View>
      </DialogContent>
    </Dialog>
  )
}

export const SelectGroup = styled(View, {
  name: "SelectGroup",
  role: "list",
  gap: 2,
})

export const SelectLabel = styled(Text, {
  name: "SelectLabel",
  px: 6,
  py: 4,
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  color: "muted-foreground",
})

const ItemFrame = styled(View, {
  name: "SelectItem",
  flexDirection: "row",
  items: "center",
  gap: 6,
  minH: 44,
  py: 4,
  pl: 6,
  pr: 8,
  rounded: shape.control,
  transition: "fast",
  bg: "transparent hover:neutral-soft press:neutral-soft",
  cursor: "web:pointer",

  variants: {
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

export function SelectItem({
  value,
  disabled = false,
  children,
}: {
  readonly value: string
  readonly disabled?: boolean
  /** Already translated text, or custom content. */
  readonly children: ReactNode
}) {
  const select = useSelect()
  const selected = select.value === value
  return (
    <ItemFrame
      disabled={disabled}
      onPress={disabled ? undefined : () => select.select(value)}
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
    >
      <View flex={1}>
        {typeof children === "string" ? (
          <Text fontSize={fontSize.sm} lineHeight={fontSize.sm}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
      <View opacity={selected ? 1 : 0}>
        <Icon icon={Check} />
      </View>
    </ItemFrame>
  )
}
