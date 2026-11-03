import { satsToFiat } from "@payky/core/modules/shared/money"
import { router } from "expo-router"
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right"
import Clock3 from "lucide-react-native/icons/clock-3"
import Landmark from "lucide-react-native/icons/landmark"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Suspense, useState } from "react"
import { ActivityIndicator, Platform } from "react-native"
import { Text, View, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { LoadingView } from "../../../components/loading-view.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { useBtcFiat } from "../../../hooks/use-btc-fiat.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatAmount, formatSatsAmount } from "../../../lib/format-money.ts"
import { control, fontSize, fontWeight, shape } from "../../../theme/tokens.ts"
import { useCashuWalletSnapshot } from "../../shared/cashu/use-cashu-wallet-snapshot.ts"

export function CashuAccountSettingsPage() {
  const { t } = useTranslation()
  return (
    <Screen>
      <FadeHeader title={t("settings.cashuAccount.title")} />
      <CashuAccountSettingsBody />
    </Screen>
  )
}

/** The page's content, also the Bitcoin screen's Linky-wallet half (settings/0002). */
export function CashuAccountSettingsBody() {
  return (
    <Suspense fallback={<LoadingView />}>
      <CashuAccountSettingsContent />
    </Suspense>
  )
}

/**
 * Fazole's wallet screen: the balance alone, large, in the shop's currency,
 * in sats while tapped (it starts in fiat on every visit, so a merchant
 * never lands on sats unexpectedly); then "Withdraw funds" while there is
 * anything to withdraw, and the rows for the mints and the withdrawals.
 * No card, no label, no second lines (fazole-ui-minimal-copy).
 */
function CashuAccountSettingsContent() {
  const { t } = useTranslation()
  const { snapshot, isPending, isError, refetch } = useCashuWalletSnapshot()

  if (isError) {
    return (
      <Alert variant="destructive" icon={TriangleAlert}>
        <AlertDescription>
          <Text aria-live="polite">{t("appError.description")}</Text>
        </AlertDescription>
        <AlertAction>
          <Button
            size="lg"
            variant="outline"
            label={t("appError.tryAgain")}
            onPress={() => void refetch()}
          />
        </AlertAction>
      </Alert>
    )
  }
  if (isPending || snapshot === null) {
    return (
      <YStack flex={1} items="center" justify="center">
        <ActivityIndicator size="large" />
      </YStack>
    )
  }
  const total = [...snapshot.balances.values()].reduce(
    (sum, sats) => sum + sats,
    0
  )

  return (
    <YStack gap={24}>
      <YStack items="center" py={24} gap={4}>
        <WalletBalance sats={total} />
        {snapshot.hydrated ? null : (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("settings.cashuAccount.syncing")}
          </Text>
        )}
      </YStack>
      {total > 0 ? (
        <Button
          size="lg"
          iconStart={ArrowUpRight}
          label={t("settings.cashuAccount.withdraw")}
          testID="cashu-withdraw"
          onPress={() => router.push("/cashu-withdraw/new")}
        />
      ) : null}
      <VerticalNav
        items={[
          {
            kind: "link",
            href: "/settings/payment-accounts/cashu/mints",
            icon: <Icon icon={Landmark} color="muted-foreground" />,
            label: t("settings.cashuAccount.mints"),
          },
          {
            kind: "link",
            href: "/cashu-withdraw",
            icon: <Icon icon={Clock3} color="muted-foreground" />,
            label: t("withdraw.history.title"),
          },
        ]}
      />
    </YStack>
  )
}

/**
 * The wallet's sats as money: the amount in the shop's currency at today's
 * rate, or in sats while tapped, and in sats alone while there is no rate.
 * Linky's `Amount`: a 48 bold figure with its unit beside it.
 */
function WalletBalance({ sats }: { readonly sats: number }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const fiat = useBtcFiat()
  const [showSats, setShowSats] = useState(false)
  const inFiat = fiat.rate !== null && !showSats
  const value = inFiat
    ? formatAmount(
        satsToFiat({ sats, exchangeRate: fiat.rate ?? 0 }),
        fiat.currency,
        locale
      )
    : t("withdraw.sats", { amount: formatSatsAmount(sats, locale) })
  const switchable = fiat.rate !== null
  return (
    <View
      px={16}
      minH={control.lg}
      justify="center"
      rounded={shape.control}
      bg={switchable ? "transparent press:neutral-soft" : "transparent"}
      cursor={switchable ? "web:pointer" : undefined}
      accessible
      role={switchable ? "button" : undefined}
      aria-label={value}
      {...(Platform.OS === "web" && switchable
        ? { title: t("settings.cashuAccount.balance.switchUnit") }
        : {})}
      onPress={
        switchable ? () => setShowSats((current) => !current) : undefined
      }
      testID="cashu-balance"
    >
      <Text
        fontSize="3xl"
        lineHeight="3xl"
        fontWeight={fontWeight.bold}
        fontVariant={["tabular-nums"]}
        text="center"
      >
        {value}
      </Text>
    </View>
  )
}
