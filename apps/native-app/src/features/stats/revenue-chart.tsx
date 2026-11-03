import {
  type RevenueChartPoint,
  revenueChartPoints,
} from "@payky/app-shared/stats-revenue-chart"
import type { SalesByHourRow } from "@payky/core/modules/sales-stats/sales-stats-queries"
import {
  type StatsPeriodRanges,
  salesBuckets,
  statsDelta,
} from "@payky/core/modules/sales-stats/sales-stats-utils"
import type { Currency } from "@payky/core/modules/shared/schema"
import { useMemo, useState } from "react"
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatAmount } from "../../lib/format-money.ts"
import { formatStatsRange } from "./kpi-tiles.tsx"
import { StatsSection } from "./stats-section.tsx"

const chartHeight = 192
const axisWidth = 40
const axisHeight = 20

/**
 * Sales per hour for a one-day period, per day otherwise, in the account
 * currency (the first of the period's currencies), tips stacked on top and
 * the comparison as wider, paler bars behind. Tap a bar for its figures.
 *
 * ponytail: a period with several currencies charts only the first; one
 * chart per currency if a mixed-currency shop ever needs it.
 */
export function RevenueChart({
  hourRows,
  comparisonHourRows,
  ranges,
  currency,
  now,
}: {
  readonly hourRows: ReadonlyArray<SalesByHourRow>
  /** Over `ranges.comparisonWhole`. */
  readonly comparisonHourRows: ReadonlyArray<SalesByHourRow>
  readonly ranges: StatsPeriodRanges
  readonly currency: Currency
  readonly now: Date
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const theme = useTheme()
  const unit = ranges.bucket
  const [width, setWidth] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)

  const points = useMemo(
    () =>
      revenueChartPoints({
        current: salesBuckets({
          rows: hourRows,
          currency,
          range: ranges.range,
          unit,
        }),
        previous: salesBuckets({
          rows: comparisonHourRows,
          currency,
          range: ranges.comparisonWhole,
          unit,
        }),
        currency,
        now,
      }),
    [
      hourRows,
      comparisonHourRows,
      ranges.range,
      ranges.comparisonWhole,
      unit,
      currency,
      now,
    ]
  )

  const sales = theme["chart-1"]?.val ?? "#e36b2c"
  const muted = theme["muted-foreground"]?.val ?? "#888"
  const max = Math.max(
    1,
    ...points.map((point) =>
      Math.max((point.sales ?? 0) + (point.tips ?? 0), point.previous ?? 0)
    )
  )
  const plotWidth = Math.max(0, width - axisWidth)
  const plotHeight = chartHeight - axisHeight
  const slot = points.length === 0 ? 0 : plotWidth / points.length
  // A little headroom so the top axis label is not cut off.
  const topPad = 8
  const y = (value: number) =>
    topPad + (1 - value / max) * (plotHeight - topPad)
  const tick = (start: number) =>
    unit === "hour"
      ? new Date(start).toLocaleTimeString(locale, { hour: "numeric" })
      : new Date(start).toLocaleDateString(locale, {
          day: "numeric",
          month: "numeric",
        })
  const bucketLabel = (start: number) =>
    unit === "hour"
      ? new Date(start).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date(start).toLocaleDateString(locale, { dateStyle: "medium" })
  // Enough room for a label of about 36 px.
  const labelEvery = Math.max(1, Math.ceil(36 / Math.max(slot, 1)))

  const point = selected === null ? undefined : points[selected]

  return (
    <StatsSection title={t("stats.chart.title")}>
      <YStack
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        aria-label={t("stats.chart.title")}
      >
        {width === 0 ? null : (
          <Svg width={width} height={chartHeight}>
            {[0, 0.5, 1].map((fraction) => (
              <Line
                key={fraction}
                x1={axisWidth}
                x2={width}
                y1={y(max * fraction)}
                y2={y(max * fraction)}
                stroke={muted}
                strokeOpacity={0.25}
              />
            ))}
            {[0, 0.5, 1].map((fraction) => (
              <SvgText
                key={`label-${fraction}`}
                x={axisWidth - 4}
                y={y(max * fraction) + 4}
                fontSize={10}
                fill={muted}
                textAnchor="end"
              >
                {(max * fraction).toLocaleString(locale, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                })}
              </SvgText>
            ))}
            {points.map((entry, index) => {
              const x = axisWidth + index * slot
              const innerX = x + slot * 0.2
              const previousSales = entry.previousSales ?? 0
              const previousTips = entry.previousTips ?? 0
              const currentSales = entry.sales ?? 0
              const currentTips = entry.tips ?? 0
              return (
                <G key={entry.start}>
                  <Rect
                    x={x + slot * 0.06}
                    y={y(previousSales)}
                    width={slot * 0.88}
                    height={plotHeight - y(previousSales)}
                    fill={muted}
                    fillOpacity={0.3}
                  />
                  <Rect
                    x={x + slot * 0.06}
                    y={y(previousSales + previousTips)}
                    width={slot * 0.88}
                    height={y(previousSales) - y(previousSales + previousTips)}
                    fill={muted}
                    fillOpacity={0.14}
                  />
                  <Rect
                    x={innerX}
                    y={y(currentSales)}
                    width={slot * 0.6}
                    height={plotHeight - y(currentSales)}
                    fill={sales}
                  />
                  <Rect
                    x={innerX}
                    y={y(currentSales + currentTips)}
                    width={slot * 0.6}
                    height={y(currentSales) - y(currentSales + currentTips)}
                    fill={sales}
                    fillOpacity={0.45}
                  />
                  {/* The whole slot is the tap target. */}
                  <Rect
                    x={x}
                    y={0}
                    width={slot}
                    height={plotHeight}
                    fill="transparent"
                    onPress={() =>
                      setSelected(index === selected ? null : index)
                    }
                  />
                </G>
              )
            })}
            {points.map((entry, index) =>
              index % labelEvery === 0 ? (
                <SvgText
                  key={`tick-${entry.start}`}
                  x={axisWidth + index * slot + slot / 2}
                  y={chartHeight - 4}
                  fontSize={10}
                  fill={muted}
                  textAnchor="middle"
                >
                  {tick(entry.start)}
                </SvgText>
              ) : null
            )}
          </Svg>
        )}
      </YStack>
      {point === undefined ? null : (
        <RevenueDetail
          point={point}
          title={bucketLabel(point.start)}
          unit={unit}
          currency={currency}
          locale={locale}
        />
      )}
      <XStack flexWrap="wrap" gap="3">
        <LegendItem
          color={sales}
          label={formatStatsRange(ranges.range, locale)}
        />
        <LegendItem
          color={sales}
          opacity={0.45}
          label={t("stats.chart.tips")}
        />
        <LegendItem
          color={muted}
          opacity={0.3}
          label={formatStatsRange(ranges.comparisonWhole, locale)}
        />
      </XStack>
    </StatsSection>
  )
}

