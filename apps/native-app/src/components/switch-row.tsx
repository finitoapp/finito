import { Text, XStack } from "tamagui"
import { fontSize, fontWeight } from "../theme/tokens.ts"
import { Switch } from "./ui/switch.tsx"

/**
 * One settings row that is a label and a switch, 44 high: the main bitcoin
 * method, tips on or off, the VAT status. The label names the switch for a
 * screen reader and the e2e flows (`ui/switch` makes it the testID).
 */
export function SwitchRow({
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  /** Already translated. */
  readonly label: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onCheckedChange: (checked: boolean) => void
}) {
  return (
    <XStack items="center" justify="space-between" gap={12} minH={44} px={4}>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {label}
      </Text>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </XStack>
  )
}
