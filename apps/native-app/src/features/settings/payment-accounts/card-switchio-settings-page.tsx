import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { setCardSwitchioAutoLaunch } from "@payky/core/modules/account/account-actions"
import { cardSwitchioAccountQuery } from "@payky/core/modules/account/account-queries"
import {
  type CardSwitchioAutoLaunch,
  CardSwitchioAutoLaunchSchema,
  defaultCardSwitchioAutoLaunch,
} from "@payky/core/modules/account/account-types"
import { router } from "expo-router"
import CalendarCheck from "lucide-react-native/icons/calendar-check"
import ExternalLink from "lucide-react-native/icons/external-link"
import { Linking } from "react-native"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { OptionToggleGroup } from "../../../components/option-toggle-group.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

/** Switchio's page about the terminal app, still under its SoftPOS name. */
const SWITCHIO_PAY_URL = "https://switchio.com/try-softpos/"

const cardAutoLaunchLabelKeys = {
  open: {
    title: "settings.cardSwitchioAccount.autoLaunch.open.title",
    description: "settings.cardSwitchioAccount.autoLaunch.open.description",
  },
  select: {
    title: "settings.cardSwitchioAccount.autoLaunch.select.title",
    description: "settings.cardSwitchioAccount.autoLaunch.select.description",
  },
  button: {
    title: "settings.cardSwitchioAccount.autoLaunch.button.title",
    description: "settings.cardSwitchioAccount.autoLaunch.button.description",
  },
} satisfies Record<
  CardSwitchioAutoLaunch,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

/**
 * As web's: the terminal itself is configured in the SwitchioPay app, which
 * this app drives through the `switchio.pay.ECR` intent, so the screen says
 * what it needs and when the payment screen opens it (payment/0033). The
 * two requirements read as muted bullets, as Spark's do.
 */
export function CardSwitchioSettingsPage() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [account] = useEvoluQuery(cardSwitchioAccountQuery).data
  const autoLaunch = useInlineChoice<CardSwitchioAutoLaunch>(
    account?.autoLaunch ?? defaultCardSwitchioAutoLaunch,
    (next) =>
      runToast(async (run) => {
        if (account === undefined) return
        await run.ok(
          setCardSwitchioAutoLaunch({ accountId: account.id, autoLaunch: next })
        )
      })
  )

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
          <YStack gap={8}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >{`• ${t("settings.cardSwitchioAccount.info.switchioPay")}`}</Text>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >{`• ${t("settings.cardSwitchioAccount.info.contract")}`}</Text>
            <Button
              size="lg"
              variant="outline"
              iconStart={ExternalLink}
              label={t("settings.cardSwitchioAccount.info.switchioPayLink")}
              onPress={() => void Linking.openURL(SWITCHIO_PAY_URL)}
            />
          </YStack>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {t("settings.cardSwitchioAccount.autoLaunch.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.cardSwitchioAccount.autoLaunch.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionToggleGroup
            value={autoLaunch.value}
            options={CardSwitchioAutoLaunchSchema.options.map((value) => ({
              value,
              title: t(cardAutoLaunchLabelKeys[value].title),
              description: t(cardAutoLaunchLabelKeys[value].description),
            }))}
            disabled={account === undefined || autoLaunch.saving}
            onChange={(next) => void autoLaunch.choose(next)}
          />
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
