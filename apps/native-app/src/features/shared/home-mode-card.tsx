import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import Circle from "lucide-react-native/icons/circle"
import CircleCheck from "lucide-react-native/icons/circle-check"
import type { ComponentType } from "react"
import { isWeb, Text, View, YStack } from "tamagui"
import { Icon } from "../../components/ui/icon.tsx"
import {
  PressFill,
  type PressFillColors,
  pressFillClause,
  usePressFill,
} from "../../components/ui/press-fill.tsx"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import {
  BillsIllustration,
  NumpadIllustration,
} from "./selling-mode-illustrations.tsx"

const illustrations = {
  numpad: NumpadIllustration,
  pos: BillsIllustration,
} as const satisfies Record<TerminalHomeMode, ComponentType>

/** The card's fill at rest and under the finger, chosen or not. */
const cardFills = {
  checked: { rest: "primary-15", pressed: "primary-20" },
  unchecked: { rest: "surface-raised", pressed: "neutral-soft" },
} as const satisfies Record<string, PressFillColors>

/**
 * One of home's modes as a pictured choice, half the row beside the other:
 * its picture with a check mark in its corner, then its name and what it
 * means. A fill, no border, as the kit's controls; a chosen one takes the
 * primary's tint. Onboarding picks one mode with it (`role="radio"`), the
 * home screen settings turn each on or off (`role="checkbox"`).
 *
 * On native the fill is a `PressFill` layer (`ui/press-fill.tsx`), so a
 * change of `checked` snaps to the other fill rather than fading.
 */
export function HomeModeCard({
  mode,
  title,
  description,
  role,
  checked,
  disabled,
  onPress,
}: {
  readonly mode: TerminalHomeMode
  /** Already translated. */
  readonly title: string
  /** Already translated. */
  readonly description: string
  readonly role: "radio" | "checkbox"
  readonly checked: boolean
  readonly disabled: boolean
  readonly onPress: () => void
}) {
  const Illustration = illustrations[mode]
  const fill = checked ? cardFills.checked : cardFills.unchecked
  const pressFill = usePressFill({ disabled })
  return (
    <YStack
      role={role}
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={title}
      testID={title}
      onPress={disabled ? undefined : onPress}
      {...(disabled
        ? {}
        : { onPressIn: pressFill.onPressIn, onPressOut: pressFill.onPressOut })}
      flex={1}
      flexBasis={0}
      gap={12}
      p={12}
      rounded={shape.card}
      bg={isWeb ? pressFillClause(fill) : undefined}
      {...(isWeb ? { transition: "fast" as const } : {})}
      opacity={disabled ? 0.5 : 1}
      cursor="web:pointer"
    >
      <PressFill
        progress={pressFill.progress}
        colors={fill}
        rounded={shape.card}
      />
      <View w="100%" aspectRatio={160 / 112}>
        <Illustration />
        <View position="absolute" t={-4} r={-4}>
          <Icon
            icon={checked ? CircleCheck : Circle}
            size={24}
            color={checked ? "primary" : "muted-foreground"}
          />
        </View>
      </View>
      <YStack gap={4}>
        <Text
          fontSize={fontSize.base}
          lineHeight={fontSize.base}
          fontWeight={fontWeight.bold}
        >
          {title}
        </Text>
        <Text
          color="muted-foreground"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
        >
          {description}
        </Text>
      </YStack>
    </YStack>
  )
}
