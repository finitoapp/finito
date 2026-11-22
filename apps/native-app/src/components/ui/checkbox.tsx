import CheckIcon from "lucide-react-native/icons/check"
import { Checkbox as TamaguiCheckbox } from "tamagui/unstyled"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/checkbox.tsx`: `size-4 rounded border
 * border-input bg-background` (dark `bg-input/30`), checked `border-primary
 * bg-primary` with a `size-3.5` check in `primary-foreground`,
 * `disabled:opacity-50`.
 *
 * Base: Tamagui `Checkbox`, controlled through `checked`, with the check
 * in its `Checkbox.Indicator` (mounted only while checked). Tamagui renders
 * it as a `<button>` on web, so the browser's border and padding are
 * cleared. The 16 px box reaches 48 through `hitSlop`.
 */

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
    <TamaguiCheckbox
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      disabled={disabled}
      w={16}
      h={16}
      p={0}
      borderWidth={0}
      rounded={4}
      hitSlop={16}
      cursor="web:pointer"
      bg={checked ? "primary" : "surface-raised"}
      opacity={disabled ? 0.5 : 1}
      // Tamagui sets the role only on web.
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      // As ui/switch: its name doubles as testID for e2e `id:` selectors.
      testID={ariaLabel}
    >
      <TamaguiCheckbox.Indicator>
        <Icon
          icon={CheckIcon}
          size={14}
          color="primary-foreground"
          strokeWidth={3}
        />
      </TamaguiCheckbox.Indicator>
    </TamaguiCheckbox>
  )
}
