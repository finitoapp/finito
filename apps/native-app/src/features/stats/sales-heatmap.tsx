import { heatmapOpacity } from "@payky/app-shared/stats-sections"
import { salesHeatmap } from "@payky/core/modules/sales-stats/sales-stats-utils"
import type { Currency } from "@payky/core/modules/shared/schema"
import { addDays, differenceInCalendarDays, setHours } from "date-fns"
import { useMemo, useState } from "react"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { StatsSection, useStatsMoney } from "./stats-section.tsx"
import type { SalesStats } from "./use-sales-stats.ts"

/** 1 January 2024 was a Monday: the heatmap's first row. */
const aMonday = new Date(2024, 0, 1)
/**
 * Gross sales by local weekday (Monday first) and hour, for periods of seven
 * days and longer, since a shorter one has a single sample per cell at best.
 * In one currency, the first of the period's, as the chart. Tap a cell for
 * its takings.
 */
export function SalesHeatmap({
  stats,
  currency,
}: {
  readonly stats: SalesStats
  readonly currency: Currency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const theme = useTheme()
  const money = useStatsMoney()
  const { range } = stats.ranges
  const [selected, setSelected] = useState<{
    readonly day: number
    readonly hour: number
  } | null>(null)

  const matrix = useMemo(
    () => salesHeatmap(stats.hourRows, currency),
    [stats.hourRows, currency]
  )

  const days = differenceInCalendarDays(
    new Date(range.toIso),
    new Date(range.fromIso)
  )
  if (days < 7) return null

  const takings = (cell: (typeof matrix)[number][number]) =>
    cell.gross + cell.tips
  const max = Math.max(0, ...matrix.flat().map(takings))
  const weekday = (index: number, style: "short" | "long") =>
    addDays(aMonday, index).toLocaleDateString(locale, { weekday: style })
  const hourLabel = (hour: number) =>
    setHours(aMonday, hour).toLocaleTimeString(locale, { hour: "numeric" })
  const cellDescription = (
    cell: (typeof matrix)[number][number],
    day: number,
    hour: number
  ) => {
    const params = {
      weekday: weekday(day, "long"),
      hour: setHours(aMonday, hour).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      amount: money(takings(cell), currency),
      count: cell.count.toLocaleString(locale),
    }
    return cell.tips === 0
      ? t("stats.heatmap.cell", params)
      : t("stats.heatmap.cellTips", {
          ...params,
          tips: money(cell.tips, currency),
        })
  }
  const color = theme["chart-1"]?.val ?? "#e36b2c"

  const selectedCell =
    selected === null ? undefined : matrix[selected.day]?.[selected.hour]
  const description =
    selected === null || selectedCell === undefined
      ? null
      : cellDescription(selectedCell, selected.day, selected.hour)

  return (
    <StatsSection title={t("stats.heatmap.title")}>
      <YStack gap="1">
        {matrix.map((row, dayIndex) => (
          <XStack key={weekday(dayIndex, "long")} gap="1" items="center">
            <Text width={28} fontSize={10} color="muted-foreground">
              {weekday(dayIndex, "short")}
            </Text>
            {row.map((cell, hour) => (
              <YStack
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour row
                key={hour}
                flex={1}
                height={22}
                rounded={2}
                overflow="hidden"
                bg="muted"
                role="button"
                aria-label={cellDescription(cell, dayIndex, hour)}
                cursor="web:pointer"
                onPress={() => setSelected({ day: dayIndex, hour })}
              >
                <YStack
                  flex={1}
                  opacity={heatmapOpacity(takings(cell), max)}
                  style={{ backgroundColor: color }}
                />
              </YStack>
            ))}
          </XStack>
        ))}
        <XStack gap="1" pl={32}>
          {[0, 6, 12, 18].map((hour) => (
            <Text
              key={hour}
              flex={6}
              fontSize={10}
              color="muted-foreground"
              numberOfLines={1}
            >
              {hourLabel(hour)}
            </Text>
          ))}
        </XStack>
      </YStack>
      {description === null ? null : (
        <Text aria-live="polite">{description}</Text>
      )}
    </StatsSection>
  )
}
