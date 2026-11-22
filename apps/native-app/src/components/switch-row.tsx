import { Text, YStack } from "tamagui"
import { ListItemFrame } from "tamagui/unstyled"
import { fontSize, fontWeight, shape } from "../theme/tokens.ts"
import { pressFillClause, useFastTransition } from "./ui/press-fill.tsx"
import { Switch } from "./ui/switch.tsx"

/**
 * One settings row that is a label and a switch, at least 44 high: the main
 * bitcoin method, tips on or off, the VAT status. The switch trails; an
 * optional description sits under the label in `xs` muted text, and the label
 * column wraps beside the switch when either runs long. The label names the
 * switch for a screen reader and the e2e flows (`ui/switch` makes it the
 * testID). Native only: web draws the same as a horizontal `Field` around a
 * `Switch`.
 *
 * A Tamagui `ListItemFrame`: a press anywhere on the row flips the switch,
 * under the neutral fill on the kit's `fast` transition. The row itself is
 * not announced; the switch is.
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
  const transition = useFastTransition()
  return (
    <ListItemFrame
      gap={12}
      minH={44}
      // The fill reaches 8 past the text, which stays 4 in as before.
      px={12}
      mx={-8}
      rounded={shape.control}
      bg={
        disabled
          ? "transparent"
          : pressFillClause({ rest: "transparent", pressed: "neutral-soft" })
      }
      transition={transition}
      cursor={disabled ? undefined : "web:pointer"}
      onPress={disabled ? undefined : () => onCheckedChange(!checked)}
      role="none"
      accessible={false}
    >
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
    </ListItemFrame>
  )
}
