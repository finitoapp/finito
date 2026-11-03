import { formatMintLabel } from "@payky/app-shared/cashu-withdraw-flow"
import { router } from "expo-router"
import Plus from "lucide-react-native/icons/plus"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "../../../components/ui/alert.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../../lib/format-money.ts"
import { useCashuKnownMints } from "../../shared/cashu/use-cashu-known-mints.ts"
import { useCashuWalletSnapshot } from "../../shared/cashu/use-cashu-wallet-snapshot.ts"
import { getCashuMintSections } from "./cashu-mints-page-model.ts"

export function CashuMintsPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const wallet = useCashuWalletSnapshot()
  const mints = useCashuKnownMints()
  const snapshot = wallet.snapshot

  if (wallet.isError || mints.isError) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Alert variant="destructive" icon={TriangleAlert}>
          <AlertDescription>
            <Text aria-live="polite">{t("appError.description")}</Text>
          </AlertDescription>
          <AlertAction>
            <Button
              size="lg"
              variant="outline"
              label={t("appError.tryAgain")}
              onPress={() => {
                void wallet.refetch()
                void mints.refetch()
              }}
            />
          </AlertAction>
        </Alert>
      </YStack>
    )
  }
  if (wallet.isPending || snapshot === null || mints.isPending)
    return (
      <YStack flex={1} items="center" justify="center">
        <ActivityIndicator size="large" />
      </YStack>
    )

  const { known, suggested } = getCashuMintSections(
    snapshot.defaultMint,
    mints.data
  )
  const balanceAction = (mint: (typeof known)[number]) => (
    <Text
      fontSize="xs"
      lineHeight="xs"
      color="muted-foreground"
      fontVariant={["tabular-nums"]}
    >
      {t("withdraw.sats", {
        amount: formatSatsAmount(snapshot.balances.get(mint) ?? 0, locale),
      })}
    </Text>
  )

  return (
    <Screen>
      <FadeHeader title={t("settings.cashuMints.title")} />
      {!snapshot.hydrated ? (
        <Text color="muted-foreground">
          {t("settings.cashuAccount.syncing")}
        </Text>
      ) : null}
      <YStack gap="4">
        <VerticalNav
          title={t("settings.cashuMints.known")}
          items={known.map((mint) => ({
            id: mint,
            kind: "link" as const,
            href: {
              pathname:
                "/settings/payment-accounts/cashu/mints/[mint]" as const,
              params: { mint },
            },
            accessibilityLabel: formatMintLabel(mint),
            label: (
              // Not flex={1}: the row's label slot is a column, where it
              // would size the label to no height (settings-page.tsx).
              <XStack w="100%" items="center" gap="2">
                <Text flexShrink={1} numberOfLines={1}>
                  {formatMintLabel(mint)}
                </Text>
                {mint === snapshot.defaultMint ? (
                  <Badge
                    variant="secondary"
                    label={t("settings.cashuMints.default")}
                  />
                ) : null}
              </XStack>
            ),
            action: snapshot.hydrated ? balanceAction(mint) : undefined,
          }))}
          empty={snapshot.hydrated ? t("settings.cashuMints.empty") : undefined}
        />
        {suggested.length === 0 ? null : (
          <VerticalNav
            title={t("settings.cashuMints.suggested")}
            items={suggested.map((mint) => ({
              id: mint,
              kind: "link" as const,
              href: {
                pathname:
                  "/settings/payment-accounts/cashu/mints/[mint]" as const,
                params: { mint },
              },
              accessibilityLabel: formatMintLabel(mint),
              label: <Text numberOfLines={1}>{formatMintLabel(mint)}</Text>,
              action: balanceAction(mint),
            }))}
          />
        )}
      </YStack>
      <Button
        size="lg"
        variant="outline"
        iconStart={Plus}
        label={t("settings.cashuMints.add")}
        onPress={() =>
          router.push("/settings/payment-accounts/cashu/mints/new")
        }
      />
    </Screen>
  )
}
