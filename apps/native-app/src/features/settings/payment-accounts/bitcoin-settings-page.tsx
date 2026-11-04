import {
  type BitcoinWallet,
  bitcoinWallets,
} from "@payky/app-shared/bitcoin-payment-method"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useState } from "react"
import { YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.tsx"
import { usePreloadEvoluQueries } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
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
 * Finito's Bitcoin method (settings/0002): the three wallets as Activity's
 * tabs, the chosen one's settings below. Choosing Cashu or Spark switches
 * at once; choosing the Lightning address shows its form, and saving an
 * address there is what switches.
 */
export function BitcoinSettingsPage() {
  usePreloadEvoluQueries(bitcoinWalletQueries)
  const { t } = useTranslation()
  const wallet = useBitcoinWallet()
  // A wallet picked but not yet on: the Lightning address awaiting its form.
  const [draft, setDraft] = useState<BitcoinWallet | null>(null)
  const [switching, setSwitching] = useState(false)
  const selected = draft ?? wallet.enabled ?? null

  const choose = async (next: BitcoinWallet) => {
    if (next === selected || switching) return
    if (next === "lightningAddress" && wallet.lightningAddress === undefined) {
      setDraft(next)
      return
    }
    setSwitching(true)
    setDraft(next)
    await wallet.select(next)
    setDraft(null)
    setSwitching(false)
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.paymentAccounts.method.bitcoin")} />
      <YStack gap={20}>
        <Tabs<BitcoinWallet | "">
          value={selected ?? ""}
          onValueChange={(next) => {
            if (next !== "") void choose(next)
          }}
        >
          <TabsList>
            {bitcoinWallets.map((value) => (
              <TabsTrigger key={value} value={value} disabled={switching}>
                {t(walletLabelKeys[value])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {selected === "cashu" && wallet.enabled === "cashu" ? (
          <CashuAccountSettingsBody />
        ) : selected === "lightningAddress" ? (
          <LightningAddressSettingsBody
            onSaved={async () => {
              await wallet.select("lightningAddress")
              setDraft(null)
            }}
          />
        ) : selected === "spark" && wallet.enabled === "spark" ? (
          <SparkAccountSettingsBody />
        ) : null}
      </YStack>
    </Screen>
  )
}
