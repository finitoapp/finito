import { Text, XStack } from "tamagui"
import { CollapsibleChevron } from "../../../components/ui/collapsible.tsx"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"

/**
 * The "Advanced" collapsible trigger's content on the payment-method screens
 * (IBAN, Spark, Qerko terminal and payment, the Qerko pairing wizard): the
 * label and a chevron that turns with the open state.
 *
 * Web draws it inline in each screen's `CollapsibleTrigger`: `flex w-full
 * items-center justify-between text-left text-sm font-medium` with a
 * rotating `ChevronDown`.
 */
export function AdvancedSettingsLabel({ label }: { readonly label: string }) {
  return (
    <XStack items="center" justify="space-between" w="100%">
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {label}
      </Text>
      <CollapsibleChevron color="muted-foreground" />
    </XStack>
  )
}
