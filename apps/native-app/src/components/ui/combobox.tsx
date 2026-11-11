import Check from "lucide-react-native/icons/check"
import ChevronDown from "lucide-react-native/icons/chevron-down"
import { createContext, type ReactNode, useContext, useState } from "react"
import { styled, Text, View } from "tamagui"
import { control, fontSize, shape } from "../../theme/tokens.ts"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog.tsx"
import { Icon } from "./icon.tsx"
import { Input } from "./input.tsx"

/**
 * Web `apps/web-app/src/components/ui/combobox.tsx`, in the shape web's
 * forms use it: `Combobox`, `ComboboxTrigger` around `ComboboxValue`, and
 * `ComboboxContent` holding `ComboboxInput` (the search) over
 * `ComboboxList` and its `ComboboxItem`s. Web's `value`/`onValueChange`
 * and `inputValue`/`onInputValueChange`; `items` maps a value to the label
 * `ComboboxValue` shows, as `ui/select`'s does. The caller filters the
 * items by `inputValue` itself, as web's `filter={null}`.
 *
 * Drawn as `ui/select`: the trigger is the filled field with a muted
 * `ChevronDown`, the items 44 high with a `Check` on the selected one.
 *
 * Native differences: the popup is `ui/dialog`'s centered sheet, as
 * `ui/select`'s, with the search at its top and focused, so the keyboard
 * comes up with it; the sheet moves up with the keyboard. `ComboboxContent`
 * takes the translated `title` the sheet shows. A `ComboboxItem` takes a
 * `trailing` control (an icon button acting on that row), which web's
 * items do not have. `open`/`onOpenChange` may be controlled, so a
 * caller can close the sheet before opening a dialog of its own.
 */

interface ComboboxContextValue {
  readonly value: string | null
  readonly items: Readonly<Partial<Record<string, string>>> | undefined
  readonly inputValue: string
  readonly onInputValueChange: (inputValue: string) => void
  readonly open: boolean
  readonly setOpen: (open: boolean) => void
  readonly select: (value: string) => void
  readonly disabled: boolean
}

const ComboboxContext = createContext<ComboboxContextValue | undefined>(
  undefined
)

const useCombobox = (): ComboboxContextValue => {
  const context = useContext(ComboboxContext)
  if (context === undefined)
    throw new Error("Combobox parts must be inside Combobox")
  return context
}

export function Combobox<Value extends string>({
  value,
  onValueChange,
  items,
  inputValue,
  onInputValueChange,
  open: controlledOpen,
  onOpenChange,
  disabled = false,
  children,
}: {
  readonly value: Value | null
  readonly onValueChange: (value: Value) => void
  /** Already translated labels; `ComboboxValue` shows the selected one. */
  readonly items?: Readonly<Partial<Record<Value, string>>>
  readonly inputValue: string
  readonly onInputValueChange: (inputValue: string) => void
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly disabled?: boolean
  readonly children: ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  return (
    <ComboboxContext
      value={{
        value,
        items,
        inputValue,
        onInputValueChange,
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
    </ComboboxContext>
  )
}

const TriggerFrame = styled(View, {
  name: "ComboboxTrigger",
  flexDirection: "row",
  items: "center",
  justify: "space-between",
  self: "stretch",
  gap: 6,
  h: control.md,
  py: 8,
  pr: 10,
  pl: 12,
  rounded: shape.control,
  bg: "input-bg press:input-50",
  cursor: "web:pointer",

  variants: {
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

export function ComboboxTrigger({
  "aria-label": ariaLabel,
  children,
}: {
  /** Already translated; the field's label. */
  readonly "aria-label"?: string
  readonly children: ReactNode
}) {
  const combobox = useCombobox()
  return (
    <TriggerFrame
      disabled={combobox.disabled}
      hitSlop={8}
      onPress={combobox.disabled ? undefined : () => combobox.setOpen(true)}
      role="combobox"
      aria-label={ariaLabel}
      // As ui/select: its name doubles as testID for e2e `id:` selectors.
      testID={ariaLabel}
      aria-expanded={combobox.open}
      aria-disabled={combobox.disabled}
    >
      {children}
      <Icon icon={ChevronDown} color="muted-foreground" />
    </TriggerFrame>
  )
}

/** The selected item's label from `items`, else `placeholder`. */
export function ComboboxValue({
  placeholder,
}: {
  readonly placeholder?: string
}) {
  const { value, items } = useCombobox()
  const label = value === null ? undefined : items?.[value]
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

export function ComboboxContent({
  title,
  children,
}: {
  /** Already translated. */
  readonly title?: string
  readonly children: ReactNode
}) {
  const { open, setOpen } = useCombobox()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        {title === undefined ? null : (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <View gap={8}>{children}</View>
      </DialogContent>
    </Dialog>
  )
}

/** The search at the top of the sheet, bound to `inputValue`. */
export function ComboboxInput({
  placeholder,
  "aria-label": ariaLabel,
}: {
  /** Already translated. */
  readonly placeholder?: string
  /** Already translated; defaults to `placeholder`. */
  readonly "aria-label"?: string
}) {
  const { inputValue, onInputValueChange } = useCombobox()
  return (
    <Input
      value={inputValue}
      onChangeText={onInputValueChange}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      autoFocus
      autoCorrect={false}
      autoComplete="off"
    />
  )
}

export const ComboboxList = styled(View, {
  name: "ComboboxList",
  role: "list",
  gap: 2,
})

const ItemFrame = styled(View, {
  name: "ComboboxItem",
  flexDirection: "row",
  items: "center",
  gap: 6,
  minH: 44,
  py: 4,
  pl: 6,
  pr: 8,
  rounded: shape.control,
  bg: "transparent press:neutral-soft",
  cursor: "web:pointer",

  variants: {
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

export function ComboboxItem({
  value,
  disabled = false,
  trailing,
  children,
}: {
  readonly value: string
  readonly disabled?: boolean
  /** A control acting on this row, after its check. */
  readonly trailing?: ReactNode
  /** Already translated text, or custom content. */
  readonly children: ReactNode
}) {
  const combobox = useCombobox()
  const selected = combobox.value === value
  return (
    <ItemFrame
      disabled={disabled}
      onPress={disabled ? undefined : () => combobox.select(value)}
      role="option"
      aria-selected={selected}
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
      {trailing}
    </ItemFrame>
  )
}
