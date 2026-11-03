import {
  type StatsSearch,
  StatsSearchSchema,
  statsPeriodFromSearch,
} from "@payky/app-shared/stats-search"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import type { StatsPeriod } from "@payky/core/modules/sales-stats/sales-stats-types"
import { statsPeriodRanges } from "@payky/core/modules/sales-stats/sales-stats-utils"
import { router, useLocalSearchParams } from "expo-router"
import ChartColumn from "lucide-react-native/icons/chart-column"
import { Suspense } from "react"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import { PulseDot } from "../../components/pulse-dot.tsx"
import { Screen } from "../../components/screen.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { Skeleton } from "../../components/ui/skeleton.tsx"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { ActivityTabs } from "../shared/activity-tabs.tsx"
import { DeviceBreakdown } from "./device-breakdown.tsx"
import { formatStatsRange, KpiTiles } from "./kpi-tiles.tsx"
import { ExpectedCashSummary, MethodBreakdown } from "./method-breakdown.tsx"
import { OpenBillsSummary } from "./open-bills-summary.tsx"
import { PeriodSelector } from "./period-selector.tsx"
import { RevenueChart } from "./revenue-chart.tsx"
import { SalesHeatmap } from "./sales-heatmap.tsx"
import { Signals } from "./signals.tsx"
import { TopSales } from "./top-sales.tsx"
import {
  useSalesStats,
  useStatsLoadedAt,
  useStatsNow,
} from "./use-sales-stats.ts"
import { VatRecap } from "./vat-recap.tsx"

/**
 * The sales statistics screen (access/0008): the period selector, then one
 * section per block, top to bottom. The period lives in the route's params so
 * back and a restart keep it; every param falls back instead of throwing.
 */
export function StatsPage() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{
    period?: string
    from?: string
    to?: string
  }>()
  const search = StatsSearchSchema.parse(params)
  const now = useStatsNow()
  const period = statsPeriodFromSearch(search, now)

  return (
    <Screen>
      <FadeHeader title={t("activity.title")} startAddon={null} />
      <ActivityTabs active="stats" />
      <PeriodSelector
        period={period}
        onChange={(next: StatsSearch) => {
          router.setParams({
            period: next.period,
            from: next.from,
            to: next.to,
          })
        }}
      />
      <PeriodSummary period={period} now={now} />
      <Suspense fallback={<StatsSkeleton />}>
        <PeriodStats period={period} now={now} />
      </Suspense>
    </Screen>
  )
}

/**
 * The exact range on screen and the one it compares with, then whether the
 * figures are live (*Today*) or when they loaded.
 */
function PeriodSummary({
  period,
  now,
}: {
  readonly period: StatsPeriod
  readonly now: Date
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { range, comparison } = statsPeriodRanges(period, now)
  const live = period.kind === "today"
  const loadedAt = useStatsLoadedAt(range)

  return (
    <XStack items="flex-start" justify="space-between" gap="3" px="1">
      <YStack flex={1} minW={0}>
        <Text fontSize="xs" lineHeight="xs" fontWeight="500">
          {formatStatsRange(range, locale)}
        </Text>
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {t("stats.comparison", {
            range: formatStatsRange(comparison, locale),
          })}
        </Text>
      </YStack>
      {live ? (
        <XStack items="center" gap="1.5">
          <PulseDot color="success" loop="ping" />
          <Text fontSize="xs" lineHeight="xs" color="success">
            {t("stats.live")}
          </Text>
        </XStack>
      ) : loadedAt === undefined ? null : (
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground" shrink={0}>
          {t("stats.loadedAt", {
            time: new Date(loadedAt).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </Text>
      )}
    </XStack>
  )
}

function PeriodStats({
  period,
  now,
}: {
  readonly period: StatsPeriod
  readonly now: Date
}) {
  const [settings] = useEvoluQuery(settingsQuery).data
  const { t } = useTranslation()
  const stats = useSalesStats(period, now)

  // Not tied to the period, so it shows on an empty one too.
  const openBills = (
    <OpenBillsSummary accountCurrency={getFiatCurrency(settings)} />
  )

  if (stats === null) return <StatsSkeleton />
  if (stats.kpis.length === 0) {
    return (
      <>
        <YStack items="center" gap="2" py="12">
          <Icon icon={ChartColumn} size={40} color="muted-foreground" />
          <Text fontWeight="500">{t("stats.empty.title")}</Text>
          <Text color="muted-foreground" text="center">
            {t("stats.empty.description")}
          </Text>
        </YStack>
        {openBills}
      </>
    )
  }

  const [primary] = stats.kpis

  return (
    <>
      <KpiTiles kpis={stats.kpis} comparisonKpis={stats.comparisonKpis} />
      {openBills}
      <ExpectedCashSummary cash={stats.cash} />
      {primary === undefined ? null : (
        <RevenueChart
          hourRows={stats.hourRows}
          comparisonHourRows={stats.comparisonWholeHourRows}
          ranges={stats.ranges}
          currency={primary.currency}
          now={now}
        />
      )}
      <MethodBreakdown methods={stats.methods} kpis={stats.kpis} />
      <TopSales stats={stats} />
      <DeviceBreakdown stats={stats} />
      {primary === undefined ? null : (
        <SalesHeatmap stats={stats} currency={primary.currency} />
      )}
      <Signals stats={stats} />
      <VatRecap stats={stats} />
    </>
  )
}

function StatsSkeleton() {
  return (
    <>
      <XStack flexWrap="wrap" gap="2">
        {Array.from({ length: 5 }, (_, index) => (
          <YStack
            // biome-ignore lint/suspicious/noArrayIndexKey: static loading tiles
            key={index}
            width={index === 0 ? "100%" : "47%"}
            flexGrow={index === 0 ? 0 : 1}
            gap="2"
            p="3"
            rounded="md"
            bg="card"
          >
            <Skeleton w={64} h={12} />
            <Skeleton w={index === 0 ? 128 : 80} h={index === 0 ? 28 : 20} />
            <Skeleton w={32} h={12} />
          </YStack>
        ))}
      </XStack>
      <ListSkeleton rows={1} />
      <YStack gap="4" p="4" rounded="md" bg="card">
        <Skeleton w={96} h={12} />
        <Skeleton w="100%" h={160} />
      </YStack>
    </>
  )
}
