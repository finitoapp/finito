import type { StatsRange } from "@payky/core/modules/sales-stats/sales-stats-types"
import {
  type SalesKpis,
  statsDelta,
} from "@payky/core/modules/sales-stats/sales-stats-utils"
import { type Currency, Integer } from "@payky/core/modules/shared/schema"
import { startOfDay, subMilliseconds } from "date-fns"
import ArrowDown from "lucide-react-native/icons/arrow-down"
import ArrowUp from "lucide-react-native/icons/arrow-up"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

/**
 * A range for the caption under the period: whole days as dates, a to-date
 * range (it stops at the same time a week or month earlier) with its end time.
 */
export const formatStatsRange = (range: StatsRange, locale: string) => {
  const from = new Date(range.fromIso)
  const to = new Date(range.toIso)
  const wholeDays = startOfDay(to).getTime() === to.getTime()
  const format = new Intl.DateTimeFormat(
    locale,
    wholeDays
      ? { dateStyle: "medium" }
      : { dateStyle: "medium", timeStyle: "short" }
  )
  // Hermes has no `Intl.DateTimeFormat.formatRange`: join the two ends.
  const start = format.format(from)
  const end = format.format(wholeDays ? subMilliseconds(to, 1) : to)
  return start === end ? start : `${start} – ${end}`
}

interface Tile {
  readonly label: string
  readonly value: string
  readonly current: number
  readonly previous: number
  /** The change in the tile's own unit, sign included. */
  readonly formatDifference: (difference: number) => string
  /** A refund going up is bad news. */
  readonly upIsGood: boolean
}

/** Net revenue, then sales, average sale, tips and refunds, one set per currency. */
export function KpiTiles({
  kpis,
  comparisonKpis,
}: {
  readonly kpis: ReadonlyArray<SalesKpis>
  readonly comparisonKpis: ReadonlyArray<SalesKpis>
}) {
  return (
    <YStack gap="4">
      {kpis.map((current) => (
        <CurrencyKpis
          key={current.currency}
          current={current}
          previous={comparisonKpis.find(
            (kpi) => kpi.currency === current.currency
          )}
          showCurrency={kpis.length > 1}
        />
      ))}
    </YStack>
  )
}

const tileProps = {
  gap: "1",
  p: "3",
  rounded: "md",
  bg: "card",
} as const

