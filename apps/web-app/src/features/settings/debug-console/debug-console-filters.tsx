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

import { SearchInput } from "@/components/search-input.tsx"
import { Toggle } from "@/components/ui/toggle.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

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

/** Level, source and text filters over `entries` (the live or paused list). */
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

  const toggleSource = (source: string, pressed: boolean) => {
    const next = new Set(filter.sources)
    if (pressed) next.add(source)
    else next.delete(source)
    onFilterChange({ ...filter, sources: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        value={filter.text}
        onChange={(text) => onFilterChange({ ...filter, text })}
        placeholder={t("settings.debugConsole.filter.search")}
        clearAriaLabel={t("catalog.items.search.clear.aria")}
      />
      <ToggleGroup
        aria-label={t("settings.debugConsole.filter.level")}
        variant="outline"
        size="sm"
        className="flex-wrap"
        value={[filter.minLevel]}
        onValueChange={([value]) => {
          const minLevel = consoleFilterLevels.find((level) => level === value)
          // Pressing the selected level again would leave none selected.
          if (minLevel !== undefined) onFilterChange({ ...filter, minLevel })
        }}
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
      {sources.length > 1 ? (
        <fieldset
          aria-label={t("settings.debugConsole.filter.sources")}
          className="flex flex-wrap gap-1.5"
        >
          {sources.map((source) => (
            <Toggle
              key={source}
              variant="outline"
              size="sm"
              className="font-mono"
              pressed={filter.sources.has(source)}
              onPressedChange={(pressed) => toggleSource(source, pressed)}
            >
              {source === consoleOtherSource
                ? t("settings.debugConsole.filter.source.other")
                : source}
            </Toggle>
          ))}
        </fieldset>
      ) : null}
    </div>
  )
}
