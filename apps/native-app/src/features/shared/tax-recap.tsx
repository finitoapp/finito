import {
  hasTaxableLines,
  type TaxRecapRow,
} from "@payky/core/modules/bill-line/bill-line-tax-utils"
import { type Currency, Integer } from "@payky/core/modules/shared/schema"
import { taxRatePercentageToDecimalString } from "@payky/core/modules/tax-rate/tax-rate-utils"
import { Text, XStack, YStack } from "tamagui"
import { Separator } from "../../components/ui/separator.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

/** VAT breakdown by rate; nothing when no line carries a tax rate. */
export function TaxRecap({
  rows,
  currency,
}: {
  readonly rows: ReadonlyArray<TaxRecapRow>
  readonly currency: Currency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const money = (value: number) =>
    formatMoney({ value: Integer(value), currency }, locale)

  if (!hasTaxableLines(rows)) return null

  return (
    <YStack gap="2">
      <Text
        fontSize="sm"
        lineHeight="sm"
        fontWeight="600"
        color="muted-foreground"
      >
        {t("taxRecap.title")}
      </Text>
      <YStack>
        {rows.map((row, index) => (
          <YStack key={row.taxRateId ?? "none"}>
            {index > 0 ? <Separator /> : null}
            <XStack items="center" justify="space-between" gap="2" py="2">
              <YStack flex={1} minW={0}>
                <Text
                  numberOfLines={1}
                  fontSize="sm"
                  lineHeight="sm"
                  fontWeight="600"
                >
                  {row.name === null || row.ratePercentage === null
                    ? t("taxRecap.noTax")
                    : t("taxRecap.rateLabel", {
                        name: row.name,
                        rate: taxRatePercentageToDecimalString(
                          row.ratePercentage
                        ),
                      })}
                </Text>
                <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                  {`${t("taxRecap.base")}: ${money(row.baseAmount)} · ${t("taxRecap.tax")}: ${money(row.taxAmount)}`}
                </Text>
              </YStack>
              <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                {money(row.grossAmount)}
              </Text>
            </XStack>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}
