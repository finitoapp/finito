import {
  type BitcoinWallet,
  bitcoinWallets,
  defaultBitcoinWallet,
} from "@payky/app-shared/bitcoin-payment-method"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.tsx"
import { usePreloadEvoluQueries } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { CashuAccountSettingsBody } from "./cashu-account-settings-page.tsx"
import { LightningAddressSettingsBody } from "./lightning-address-settings-page.tsx"
import { SparkAccountSettingsBody } from "./spark-account-settings-page.tsx"
import { bitcoinWalletQueries, useBitcoinWallet } from "./use-bitcoin-wallet.ts"

const walletLabelKeys = {
  cashu: "settings.paymentAccounts.method.cashu",
  lightningAddress: "settings.paymentAccounts.method.lightningAddress",
  spark: "settings.bitcoin.wallet.spark",
} satisfies Record<BitcoinWallet, TranslationKey>

/**
 * Finito's Bitcoin method (settings/0003): the three wallets as Activity's
 * tabs, each tab showing that wallet's settings. The tabs only look; the
 * "Main method" switch on each wallet is what makes it the one the
 * payment screen offers, and turns the previous one off in the same run.
 * The screen opens on the main wallet, or the default while none is.
 */
export function BitcoinSettingsPage() {
  usePreloadEvoluQueries(bitcoinWalletQueries)
  const { t } = useTranslation()
  const wallet = useBitcoinWallet()
  const [view, setView] = useState<BitcoinWallet>(
    wallet.enabled ?? defaultBitcoinWallet
  )

  return (
    <Screen>
      <FadeHeader title={t("settings.paymentAccounts.method.bitcoin")} />
      <YStack gap={20}>
        <Tabs<BitcoinWallet> value={view} onValueChange={setView}>
          <TabsList>
            {bitcoinWallets.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(walletLabelKeys[value])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <MainMethodRow
          wallet={view}
          // The Lightning address can only be the main method once one is
          // saved; its form below saves it.
          canSelect={
            view !== "lightningAddress" || wallet.lightningAddress !== undefined
          }
        />
        {view === "cashu" ? (
          <CashuAccountSettingsBody />
        ) : view === "lightningAddress" ? (
          <LightningAddressSettingsBody />
        ) : (
          <SparkAccountSettingsBody />
        )}
      </YStack>
    </Screen>
  )
}

/**
 * One row with a switch: on makes `wallet` the main bitcoin method, off
 * turns bitcoin off altogether, as the Bitcoin switch in the methods list.
 */
function MainMethodRow({
  wallet,
  canSelect,
}: {
  readonly wallet: BitcoinWallet
  readonly canSelect: boolean
}) {
  const { t } = useTranslation()
  const bitcoin = useBitcoinWallet()
  const choice = useInlineChoice(bitcoin.enabled === wallet, (next) =>
    bitcoin.select(next ? wallet : null)
  )
  const label = t("settings.bitcoin.mainMethod")

  return (
    <XStack items="center" justify="space-between" gap={12} minH={44} px={4}>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {label}
      </Text>
      <Switch
        checked={choice.value}
        aria-label={label}
        disabled={!canSelect || choice.saving}
        onCheckedChange={(next) => {
          void choice.choose(next)
        }}
      />
    </XStack>
  )
}
