import { createContext, type ReactNode, useContext, useMemo } from "react"
import { styled, View } from "tamagui"
import { shape } from "../../theme/tokens.ts"
import { useFieldLabelControl } from "./field.tsx"

/**
 * Web `apps/web-app/src/components/ui/radio-group.tsx`: `RadioGroup` (`grid
 * w-full gap-2`) of `RadioGroupItem`s, a `size-4 rounded-full border
 * border-input` circle, checked `bg-primary` with a `size-2`
 * `primary-foreground` dot, `disabled:opacity-50`.
 *
 * Native differences: the circle is 20, Linky's control size, its ring the
 * radio itself in `muted-foreground` (the kit draws no box borders; this is
 * the control's shape, as web's is), checked a filled `primary` with an 8
 * dot. A plain `value`/`onValueChange` as `ui/toggle-group`, and an item
 * selected stays selected when pressed again. Inside a choice card
 * (`FieldLabel` around a `Field`, `ui/field`) the whole card presses the
 * item and carries its role and checked state; the item alone reaches 48
 * through `hitSlop`. Base: a controlled Tamagui `View`, not Tamagui
 * `RadioGroup`, which has not been tried on the device.
 */

interface RadioGroupContextValue {
  readonly value: string | null
  readonly onValueChange: (value: string) => void
  readonly disabled: boolean
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(
  undefined
)

export interface RadioGroupProps<Value extends string> {
  readonly value: Value | null
  readonly onValueChange: (value: Value) => void
  /** Translated group name announced by screen readers. */
  readonly "aria-label"?: string
  readonly disabled?: boolean
  readonly children: ReactNode
}

export function RadioGroup<Value extends string>({
  value,
  onValueChange,
  "aria-label": ariaLabel,
  disabled = false,
  children,
}: RadioGroupProps<Value>) {
  const context = useMemo<RadioGroupContextValue>(
    () => ({
      value,
      // Items carry plain strings; every one of them is a `Value`.
      onValueChange: (next) => onValueChange(next as Value),
      disabled,
    }),
    [value, onValueChange, disabled]
  )
  return (
    <RadioGroupContext value={context}>
      <View role="radiogroup" aria-label={ariaLabel} gap={8}>
        {children}
      </View>
    </RadioGroupContext>
  )
}

const RadioGroupItemFrame = styled(View, {
  name: "RadioGroupItem",
  w: 20,
  h: 20,
  shrink: 0,
  rounded: shape.pill,
  items: "center",
  justify: "center",

  variants: {
    checked: {
      true: { bg: "primary" },
      false: { borderWidth: 2, borderColor: "muted-foreground" },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

export interface RadioGroupItemProps {
  readonly value: string
  /** Disables this item alone, as web's item `disabled`. */
  readonly disabled?: boolean
  /** Already translated; unneeded inside a choice card, which reads its text. */
  readonly "aria-label"?: string
}

export function RadioGroupItem({
  value,
  disabled = false,
  "aria-label": ariaLabel,
}: RadioGroupItemProps) {
  const group = useContext(RadioGroupContext)
  if (group === undefined)
    throw new Error("RadioGroupItem must be inside a RadioGroup")
  const checked = group.value === value
  const inactive = group.disabled || disabled
  const { onValueChange } = group
  const select = () => onValueChange(value)
  const inCard = useFieldLabelControl({
    role: "radio",
    checked,
    disabled: inactive,
    onPress: select,
  })
  return (
    <RadioGroupItemFrame
      checked={checked}
      {...(inCard
        ? // The card fades as a whole and is what a screen reader reads.
          { "aria-hidden": true }
        : {
            disabled: inactive,
            role: "radio",
            "aria-checked": checked,
            "aria-disabled": inactive,
            "aria-label": ariaLabel,
            hitSlop: 14,
            cursor: "web:pointer",
            onPress: inactive ? undefined : select,
          })}
    >
      {checked ? (
        <View w={8} h={8} rounded={shape.pill} bg="primary-foreground" />
      ) : null}
    </RadioGroupItemFrame>
  )
}
