import {
  type StatsSearch,
  statsPeriodFromSearch,
} from "@payky/app-shared/stats-search"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import type { StatsPeriod } from "@payky/core/modules/sales-stats/sales-stats-types"
import { statsPeriodRanges } from "@payky/core/modules/sales-stats/sales-stats-utils"
import { ChartColumnIcon } from "lucide-react"
import { type ReactNode, Suspense } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { ListSkeleton } from "@/components/list-skeleton.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { verticalNavShellClassName } from "@/components/vertical-nav.tsx"
import { ActivityTabs } from "@/features/shared/activity-tabs.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"
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
 * The sales statistics screen (access/0010), Activity's third tab
 * (navigation/0001), header and tabs included: the period
 * selector, then one section per block, top to bottom. A new section is one
 * more component in `PeriodStats`, fed by `useSalesStats` or its own
 * `useStatsRows`; one not tied to the period is passed in, as `openBills` is.
 */
export function StatsPage({
  search,
  onSearchChange,
}: {
  readonly search: StatsSearch
  readonly onSearchChange: (search: StatsSearch) => void
}) {
  const { t } = useTranslation()
  const now = useStatsNow()
  const period = statsPeriodFromSearch(search, now)

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("activity.title")} startAddon={null} />

      <div className="flex flex-col gap-6 pb-8">
        <ActivityTabs active="stats" />
        {/*
         * Stays on screen while the sections scroll under it, so the period
         * every figure belongs to is always in view. The route's viewport
         * clips with `overflow-x-clip` so this can stick to the window.
         */}
        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+var(--terminal-banner-height,0px))] z-10 -mx-3 flex flex-col gap-2 bg-background px-3 py-2">
          <PeriodSelector period={period} onChange={onSearchChange} />
          <PeriodSummary period={period} now={now} />
        </div>
        <Suspense fallback={<StatsSkeleton />}>
          <PeriodStats
            period={period}
            now={now}
            openBills={
              <Suspense fallback={<ListSkeleton rows={1} />}>
                <OpenBills />
              </Suspense>
            }
          />
        </Suspense>
      </div>
    </>
  )
}

/**
 * The exact range on screen and the one it compares with, then whether the
 * figures are live (*Today*) or when they loaded (every other period, which
 * loads once per visit).
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
    <div className="flex items-start justify-between gap-3 px-1 text-xs text-muted-foreground">
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-foreground">
          {formatStatsRange(range, locale)}
        </span>
        <span>
          {t("stats.comparison", {
            range: formatStatsRange(comparison, locale),
          })}
        </span>
      </div>
      {live ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
            <span className="relative size-2 rounded-full bg-success" />
          </span>
          {t("stats.live")}
        </span>
      ) : loadedAt === undefined ? null : (
        <span className="shrink-0">
          {t("stats.loadedAt", {
            time: new Date(loadedAt).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </span>
      )}
    </div>
  )
}

/**
 * The period's sections, in the order a shift reads them: the takings, what
 * is still open, the drawer, then how the day went and what sold.
 * `openBills` is not tied to the period, so it shows on an empty one too.
 */
function PeriodStats({
  period,
  now,
  openBills,
}: {
  readonly period: StatsPeriod
  readonly now: Date
  readonly openBills: ReactNode
}) {
  const stats = useSalesStats(period, now)

  if (stats === null) return <StatsSkeleton />
  if (stats.kpis.length === 0) {
    return (
      <>
        <StatsEmpty />
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

function OpenBills() {
  const {
    data: [settings],
  } = useEvoluQuery(settingsQuery)
  return <OpenBillsSummary accountCurrency={getFiatCurrency(settings)} />
}

function StatsEmpty() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <ChartColumnIcon className="size-10 text-muted-foreground" />
      <p className="font-medium">{t("stats.empty.title")}</p>
      <p className="text-balance text-sm text-muted-foreground">
        {t("stats.empty.description")}
      </p>
    </div>
  )
}

/** The KPI tiles and the chart's card, so the page does not jump on load. */
function StatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder tiles
            key={index}
            className={cn(
              "flex flex-col gap-2 rounded-md bg-card p-3 shadow",
              index === 0 && "col-span-2"
            )}
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className={index === 0 ? "h-7 w-32" : "h-5 w-20"} />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
      <div className={cn(verticalNavShellClassName, "gap-4 p-4")}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-40 w-full" />
      </div>
    </>
  )
}
