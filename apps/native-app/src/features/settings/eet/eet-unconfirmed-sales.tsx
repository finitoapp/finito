import { formatDateTime } from "@payky/app-shared/format-date"
import { formatMoney } from "@payky/app-shared/format-money"
import {
  unconfirmedEetReversalsQuery,
  unconfirmedEetSalesQuery,
} from "@payky/core/modules/eet/eet-queries"
import { Integer } from "@payky/core/modules/shared/schema"
import { parseISO } from "date-fns"
import { router } from "expo-router"
import { Text, XStack, YStack } from "tamagui"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { EetSaleStatusLabel } from "../../shared/eet-sale-status.tsx"

/** Sales and reversals EET has not confirmed; each opens its payment. */
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
          <Text color="muted-foreground" fontSize="sm" lineHeight="sm">
            {t("settings.eet.unconfirmed.empty")}
          </Text>
        ) : (
          <YStack gap="2">
            {rows.map(({ key, testID, sale, title }) => (
              <XStack
                key={key}
                testID={testID}
                minH={56}
                items="center"
                gap="3"
                p="3"
                rounded="lg"
                borderWidth={1}
                borderColor="border-color"
                role="button"
                cursor="web:pointer"
                onPress={() => router.push(`/activity/${sale.paymentId}`)}
              >
                <YStack flex={1}>
                  <Text fontSize="sm" lineHeight="sm" fontWeight="500">
                    {title}
                  </Text>
                  <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                    {formatDateTime(parseISO(sale.saleAt), locale)}
                  </Text>
                </YStack>
                <EetSaleStatusLabel sale={sale} />
              </XStack>
            ))}
          </YStack>
        )}
      </CardContent>
    </Card>
  )
}
