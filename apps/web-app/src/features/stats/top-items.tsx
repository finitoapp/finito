import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  rankItems,
  rowsByCurrency,
  type TopItemsMetric,
} from "@payky/app-shared/stats-sections"
import type { ItemSalesRow } from "@payky/core/modules/sales-stats/sales-stats-queries"
import type { Currency } from "@payky/core/modules/shared/schema"
import { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { CurrencyGroup, StatsBarRow, useStatsMoney } from "./stats-section.tsx"

const metricLabelKeys = {
  amount: "stats.items.byRevenue",
  quantity: "stats.items.byQuantity",
} satisfies Record<TopItemsMetric, TranslationKey>

const topCount = 10

/** What closed bills sold, by revenue or quantity: the top ten, then all. */
export function TopItems({
  rows,
  accountCurrency,
}: {
  readonly rows: ReadonlyArray<ItemSalesRow>
  readonly accountCurrency: Currency
}) {
  const { t } = useTranslation()
  const [metric, setMetric] = useState<TopItemsMetric>("amount")
  const [showAll, setShowAll] = useState(false)

  const groups = rowsByCurrency(rows, accountCurrency)
  const hasMore = groups.some((group) => group.rows.length > topCount)

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup<TopItemsMetric>
        aria-label={t("stats.items.metric")}
        className="grid w-full grid-cols-2"
        variant="outline"
        size="sm"
        spacing={1}
        value={[metric]}
        // Pressing the selected item again empties the value; keep it.
        onValueChange={([value]) => {
          if (value !== undefined) setMetric(value)
        }}
      >
        {(["amount", "quantity"] as const).map((value) => (
          <ToggleGroupItem key={value} value={value} className="text-xs">
            {t(metricLabelKeys[value])}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {groups.map((group) => (
        <CurrencyGroup
          key={group.currency}
          currency={group.currency}
          showCurrency={groups.length > 1}
        >
          <ItemList
            rows={rankItems(group.rows, metric).slice(
              0,
              showAll ? undefined : topCount
            )}
            metric={metric}
            currency={group.currency}
          />
        </CurrencyGroup>
      ))}
      {hasMore ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? t("stats.items.showTop") : t("stats.items.showAll")}
        </Button>
      ) : null}
    </div>
  )
}

function ItemList({
  rows,
  metric,
  currency,
}: {
  readonly rows: ReadonlyArray<ItemSalesRow>
  readonly metric: TopItemsMetric
  readonly currency: Currency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const money = useStatsMoney()
  // Bars against the best seller, so a long tail stays readable.
  const max = Math.max(0, ...rows.map((row) => row[metric]))

  return rows.map((row) => (
    <StatsBarRow
      key={row.catalogItemId ?? row.itemId}
      label={row.written === 1 ? t("stats.items.written") : row.name}
      detail={t("stats.items.quantity", {
        quantity: row.quantity.toLocaleString(locale, {
          maximumFractionDigits: 3,
        }),
      })}
      value={money(row.amount, currency)}
      share={max === 0 ? 0 : row[metric] / max}
    />
  ))
}
