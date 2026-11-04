import { router } from "expo-router"
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right"
import Clock3 from "lucide-react-native/icons/clock-3"
import Landmark from "lucide-react-native/icons/landmark"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Suspense } from "react"
import { ActivityIndicator } from "react-native"
import { Text, YStack } from "tamagui"
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
import { useTranslation } from "../../../hooks/use-translation.ts"
import { BitcoinBalance } from "../../shared/bitcoin-amount.tsx"
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
      <YStack py={16}>
        <BitcoinBalance
          sats={total}
          caption={
            snapshot.hydrated ? undefined : t("settings.cashuAccount.syncing")
          }
          testID="cashu-balance"
        />
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
