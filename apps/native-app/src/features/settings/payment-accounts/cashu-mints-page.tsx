import { formatMintLabel } from "@payky/app-shared/cashu-withdraw-flow"
import { router } from "expo-router"
import Plus from "lucide-react-native/icons/plus"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Text, XStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
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
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { useCashuKnownMints } from "../../shared/cashu/use-cashu-known-mints.ts"
import { useCashuWalletSnapshot } from "../../shared/cashu/use-cashu-wallet-snapshot.ts"
import { getCashuMintSections } from "./cashu-mints-page-model.ts"

/**
 * The wallet's mints, as web's `CashuMintsPage`: the known ones with their
 * balances once the wallet is read, the suggested ones, and "Add mint". The
 * screen keeps its header while it loads (a list skeleton) or fails (a retry
 * alert).
 */
export function CashuMintsPage() {
  const { t } = useTranslation()
  return (
    <Screen>
      <FadeHeader title={t("settings.cashuMints.title")} />
      <CashuMints />
    </Screen>
  )
}

function CashuMints() {
  const { t } = useTranslation()
  const locale = useLocale()
  const wallet = useCashuWalletSnapshot()
  const mints = useCashuKnownMints()
  const snapshot = wallet.snapshot

  if (wallet.isError || mints.isError) {
    return (
      <Alert variant="destructive" icon={TriangleAlert}>
        <AlertDescription>
          <Text aria-live="polite">{t("appError.description")}</Text>
        </AlertDescription>
        <AlertAction>
          <Button
            size="sm"
            variant="outline"
            label={t("appError.tryAgain")}
            onPress={() => {
              void wallet.refetch()
              void mints.refetch()
            }}
          />
        </AlertAction>
      </Alert>
    )
  }
  if (wallet.isPending || snapshot === null || mints.isPending)
    return <ListSkeleton rows={3} title={t("settings.cashuMints.known")} />

  const { known, suggested } = getCashuMintSections(
    snapshot.defaultMint,
    mints.data
  )
  const balanceAction = (mint: (typeof known)[number]) => (
    <Text
      fontSize={fontSize.xs}
      lineHeight={fontSize.xs}
      color="muted-foreground"
      fontVariant={["tabular-nums"]}
    >
      {t("withdraw.sats", {
        amount: formatSatsAmount(snapshot.balances.get(mint) ?? 0, locale),
      })}
    </Text>
  )

  return (
    <>
      {!snapshot.hydrated ? (
        <Text
          px={4}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("settings.cashuAccount.syncing")}
        </Text>
      ) : null}
      <VerticalNav
        title={t("settings.cashuMints.known")}
        items={known.map((mint) => ({
          id: mint,
          kind: "link" as const,
          href: {
            pathname: "/settings/payment-accounts/cashu/mints/[mint]" as const,
            params: { mint },
          },
          accessibilityLabel: formatMintLabel(mint),
          label: (
            // Not flex={1}: the row's label slot is a column, where it
            // would size the label to no height (settings-page.tsx).
            <XStack w="100%" items="center" gap={8}>
              <MintLabel mint={mint} />
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
            label: <MintLabel mint={mint} />,
            action: balanceAction(mint),
          }))}
        />
      )}
      <Button
        size="lg"
        variant="outline"
        iconStart={Plus}
        label={t("settings.cashuMints.add")}
        onPress={() =>
          router.push("/settings/payment-accounts/cashu/mints/new")
        }
      />
    </>
  )
}

/** A mint row's title, as `VerticalNavRow` draws a string label. */
function MintLabel({ mint }: { readonly mint: string }) {
  return (
    <Text
      shrink={1}
      numberOfLines={1}
      fontSize={fontSize.sm}
      lineHeight={fontSize.sm}
      fontWeight={fontWeight.medium}
    >
      {formatMintLabel(mint)}
    </Text>
  )
}
