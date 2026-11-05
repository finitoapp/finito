import { brandName } from "@payky/app-shared/brand"
import KeyRound from "lucide-react-native/icons/key-round"
import Store from "lucide-react-native/icons/store"
import { Image } from "react-native"
import { Text, YStack } from "tamagui"
import appIcon from "../../../assets/app-icon.png"
import { Button } from "../../components/ui/button.tsx"
import { appBrand } from "../../core/app-brand.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { control, fontSize, fontWeight } from "../../theme/tokens.ts"

/** fazole.fit's logo tile is 112 wide; Finito's icon is round, so it needs no corners. */
const LOGO_SIZE = 112

/**
 * The first screen, as fazole.fit's welcome (Linky's
 * `apps/fazole-app/src/screens/WelcomeScreen.tsx`): the logo, the app's
 * name and its tagline centered in the column, then the two ways in — a new
 * business (the main action) and an existing account, whose chooser
 * (onboarding/0011) asks next where it is now.
 */
export function WelcomeStep({
  pending,
  onNew,
  onRestore,
}: {
  readonly pending: boolean
  readonly onNew: () => void
  readonly onRestore: () => void
}) {
  const { t } = useTranslation()
  return (
    <YStack flex={1} justify="center" gap={20}>
      <YStack items="center" gap={16} py={20}>
        <Image
          source={appIcon}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          accessibilityIgnoresInvertColors
          aria-hidden
        />
        <YStack items="center" gap={8}>
          <Text
            fontSize={fontSize["3xl"]}
            lineHeight={fontSize["3xl"]}
            fontWeight={fontWeight.bold}
            color="foreground"
            role="heading"
            aria-level={1}
          >
            {brandName(appBrand)}
          </Text>
          <Text color="muted-foreground" text="center">
            {t("onboarding.welcome.tagline")}
          </Text>
        </YStack>
      </YStack>
      <YStack gap={8}>
        <Button
          size="lg"
          minH={control.lg}
          iconStart={Store}
          label={t("onboarding.welcome.new")}
          disabled={pending}
          onPress={onNew}
        />
        <Button
          size="lg"
          minH={control.lg}
          variant="secondary"
          iconStart={KeyRound}
          label={t("onboarding.welcome.restore")}
          disabled={pending}
          onPress={onRestore}
        />
      </YStack>
    </YStack>
  )
}
