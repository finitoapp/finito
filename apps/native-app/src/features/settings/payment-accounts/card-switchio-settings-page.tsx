import { router } from "expo-router"
import CalendarCheck from "lucide-react-native/icons/calendar-check"
import ExternalLink from "lucide-react-native/icons/external-link"
import { Linking } from "react-native"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"

const SOFTPOS_URL = "https://switchio.com/try-softpos/"

/**
 * Informational only, as web's: the terminal itself is configured in the
 * Switchio SoftPOS app, which this app drives through the `switchio.pay.ECR`
 * intent.
 */
export function CardSwitchioSettingsPage() {
  const { t } = useTranslation()

  return (
    <Screen>
      <FadeHeader title={t("settings.paymentAccounts.method.cardSwitchio")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.cardSwitchioAccount.info.title")}</CardTitle>
          <CardDescription>
            {t("settings.cardSwitchioAccount.info.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <YStack gap="2">
            <Text>{`• ${t("settings.cardSwitchioAccount.info.softpos")}`}</Text>
            <Text>{`• ${t("settings.cardSwitchioAccount.info.contract")}`}</Text>
            <Button
              size="lg"
              variant="outline"
              iconStart={ExternalLink}
              label={t("settings.cardSwitchioAccount.info.softposLink")}
              onPress={() => void Linking.openURL(SOFTPOS_URL)}
            />
          </YStack>
        </CardContent>
      </Card>
      {/* The closure has its own screen: it needs `confirm`, this one `admin` (access/0011). */}
      <Button
        size="lg"
        variant="secondary"
        iconStart={CalendarCheck}
        label={t("settings.cardSwitchioAccount.closureLink")}
        onPress={() => router.push("/settings/card-closure")}
      />
    </Screen>
  )
}
