import {
  type BitcoinWallet,
  bitcoinWallets,
  defaultBitcoinWallet,
} from "@payky/app-shared/bitcoin-payment-method"
import { useState } from "react"
import { YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SwitchRow } from "../../../components/switch-row.tsx"
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.tsx"
import { usePreloadEvoluQueries } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CashuAccountSettingsBody } from "./cashu-account-settings-page.tsx"
import { LightningAddressSettingsBody } from "./lightning-address-settings-page.tsx"
import { SparkAccountSettingsBody } from "./spark-account-settings-page.tsx"
import {
  bitcoinWalletQueries,
  useBitcoinWallet,
  walletLabelKeys,
} from "./use-bitcoin-wallet.ts"

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
          wallet={wallet}
          view={view}
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
 * One row with a switch: on makes `view` the main bitcoin method, off
 * turns bitcoin off altogether, as the Bitcoin switch in the methods list.
 */
function MainMethodRow({
  wallet,
  view,
  canSelect,
}: {
  readonly wallet: ReturnType<typeof useBitcoinWallet>
  readonly view: BitcoinWallet
  readonly canSelect: boolean
}) {
  const { t } = useTranslation()
  const choice = useInlineChoice(wallet.enabled === view, (next) =>
    wallet.select(next ? view : null)
  )

  return (
    <SwitchRow
      label={t("settings.bitcoin.mainMethod")}
      checked={choice.value}
      disabled={!canSelect || choice.saving}
      onCheckedChange={(next) => {
        void choice.choose(next)
      }}
    />
  )
}
