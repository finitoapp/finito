import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  categoryGroups,
  rankItems,
  rowsByCurrency,
  type TopItemsMetric,
} from "@payky/app-shared/stats-sections"
import {
  categorySalesQuery,
  type ItemSalesRow,
  itemSalesQuery,
  keypadSalesQuery,
} from "@payky/core/modules/sales-stats/sales-stats-queries"
import type { Currency } from "@payky/core/modules/shared/schema"
import { useState } from "react"
import { XStack, YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import {
  CurrencyGroup,
  StatsBarRow,
  StatsSection,
  useStatsMoney,
} from "./stats-section.tsx"
import { type SalesStats, useStatsRows } from "./use-sales-stats.ts"

const metricLabelKeys = {
  amount: "stats.items.byRevenue",
  quantity: "stats.items.byQuantity",
} satisfies Record<TopItemsMetric, TranslationKey>

const topCount = 10

/**
 * Top items and top categories in one card, a tab each. A period with only
 * one of them (keypad sales have no items) shows it without the tabs. The
 * note says why none of it adds up to net revenue.
 */
export function TopSales({ stats }: { readonly stats: SalesStats }) {
  const { t } = useTranslation()
  const { range } = stats.ranges
  const [tab, setTab] = useState<"items" | "categories">("items")
  const itemRows = useStatsRows("itemSales", itemSalesQuery, range, stats.live)
  const categoryRows = useStatsRows(
    "categorySales",
    categorySalesQuery,
    range,
    stats.live
  )
  const keypadRows = useStatsRows(
    "keypadSales",
    keypadSalesQuery,
    range,
    stats.live
  )

  if (
    itemRows === undefined ||
    categoryRows === undefined ||
    keypadRows === undefined
  ) {
    return null
  }

  const groups = categoryGroups({
    categoryRows,
    keypadRows,
    accountCurrency: stats.accountCurrency,
  })
  const items =
    itemRows.length === 0 ? null : (
      <TopItems rows={itemRows} accountCurrency={stats.accountCurrency} />
    )
  const categories =
    groups.length === 0 ? null : <TopCategories groups={groups} />

  if (items === null && categories === null) return null

  const both = items !== null && categories !== null

  return (
    <StatsSection
      title={t("stats.top.title")}
      note={t("stats.categories.note")}
    >
      {both ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="items">{t("stats.top.items")}</TabsTrigger>
            <TabsTrigger value="categories">
              {t("stats.top.categories")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="items">{items}</TabsContent>
          <TabsContent value="categories">{categories}</TabsContent>
        </Tabs>
      ) : null}
      {both ? null : (items ?? categories)}
    </StatsSection>
  )
}

/** What closed bills sold, by revenue or quantity: the top ten, then all. */
function TopItems({
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
    <YStack gap="4">
      <XStack aria-label={t("stats.items.metric")}>
        <ToggleGroup
          value={metric}
          variant="outline"
          size="sm"
          spacing={1}
          columns={2}
          onValueChange={setMetric}
        >
          {(["amount", "quantity"] as const).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {t(metricLabelKeys[value])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </XStack>
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
        <XStack justify="center">
          <Button
            size="sm"
            label={
              showAll ? t("stats.items.showTop") : t("stats.items.showAll")
            }
            variant="ghost"
            onPress={() => setShowAll((value) => !value)}
          />
        </XStack>
      ) : null}
    </YStack>
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

  return (
    <>
      {rows.map((row) => (
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
      ))}
    </>
  )
}

/**
 * Revenue per catalog category, "Uncategorized" and the keypad's sales
 * without items included.
 */
function TopCategories({
  groups,
}: {
  readonly groups: ReturnType<typeof categoryGroups>
}) {
  const { t } = useTranslation()
  const money = useStatsMoney()

  return (
    <YStack gap="4">
      {groups.map((group) => (
        <CurrencyGroup
          key={group.currency}
          currency={group.currency}
          showCurrency={groups.length > 1}
        >
          {group.rows.map((row) => (
            <StatsBarRow
              key={row.key}
              label={
                row.keypad
                  ? t("stats.categories.keypad")
                  : (row.name ?? t("stats.categories.uncategorized"))
              }
              value={money(row.amount, group.currency)}
              share={row.share}
            />
          ))}
        </CurrencyGroup>
      ))}
    </YStack>
  )
}