function CurrencyKpis({
  current,
  previous,
  showCurrency,
}: {
  readonly current: SalesKpis
  readonly previous: SalesKpis | undefined
  readonly showCurrency: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [calculationOpen, setCalculationOpen] = useState(false)
  const money = (value: number, currency: Currency = current.currency) =>
    formatMoney({ value: Integer(value), currency }, locale)
  const signedMoney = (value: number) =>
    `${value > 0 ? "+" : ""}${money(value)}`
  const signedCount = (value: number) =>
    value.toLocaleString(locale, { signDisplay: "exceptZero" })

  const netRevenue: Tile = {
    label: t("stats.kpi.netRevenue"),
    value: money(current.netRevenue),
    current: current.netRevenue,
    previous: previous?.netRevenue ?? 0,
    formatDifference: signedMoney,
    upIsGood: true,
  }
  const tiles: ReadonlyArray<Tile> = [
    {
      label: t("stats.kpi.salesCount"),
      value: current.salesCount.toLocaleString(locale),
      current: current.salesCount,
      previous: previous?.salesCount ?? 0,
      formatDifference: signedCount,
      upIsGood: true,
    },
    {
      label: t("stats.kpi.averageSale"),
      value: money(current.averageSale),
      current: current.averageSale,
      previous: previous?.averageSale ?? 0,
      formatDifference: signedMoney,
      upIsGood: true,
    },
    {
      label: t("stats.kpi.breakdown.tips"),
      value: money(current.tips),
      current: current.tips,
      previous: previous?.tips ?? 0,
      formatDifference: signedMoney,
      upIsGood: true,
    },
    {
      label:
        current.refundCount === 0
          ? t("stats.kpi.breakdown.refunds")
          : t("stats.kpi.breakdown.refundsCount", {
              count: current.refundCount.toLocaleString(locale),
            }),
      value: money(current.refundAmount),
      current: current.refundAmount,
      previous: previous?.refundAmount ?? 0,
      formatDifference: signedMoney,
      upIsGood: false,
    },
  ]

  return (
    <YStack gap="2">
      {showCurrency ? (
        <Text
          fontSize="xs"
          lineHeight="xs"
          fontWeight="700"
          color="muted-foreground"
        >
          {current.currency}
        </Text>
      ) : null}
      <YStack {...tileProps}>
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {netRevenue.label}
        </Text>
        <Text fontSize="3xl" lineHeight="3xl" fontWeight="600">
          {netRevenue.value}
        </Text>
        <DeltaLabel tile={netRevenue} />
        <Collapsible open={calculationOpen} onOpenChange={setCalculationOpen}>
          <CalculationTrigger label={t("stats.kpi.howCalculated")} />
          <CollapsibleContent
            gap="1"
            pt="2"
            mt="2"
            borderTopWidth={1}
            borderColor="border-color"
          >
            <BreakdownLine label={t("stats.kpi.breakdown.sales")}>
              {money(current.gross)}
            </BreakdownLine>
            <BreakdownLine label={`− ${t("stats.kpi.breakdown.refunds")}`}>
              {money(current.saleRefundAmount)}
            </BreakdownLine>
            <BreakdownLine label={`= ${netRevenue.label}`} total>
              {netRevenue.value}
            </BreakdownLine>
          </CollapsibleContent>
        </Collapsible>
      </YStack>
      <XStack flexWrap="wrap" gap="2">
        {tiles.map((tile) => (
          <YStack key={tile.label} {...tileProps} flexBasis="47%" flexGrow={1}>
            <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
              {tile.label}
            </Text>
            <Text fontSize="xl" lineHeight="xl" fontWeight="600">
              {tile.value}
            </Text>
            <DeltaLabel tile={tile} />
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}

export function BreakdownLine({
  label,
  total = false,
  children,
}: {
  readonly label: string
  /** The line an equation comes to. */
  readonly total?: boolean
  readonly children: string
}) {
  return (
    <XStack justify="space-between" gap="3">
      <Text
        flex={1}
        fontWeight={total ? "700" : "400"}
        color={total ? "color" : "muted-foreground"}
      >
        {label}
      </Text>
      <Text fontWeight={total ? "700" : "400"}>{children}</Text>
    </XStack>
  )
}

function CalculationTrigger({ label }: { readonly label: string }) {
  return (
    <CollapsibleTrigger mt="1" flexDirection="row" items="center" gap="1">
      <Text
        fontSize="xs"
        lineHeight="xs"
        fontWeight="600"
        color="muted-foreground"
      >
        {label}
      </Text>
      <CollapsibleChevron size={14} color="muted-foreground" />
    </CollapsibleTrigger>
  )
}

/**
 * The change against the comparison: an arrow, the percentage and the
 * difference itself, so it reads without the colour too.
 */
function DeltaLabel({ tile }: { readonly tile: Tile }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { ratio, difference } = statsDelta(tile.current, tile.previous)
  if (ratio === null) {
    return (
      <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
        {t("stats.delta.none")}
      </Text>
    )
  }
  const good = ratio === 0 ? null : ratio > 0 === tile.upIsGood
  const color =
    good === null ? "muted-foreground" : good ? "success" : "destructive"
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(ratio)

  return (
    <XStack items="center" flexWrap="wrap" gap="1">
      {ratio > 0 ? <Icon icon={ArrowUp} size={12} color={color} /> : null}
      {ratio < 0 ? <Icon icon={ArrowDown} size={12} color={color} /> : null}
      <Text fontSize="xs" lineHeight="xs" fontWeight="600" color={color}>
        {percent}
      </Text>
      {difference === 0 ? null : (
        <Text fontSize="xs" lineHeight="xs" color={color} opacity={0.8}>
          {`· ${tile.formatDifference(difference)}`}
        </Text>
      )}
    </XStack>
  )
}
