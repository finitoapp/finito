import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import { terminalHomeModes } from "@payky/core/modules/app-settings/app-settings-utils"
import { Text, XStack, YStack } from "tamagui"
import { SwitchRow } from "../../components/switch-row.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize } from "../../theme/tokens.ts"
import { HomeModeCard } from "../shared/home-mode-card.tsx"

const sellingModes = {
  numpad: {
    title: "onboarding.selling.numpad.title",
    description: "onboarding.selling.numpad.description",
  },
  pos: {
    title: "onboarding.selling.pos.title",
    description: "onboarding.selling.pos.description",
  },
} as const satisfies Record<
  TerminalHomeMode,
  {
    readonly title: TranslationKey
    readonly description: TranslationKey
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
          <HomeModeCard
            key={mode}
            mode={mode}
            title={t(sellingModes[mode].title)}
            description={t(sellingModes[mode].description)}
            role="radio"
            checked={homeMode === mode}
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
