import { formatDateTime } from "@payky/app-shared/format-date"
import {
  unconfirmedEetReversalsQuery,
  unconfirmedEetSalesQuery,
} from "@payky/core/modules/eet/eet-queries"
import { Integer } from "@payky/core/modules/shared/schema"
import { parseISO } from "date-fns"
import { router } from "expo-router"
import CircleCheck from "lucide-react-native/icons/circle-check"
import { Text, YStack } from "tamagui"
import { EmptyState } from "../../../components/empty-state.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { VerticalNavRow } from "../../../components/vertical-nav.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { EetSaleStatusLabel } from "../../shared/eet-sale-status.tsx"

/**
 * Sales and reversals EET has not confirmed, a card of its own on the EET
 * screen; each row opens its payment, and with none left the card says so.
 */
export function EetUnconfirmedSales() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: sales } = useEvoluQuery(unconfirmedEetSalesQuery)
  const { data: reversals } = useEvoluQuery(unconfirmedEetReversalsQuery)

  const rows = [
    ...sales.map((sale) => ({
      key: sale.id,
      testID: "eet-unconfirmed-sale",
      sale,
      title: formatMoney(
        { value: sale.amount, currency: sale.currency },
        locale
      ),
    })),
    ...reversals.map((reversal) => ({
      key: reversal.id,
      testID: "eet-unconfirmed-reversal",
      sale: reversal,
      title: t("settings.eet.unconfirmed.reversal", {
        amount: formatMoney(
          { value: Integer(-reversal.amount), currency: reversal.currency },
          locale
        ),
      }),
    })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.eet.unconfirmed.title")}</CardTitle>
        <CardDescription>
          {t("settings.eet.unconfirmed.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            description={t("settings.eet.unconfirmed.empty")}
          />
        ) : (
          // The rows' own inset lines their text up with the card's title.
          <YStack mx={-12}>
            {rows.map(({ key, testID, sale, title }) => (
              <VerticalNavRow
                key={key}
                item={{
                  kind: "button",
                  accessibilityLabel: title,
                  onPress: () => router.push(`/activity/${sale.paymentId}`),
                  label: (
                    <YStack gap={4} testID={testID}>
                      <Text
                        fontSize={fontSize.sm}
                        lineHeight={fontSize.sm}
                        fontWeight={fontWeight.semibold}
                      >
                        {title}
                      </Text>
                      <Text
                        fontSize={fontSize.xs}
                        lineHeight={fontSize.xs}
                        color="muted-foreground"
                      >
                        {formatDateTime(parseISO(sale.saleAt), locale)}
                      </Text>
                    </YStack>
                  ),
                  action: <EetSaleStatusLabel sale={sale} />,
                }}
              />
            ))}
          </YStack>
        )}
      </CardContent>
    </Card>
  )
}
