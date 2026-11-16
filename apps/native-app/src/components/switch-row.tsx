import { Text, XStack, YStack } from "tamagui"
import { fontSize, fontWeight } from "../theme/tokens.ts"
import { Switch } from "./ui/switch.tsx"

/**
 * One settings row that is a label and a switch, at least 44 high: the main
 * bitcoin method, tips on or off, the VAT status. The switch trails; an
 * optional description sits under the label in `xs` muted text, and the label
 * column wraps beside the switch when either runs long. The label names the
 * switch for a screen reader and the e2e flows (`ui/switch` makes it the
 * testID). Native only: web draws the same as a horizontal `Field` around a
 * `Switch`.
 */
export function SwitchRow({
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  /** Already translated. */
  readonly label: string
  /** Already translated; drawn under the label. */
  readonly description?: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onCheckedChange: (checked: boolean) => void
}) {
  return (
    <XStack items="center" justify="space-between" gap={12} minH={44} px={4}>
      <YStack flex={1} minW={0} gap={4}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
        >
          {label}
        </Text>
        {description === undefined ? null : (
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
          >
            {description}
          </Text>
        )}
      </YStack>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </XStack>
  )
}
