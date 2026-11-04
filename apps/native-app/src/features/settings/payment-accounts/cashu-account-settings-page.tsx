import { cashuWalletTotal } from "@payky/app-shared/cashu-withdraw-flow"
import { defaultCashuPaymentRequestLegs } from "@payky/core/cashu/cashu-payment-request"
import { cashuAccountQuery } from "@payky/core/modules/account/account-queries"
import Clock3 from "lucide-react-native/icons/clock-3"
import Landmark from "lucide-react-native/icons/landmark"
import QrCode from "lucide-react-native/icons/qr-code"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Suspense } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
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
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
import { useCashuWalletSnapshot } from "../../shared/cashu/use-cashu-wallet-snapshot.ts"
import { WalletBody } from "../../shared/wallet-body.tsx"
import { cashuPaymentQrLabelKeys } from "./cashu-payment-qr-page.tsx"

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
 * The shared wallet body (`WalletBody`) over the Linky wallet's balance,
 * with the rows for the mints, the payment QR choice and the withdrawals;
 * a wallet still syncing simply shows what it has so far.
 */
function CashuAccountSettingsContent() {
  const { t } = useTranslation()
  const { snapshot, isPending, isError, refetch } = useCashuWalletSnapshot()
  const [account] = useEvoluQuery(cashuAccountQuery).data

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
  const total = cashuWalletTotal(snapshot.balances)

  return (
    <WalletBody
      sats={total}
      withdrawHref="/cashu-withdraw/new"
      testID="cashu-balance"
      items={[
        {
          kind: "link",
          href: "/settings/payment-accounts/cashu/mints",
          icon: <Icon icon={Landmark} color="muted-foreground" />,
          label: t("settings.cashuAccount.mints"),
        },
        {
          kind: "link",
          href: "/settings/payment-accounts/cashu/payment-qr",
          icon: <Icon icon={QrCode} color="muted-foreground" />,
          accessibilityLabel: t("settings.cashuAccount.qr.title"),
          // The row's title and its current value, as the settings list's rows.
          label: (
            <XStack
              flex={1}
              minW={0}
              items="center"
              justify="space-between"
              gap={12}
            >
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight="600"
              >
                {t("settings.cashuAccount.qr.title")}
              </Text>
              <Text
                color="muted-foreground"
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                numberOfLines={1}
              >
                {t(
                  cashuPaymentQrLabelKeys[
                    account?.paymentRequestLegs ??
                      defaultCashuPaymentRequestLegs
                  ]
                )}
              </Text>
            </XStack>
          ),
        },
        {
          kind: "link",
          href: "/cashu-withdraw",
          icon: <Icon icon={Clock3} color="muted-foreground" />,
          label: t("withdraw.history.title"),
        },
      ]}
    />
  )
}
