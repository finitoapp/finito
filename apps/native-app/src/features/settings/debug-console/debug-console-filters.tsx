import {
  type ConsoleFilter,
  type ConsoleFilterLevel,
  type ConsoleOutputHistoryEntry,
  consoleEntrySources,
  consoleFilterLevels,
  consoleOtherSource,
  countConsoleEntriesByLevel,
} from "@payky/app-shared/console-history"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useMemo } from "react"
import { ScrollView } from "react-native"
import { XStack, YStack } from "tamagui"
import { SearchInput } from "../../../components/search-input.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"

export const emptyConsoleFilter: ConsoleFilter = {
  minLevel: "all",
  sources: new Set(),
  text: "",
}

const levelLabelKeys = {
  all: "settings.debugConsole.filter.level.all",
  info: "settings.debugConsole.filter.level.info",
  warn: "settings.debugConsole.filter.level.warn",
  error: "settings.debugConsole.filter.level.error",
} satisfies Record<ConsoleFilterLevel, TranslationKey>

/** A pressed source chip keeps the fill of a selected `ToggleGroupItem`. */
const pressedChipFill = {
  rest: "button-outline-pressed",
  pressed: "button-outline-pressed",
} as const

/**
 * Web's `DebugConsoleFilters`: level, source and text filters over `entries`
 * (the live or paused list). Native difference: the kit has no `Toggle`, so
 * a source chip is a small outline `Button` that takes a selected toggle's
 * fill while pressed.
 */
export function DebugConsoleFilters({
  entries,
  filter,
  onFilterChange,
}: {
  readonly entries: ReadonlyArray<ConsoleOutputHistoryEntry>
  readonly filter: ConsoleFilter
  readonly onFilterChange: (filter: ConsoleFilter) => void
}) {
  const { t } = useTranslation()
  const levelCounts = useMemo(
    () => countConsoleEntriesByLevel(entries),
    [entries]
  )
  const sources = useMemo(() => consoleEntrySources(entries), [entries])

  const toggleSource = (source: string) => {
    const next = new Set(filter.sources)
    if (next.has(source)) next.delete(source)
    else next.add(source)
    onFilterChange({ ...filter, sources: next })
  }

  return (
    <YStack gap={12}>
      <SearchInput
        value={filter.text}
        onChange={(text) => onFilterChange({ ...filter, text })}
        placeholder={t("settings.debugConsole.filter.search")}
        clearAriaLabel={t("catalog.items.search.clear.aria")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
      >
        <ToggleGroup
          aria-label={t("settings.debugConsole.filter.level")}
          variant="outline"
          size="sm"
          value={filter.minLevel}
          onValueChange={(minLevel) => onFilterChange({ ...filter, minLevel })}
        >
          {consoleFilterLevels.map((level) => (
            <ToggleGroupItem key={level} value={level}>
              {t("settings.debugConsole.filter.levelWithCount", {
                level: t(levelLabelKeys[level]),
                count: levelCounts[level],
              })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ScrollView>
      {sources.length > 1 ? (
        <XStack
          role="group"
          aria-label={t("settings.debugConsole.filter.sources")}
          flexWrap="wrap"
          gap={6}
        >
          {sources.map((source) => {
            const pressed = filter.sources.has(source)
            return (
              <Button
                key={source}
                variant="outline"
                size="xs"
                aria-selected={pressed}
                {...(pressed ? { fillColors: pressedChipFill } : {})}
                label={
                  source === consoleOtherSource
                    ? t("settings.debugConsole.filter.source.other")
                    : source
                }
                onPress={() => toggleSource(source)}
              />
            )
          })}
        </XStack>
      ) : null}
    </YStack>
  )
}
