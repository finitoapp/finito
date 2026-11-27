import { type ReactNode, useContext } from "react"
import { styled } from "tamagui"
import {
  RadioGroupContext,
  RadioGroup as TamaguiRadioGroup,
} from "tamagui/unstyled"
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
 * through `hitSlop`.
 *
 * Base: Tamagui `RadioGroup`, controlled through `value` (`""` for none,
 * which no item carries), its `RadioGroup.Item` a `<button>` on web with
 * the browser's border cleared, the dot its `RadioGroup.Indicator`.
 */

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
  return (
    <TamaguiRadioGroup
      value={value ?? ""}
      // Items carry plain strings; every one of them is a `Value`.
      onValueChange={(next) => onValueChange(next as Value)}
      disabled={disabled}
      aria-label={ariaLabel}
      gap={8}
    >
      {children}
    </TamaguiRadioGroup>
  )
}

const RadioGroupItemFrame = styled(TamaguiRadioGroup.Item, {
  name: "RadioGroupItem",
  w: 20,
  h: 20,
  p: 0,
  shrink: 0,
  rounded: shape.pill,
  // At rest too, so enabling fades back (`useKitTransition`).
  opacity: 1,

  variants: {
    checked: {
      true: { bg: "primary", borderWidth: 0 },
      false: {
        bg: "transparent",
        borderWidth: 2,
        borderColor: "muted-foreground",
      },
    },
    inactive: { true: { opacity: 0.5 } },
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
  const checked = group.value === value
  const inactive = group.disabled === true || disabled
  const inCard = useFieldLabelControl({
    role: "radio",
    checked,
    disabled: inactive,
    onPress: () => group.onChange?.(value),
  })
  return (
    <RadioGroupItemFrame
      value={value}
      disabled={inactive}
      checked={checked}
      inactive={inactive}
      {...(inCard
        ? // The card fades as a whole and is what a screen reader reads.
          { "aria-hidden": true }
        : {
            "aria-label": ariaLabel,
            hitSlop: 14,
            cursor: "web:pointer",
          })}
    >
      <TamaguiRadioGroup.Indicator
        w={8}
        h={8}
        rounded={shape.pill}
        bg="primary-foreground"
      />
    </RadioGroupItemFrame>
  )
}
