import Check from "lucide-react-native/icons/check"
import { Text, View } from "tamagui"
import { Icon } from "../../components/ui/icon.tsx"
import { ToggleGroupItem } from "../../components/ui/toggle-group.tsx"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/** Web's `ChoiceToggleItem`: a wrapping outline choice with a check while `selected`. */
export function ChoiceToggleItem({
  value,
  selected,
  children,
}: {
  readonly value: string
  readonly selected: boolean
  readonly children: string
}) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={children}
      h="auto"
      minH={44}
      py={8}
      justify="flex-start"
      {...(selected ? { borderColor: "primary" } : {})}
    >
      <View opacity={selected ? 1 : 0}>
        <Icon icon={Check} color="primary" />
      </View>
      <Text
        flex={1}
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.medium}
        color="color"
      >
        {children}
      </Text>
    </ToggleGroupItem>
  )
}
