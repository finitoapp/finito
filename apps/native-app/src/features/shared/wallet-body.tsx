import { router } from "expo-router"
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right"
import { YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import { Skeleton } from "../../components/ui/skeleton.tsx"
import {
  VerticalNav,
  type VerticalNavItem,
} from "../../components/vertical-nav.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { shape } from "../../theme/tokens.ts"
import { BitcoinBalance } from "./bitcoin-amount.tsx"

/**
 * Fazole's wallet screen, shared by the Cashu and Spark wallets: the
 * balance alone, large; "Withdraw funds" while there is anything to
 * withdraw, opening `withdrawHref`; then the wallet's rows. No card, no
 * label, no second lines (fazole-ui-minimal-copy). While the balance is
 * still unread (`sats` undefined) a skeleton holds the figure's place and
 * the rows are already there, so neither wallet claims "0 sats" it has not
 * read.
 */
export function WalletBody({
  sats,
  withdrawHref,
  items,
  testID,
}: {
  /** `undefined` while the balance loads. */
  readonly sats: number | undefined
  readonly withdrawHref: "/cashu-withdraw/new" | "/withdraw/new"
  readonly items: ReadonlyArray<VerticalNavItem>
  /** The balance's testID, and `<testID>-withdraw` for the button. */
  readonly testID: string
}) {
  const { t } = useTranslation()
  return (
    <YStack gap={24}>
      <YStack py={16} items="center">
        {sats === undefined ? (
          // The `lg` AmountFigure's one 40-high line.
          <Skeleton h={40} w={160} rounded={shape.control} />
        ) : (
          <BitcoinBalance sats={sats} testID={testID} />
        )}
      </YStack>
      {sats !== undefined && sats > 0 ? (
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
