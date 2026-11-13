import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import { terminalHomeModes } from "@payky/core/modules/app-settings/app-settings-utils"
import Circle from "lucide-react-native/icons/circle"
import CircleCheck from "lucide-react-native/icons/circle-check"
import type { ComponentType } from "react"
import { Text, View, XStack, YStack } from "tamagui"
import { SwitchRow } from "../../components/switch-row.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import {
  BillsIllustration,
  NumpadIllustration,
} from "./selling-mode-illustrations.tsx"

const sellingModes = {
  numpad: {
    title: "onboarding.selling.numpad.title",
    description: "onboarding.selling.numpad.description",
    Illustration: NumpadIllustration,
  },
  pos: {
    title: "onboarding.selling.pos.title",
    description: "onboarding.selling.pos.description",
    Illustration: BillsIllustration,
  },
} as const satisfies Record<
  TerminalHomeMode,
  {
    readonly title: TranslationKey
    readonly description: TranslationKey
    readonly Illustration: ComponentType
  }
>

/**
 * Onboarding's last step for a new account (onboarding/0012), as web's
 * `SellingStep`: how the business sells, the keypad's final amount or bills
 * built from items, as two pictured choices of which neither is picked
 * until the merchant picks one, and whether customers may add a tip, on
 * unless switched off. The choice becomes the one mode home offers.
 */
export function SellingStep({
  homeMode,
  tipsEnabled,
  pending,
  onHomeModeChange,
  onTipsEnabledChange,
}: {
  readonly homeMode: TerminalHomeMode | null
  readonly tipsEnabled: boolean
  readonly pending: boolean
  readonly onHomeModeChange: (mode: TerminalHomeMode) => void
  readonly onTipsEnabledChange: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <YStack gap={20}>
      <XStack role="radiogroup" gap={12} items="stretch">
        {terminalHomeModes.map((mode) => (
          <SellingModeCard
            key={mode}
            mode={mode}
            selected={homeMode === mode}
            disabled={pending}
            onPress={() => onHomeModeChange(mode)}
          />
        ))}
      </XStack>
      <SwitchRow
        label={t("onboarding.selling.tips.label")}
        checked={tipsEnabled}
        disabled={pending}
        onCheckedChange={onTipsEnabledChange}
      />
      <Text
        mt={-12}
        px={4}
        color="muted-foreground"
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
      >
        {t("onboarding.selling.tips.description")}
      </Text>
    </YStack>
  )
}

/**
 * One way of selling, half the row beside the other: its picture with the
 * radio mark in its corner, then its name and what it means. A fill, no
 * border, as the kit's controls; the chosen one takes the primary's tint.
 */
function SellingModeCard({
  mode,
  selected,
  disabled,
  onPress,
}: {
  readonly mode: TerminalHomeMode
  readonly selected: boolean
  readonly disabled: boolean
  readonly onPress: () => void
}) {
  const { t } = useTranslation()
  const { title, description, Illustration } = sellingModes[mode]
  return (
    <YStack
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      aria-label={t(title)}
      testID={t(title)}
      onPress={disabled ? undefined : onPress}
      flex={1}
      flexBasis={0}
      gap={12}
      p={12}
      rounded={shape.card}
      transition="fast"
      bg={
        selected
          ? "primary-15 hover:primary-20 press:primary-20"
          : "surface-raised hover:neutral-soft press:neutral-soft"
      }
      opacity={disabled ? 0.5 : 1}
      cursor="web:pointer"
    >
      <View w="100%" aspectRatio={160 / 112}>
        <Illustration />
        <View position="absolute" t={-4} r={-4}>
          <Icon
            icon={selected ? CircleCheck : Circle}
            size={24}
            color={selected ? "primary" : "muted-foreground"}
          />
        </View>
      </View>
      <YStack gap={4}>
        <Text
          fontSize={fontSize.base}
          lineHeight={fontSize.base}
          fontWeight={fontWeight.bold}
        >
          {t(title)}
        </Text>
        <Text
          color="muted-foreground"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
        >
          {t(description)}
        </Text>
      </YStack>
    </YStack>
  )
}
