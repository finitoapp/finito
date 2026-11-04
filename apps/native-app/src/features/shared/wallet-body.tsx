import { router } from "expo-router"
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right"
import { YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import {
  VerticalNav,
  type VerticalNavItem,
} from "../../components/vertical-nav.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { BitcoinBalance } from "./bitcoin-amount.tsx"

/**
 * Fazole's wallet screen, shared by the Cashu and Spark wallets: the
 * balance alone, large; "Withdraw funds" while there is anything to
 * withdraw, opening `withdrawHref`; then the wallet's rows. No card, no
 * label, no second lines (fazole-ui-minimal-copy).
 */
export function WalletBody({
  sats,
  withdrawHref,
  items,
  testID,
}: {
  readonly sats: number
  readonly withdrawHref: "/cashu-withdraw/new" | "/withdraw/new"
  readonly items: ReadonlyArray<VerticalNavItem>
  /** The balance's testID, and `<testID>-withdraw` for the button. */
  readonly testID: string
}) {
  const { t } = useTranslation()
  return (
    <YStack gap={24}>
      <YStack py={16}>
        <BitcoinBalance sats={sats} testID={testID} />
      </YStack>
      {sats > 0 ? (
        <Button
          size="lg"
          iconStart={ArrowUpRight}
          label={t("settings.cashuAccount.withdraw")}
          testID={`${testID}-withdraw`}
          onPress={() => router.push(withdrawHref)}
        />
      ) : null}
      <VerticalNav items={items} />
    </YStack>
  )
}