/** The tapped bar's sales, tips, total and its change against the comparison. */
function RevenueDetail({
  point,
  title,
  unit,
  currency,
  locale,
}: {
  readonly point: RevenueChartPoint
  readonly title: string
  readonly unit: "hour" | "day"
  readonly currency: Currency
  readonly locale: string
}) {
  const { t } = useTranslation()
  const amount = (value: number) => formatAmount(value, currency, locale)
  const total =
    point.sales === undefined ? undefined : point.sales + (point.tips ?? 0)
  const ratio =
    total === undefined || point.previous === undefined
      ? null
      : statsDelta(total, point.previous).ratio
  // An hour's comparison is the same hour on another day: its date says it.
  const previousLabel =
    point.previousStart === undefined
      ? t("stats.chart.comparison")
      : unit === "hour"
        ? new Date(point.previousStart).toLocaleDateString(locale, {
            day: "numeric",
            month: "numeric",
          })
        : new Date(point.previousStart).toLocaleDateString(locale, {
            dateStyle: "medium",
          })

  return (
    <YStack gap="1" aria-live="polite">
      <Text fontWeight="600">{title}</Text>
      {total === undefined ? null : (
        <>
          <DetailLine label={t("stats.chart.sales")}>
            {amount(point.sales ?? 0)}
          </DetailLine>
          {point.tips === undefined || point.tips === 0 ? null : (
            <DetailLine label={t("stats.chart.tips")}>
              {amount(point.tips)}
            </DetailLine>
          )}
          <DetailLine label={t("stats.chart.total")} strong>
            {amount(total)}
          </DetailLine>
        </>
      )}
      {point.previous === undefined ? null : (
        <DetailLine label={previousLabel}>{amount(point.previous)}</DetailLine>
      )}
      {point.previousTips === undefined || point.previousTips === 0 ? null : (
        <DetailLine label={t("stats.tips.ofWhich")} sub>
          {amount(point.previousTips)}
        </DetailLine>
      )}
      {ratio === null ? null : (
        <DetailLine label={t("stats.chart.change")}>
          {new Intl.NumberFormat(locale, {
            style: "percent",
            signDisplay: "exceptZero",
            maximumFractionDigits: 0,
          }).format(ratio)}
        </DetailLine>
      )}
    </YStack>
  )
}

function DetailLine({
  label,
  strong = false,
  sub = false,
  children,
}: {
  readonly label: string
  readonly strong?: boolean
  /** Indented under the line above, as a part of its amount. */
  readonly sub?: boolean
  readonly children: string
}) {
  return (
    <XStack justify="space-between" gap="3" pl={sub ? 8 : 0}>
      <Text flex={1} fontSize={13} color="muted-foreground">
        {label}
      </Text>
      <Text fontSize={13} fontWeight={strong ? "700" : "400"}>
        {children}
      </Text>
    </XStack>
  )
}

function LegendItem({
  color,
  opacity = 1,
  label,
}: {
  readonly color: string
  readonly opacity?: number
  readonly label: string
}) {
  return (
    <XStack items="center" gap="2">
      <YStack
        width={10}
        height={10}
        rounded={2}
        opacity={opacity}
        style={{ backgroundColor: color }}
      />
      <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
        {label}
      </Text>
    </XStack>
  )
}
