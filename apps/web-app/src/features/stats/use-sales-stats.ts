import type { Query, QueryRows, Row } from "@evolu/common"
import { useNow } from "@payky/app-shared/use-now"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { loadAnsweredOverpaymentTips } from "@payky/core/modules/bill/bill-overpayment-guards"
import {
  overpaymentTipsQuery,
  refundsQuery,
  type SalesByHourRow,
  salesByHourQuery,
  salesByMethodQuery,
} from "@payky/core/modules/sales-stats/sales-stats-queries"
import type {
  StatsPeriod,
  StatsRange,
} from "@payky/core/modules/sales-stats/sales-stats-types"
import {
  type ExpectedCash,
  expectedCash,
  type MethodBreakdown,
  methodBreakdown,
  type SalesKpis,
  type StatsPeriodRanges,
  salesKpis,
  statsPeriodRanges,
} from "@payky/core/modules/sales-stats/sales-stats-utils"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import {
  useEvoluQuery,
  useOptionalEvoluQuery,
} from "@/hooks/use-evolu-query.ts"

const tickMs = 5 * 60_000

/**
 * The clock the screen's ranges are built from. It ticks on every 5-minute
 * boundary, which local midnight always is, so *Today* rolls over at
 * midnight and the to-date comparisons (*Today*, *Month*) keep pace with
 * the live figures they are set against.
 *
 * ponytail: a to-date comparison trails `now` by up to 5 minutes; tick
 * every minute if anyone ever notices.
 */
export const useStatsNow = (): Date =>
  useNow([TimestampMs(Math.ceil((Date.now() + 1) / tickMs) * tickMs)])

/**
 * One sales-stats query over `range`, `undefined` while it loads. `live`
 * subscribes through `useEvoluQuery` (suspending on the first load), which
 * re-runs after every write and sync — only *Today* needs that. Everything
 * else loads once through TanStack Query and again on every return to the
 * screen. `name` keys the cache (`["stats", name, fromIso, toIso]`), so it
 * must be unique per query factory.
 */
export function useStatsRows<R extends Row>(
  name: string,
  createQuery: (range: StatsRange) => Query<EvoluSchema, R>,
  { fromIso, toIso }: StatsRange,
  live: boolean
): QueryRows<R> | undefined {
  const evolu = useEvolu()
  const query = useMemo(
    () => createQuery({ fromIso, toIso }),
    [createQuery, fromIso, toIso]
  )
  const { data: liveRows } = useOptionalEvoluQuery(live ? query : null)
  const { data: loadedRows } = useQuery({
    queryKey: ["stats", name, fromIso, toIso],
    queryFn: () => evolu.loadQuery(query),
    enabled: !live,
    refetchOnMount: "always",
  })
  return live ? liveRows : loadedRows
}

/**
 * When the period's figures last loaded, epoch ms, `undefined` before the
 * first load. Reads the sales-by-hour entry, which every non-live period
 * loads; re-renders whenever any stats load settles.
 */
export function useStatsLoadedAt({
  fromIso,
  toIso,
}: StatsRange): number | undefined {
  const queryClient = useQueryClient()
  useIsFetching({ queryKey: ["stats"] })
  const loadedAt = queryClient.getQueryState([
    "stats",
    "salesByHour",
    fromIso,
    toIso,
  ])?.dataUpdatedAt
  return loadedAt === undefined || loadedAt === 0 ? undefined : loadedAt
}

function useOverpaymentTips(range: StatsRange, live: boolean) {
  const appRun = useAppRun()
  const rows = useStatsRows(
    "overpaymentTips",
    overpaymentTipsQuery,
    range,
    live
  )
  const { data: history } = useOptionalEvoluQuery(
    live ? evoluHistoryMaxRowidQuery : null
  )
  const { data } = useQuery({
    queryKey: [
      "stats",
      "answeredOverpaymentTips",
      rows,
      history[0]?.maxRowid ?? null,
    ],
    queryFn: async () => {
      await using run = appRun()
      return await run.ok(loadAnsweredOverpaymentTips(rows ?? []))
    },
    enabled: rows !== undefined,
  })
  return data
}

export interface SalesStats {
  readonly ranges: StatsPeriodRanges
  /** Whether `ranges.range` is subscribed — pass it to `useStatsRows`. */
  readonly live: boolean
  readonly accountCurrency: FiatCurrency
  readonly hourRows: ReadonlyArray<SalesByHourRow>
  readonly comparisonHourRows: ReadonlyArray<SalesByHourRow>
  /** Over `ranges.comparisonWhole`, for the chart. */
  readonly comparisonWholeHourRows: ReadonlyArray<SalesByHourRow>
  /** Per currency, the account currency first; empty for an empty period. */
  readonly kpis: ReadonlyArray<SalesKpis>
  readonly comparisonKpis: ReadonlyArray<SalesKpis>
  readonly methods: ReadonlyArray<MethodBreakdown>
  readonly cash: ReadonlyArray<ExpectedCash>
}

/**
 * The figures of the screen's first sections for `period`, `null` while any
 * of them loads. The comparison period is never live: it is in the past.
 */
export function useSalesStats(
  period: StatsPeriod,
  now: Date
): SalesStats | null {
  const ranges = statsPeriodRanges(period, now)
  const live = period.kind === "today"
  const { range, comparison, comparisonWhole } = ranges

  const {
    data: [settings],
  } = useEvoluQuery(settingsQuery)
  const accountCurrency = getFiatCurrency(settings)

  const hourRows = useStatsRows("salesByHour", salesByHourQuery, range, live)
  const methodRows = useStatsRows(
    "salesByMethod",
    salesByMethodQuery,
    range,
    live
  )
  const refundRows = useStatsRows("refunds", refundsQuery, range, live)
  const comparisonHourRows = useStatsRows(
    "salesByHour",
    salesByHourQuery,
    comparison,
    false
  )
  // The same cache entry as `comparisonHourRows` unless the period is to-date.
  const comparisonWholeHourRows = useStatsRows(
    "salesByHour",
    salesByHourQuery,
    comparisonWhole,
    false
  )
  const comparisonRefundRows = useStatsRows(
    "refunds",
    refundsQuery,
    comparison,
    false
  )
  const overpaymentTips = useOverpaymentTips(range, live)
  const comparisonOverpaymentTips = useOverpaymentTips(comparison, false)

  const derived = useMemo(() => {
    if (
      hourRows === undefined ||
      methodRows === undefined ||
      refundRows === undefined ||
      comparisonHourRows === undefined ||
      comparisonWholeHourRows === undefined ||
      comparisonRefundRows === undefined ||
      overpaymentTips === undefined ||
      comparisonOverpaymentTips === undefined
    ) {
      return null
    }
    return {
      hourRows,
      comparisonHourRows,
      comparisonWholeHourRows,
      kpis: salesKpis({
        hourRows,
        refundRows,
        overpaymentTips,
        accountCurrency,
      }),
      comparisonKpis: salesKpis({
        hourRows: comparisonHourRows,
        refundRows: comparisonRefundRows,
        overpaymentTips: comparisonOverpaymentTips,
        accountCurrency,
      }),
      methods: methodBreakdown({ methodRows, hourRows, accountCurrency }),
      cash: expectedCash({ methodRows, refundRows, accountCurrency }),
    }
  }, [
    hourRows,
    methodRows,
    refundRows,
    comparisonHourRows,
    comparisonWholeHourRows,
    comparisonRefundRows,
    overpaymentTips,
    comparisonOverpaymentTips,
    accountCurrency,
  ])

  return derived === null ? null : { ranges, live, accountCurrency, ...derived }
}
