import CheckIcon from "lucide-react-native/icons/check"
import { styled, View } from "tamagui"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/checkbox.tsx`: `size-4 rounded border
 * border-input bg-background` (dark `bg-input/30`), checked `border-primary
 * bg-primary` with a `size-3.5` check in `primary-foreground`,
 * `disabled:opacity-50`.
 *
 * Base: a controlled Tamagui `View` with the checkbox role, not Tamagui
 * `Checkbox`, whose uncontrolled state and indicator add nothing a
 * controlled box needs. The 16 px box reaches 48 through `hitSlop`.
 */

const CheckboxFrame = styled(View, {
  name: "Checkbox",
  w: 16,
  h: 16,
  rounded: 4,
  borderWidth: 1,
  items: "center",
  justify: "center",
  hitSlop: 16,
  cursor: "web:pointer",

  variants: {
    checked: {
      true: { bg: "primary", borderColor: "primary" },
      false: { bg: "checkbox-bg", borderColor: "input" },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

export interface CheckboxProps {
  readonly checked: boolean
  readonly onCheckedChange: (checked: boolean) => void
  readonly disabled?: boolean
  /** Already translated, unless a label beside it is pressable too. */
  readonly "aria-label"?: string
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  return (
    <CheckboxFrame
      checked={checked}
      disabled={disabled}
      onPress={disabled ? undefined : () => onCheckedChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      // As ui/switch: its name doubles as testID for e2e `id:` selectors.
      testID={ariaLabel}
    >
      {checked ? (
        <Icon
          icon={CheckIcon}
          size={14}
          color="primary-foreground"
          strokeWidth={3}
        />
      ) : null}
    </CheckboxFrame>
  )
}
