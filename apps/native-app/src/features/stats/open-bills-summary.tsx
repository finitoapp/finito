import { openBillsQuery } from "@payky/core/modules/bill/bill-queries"
import {
  calculateBillLineSummaries,
  deriveBillSummaryTotal,
} from "@payky/core/modules/bill-line/bill-line-utils"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { Integer } from "@payky/core/modules/shared/schema"
import { useMemo } from "react"
import { Text, XStack } from "tamagui"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

/**
 * How many bills are open right now and what is on them, whatever the
 * period. Live, from the same `openBillsQuery` the floor view reads.
 *
 * ponytail: the total is the bills' lines, a partial payment on an open
 * bill not subtracted; subtract coverage if "still to collect" is wanted.
 */
export function OpenBillsSummary({
  accountCurrency,
}: {
  readonly accountCurrency: FiatCurrency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: openBills } = useEvoluQuery(openBillsQuery)

  const totals = useMemo(() => {
    const byCurrency = new Map<FiatCurrency, number>()
    for (const bill of openBills) {
      const total = deriveBillSummaryTotal(
        calculateBillLineSummaries(bill.lines, bill.items)
      )
      byCurrency.set(
        bill.currency,
        (byCurrency.get(bill.currency) ?? 0) + total
      )
    }
    if (byCurrency.size === 0) byCurrency.set(accountCurrency, 0)
    return [...byCurrency]
  }, [openBills, accountCurrency])

  return (
    <XStack
      items="center"
      justify="space-between"
      gap="3"
      p="3"
      rounded="lg"
      bg="neutral-soft"
    >
      <Text flex={1} fontWeight="600">
        {t("stats.openBills.title")}
      </Text>
      <Text
        fontWeight="700"
        aria-label={`${t("stats.openBills.count")}: ${openBills.length}`}
      >
        {openBills.length.toLocaleString(locale)}
      </Text>
      {totals.map(([currency, total]) => (
        <Text
          key={currency}
          color="muted-foreground"
          aria-label={t("stats.openBills.total")}
        >
          {`· ${formatMoney({ value: Integer(total), currency }, locale)}`}
        </Text>
      ))}
    </XStack>
  )
}
