import type { ConsoleEntry, ConsoleMethod, ConsoleOutput } from "@evolu/common"
import { SUPPORT_MESSAGE_MAX_BYTES } from "@payky/core/integrations/nostr/nostr-support-chat"
import { format } from "date-fns"

import { scrubText } from "./error-scrubbing.ts"

export interface ConsoleOutputHistory extends ConsoleOutput {
  readonly getEntries: () => ReadonlyArray<ConsoleOutputHistoryEntry>
  readonly clearEntries: () => void
  readonly subscribe: (listener: () => void) => () => void
}

export interface ConsoleOutputHistoryEntry extends ConsoleEntry {
  /** Counts up for the history's lifetime, across `clearEntries` too. */
  readonly id: number
  readonly createdAt: number
}

export function createConsoleOutputHistory({
  limit,
}: {
  readonly limit: number
}): ConsoleOutputHistory {
  const entries: ConsoleOutputHistoryEntry[] = []
  const listeners = new Set<() => void>()
  let nextId = 0

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    write: (entry) => {
      entries.push({
        ...entry,
        id: nextId++,
        createdAt: Date.now(),
      })

      if (entries.length > limit) {
        entries.splice(0, entries.length - limit)
      }

      notify()
    },

    getEntries: () => [...entries],

    clearEntries: () => {
      entries.length = 0
      notify()
    },

    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const formatConsoleArgs = (args: ReadonlyArray<unknown>): string =>
  args.map(formatConsoleArg).join(" ")

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === "string") return arg
  if (typeof arg === "undefined") return "undefined"
  if (typeof arg === "bigint") return `${arg.toString()}n`
  if (typeof arg === "symbol") return arg.toString()
  if (typeof arg === "function") return `[Function ${arg.name || "anonymous"}]`
  if (arg instanceof Error) return arg.stack ?? arg.message

  try {
    const json = JSON.stringify(arg, null, 2)
    return json ?? String(arg)
  } catch {
    return String(arg)
  }
}

/**
 * One entry as plain text: `<time> <METHOD> <path> <message>`, the lines of a
 * multi-line message (a stack, JSON) following. Redacted as error reports are
 * (settings/0006), so it is what copy, export and send produce, not what the
 * screen shows.
 */
export function formatConsoleEntry(entry: ConsoleOutputHistoryEntry): string {
  const time = format(entry.createdAt, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
  const path = entry.path.length > 0 ? [entry.path.join("/")] : []
  return [
    time,
    entry.method.toUpperCase().padEnd(5),
    ...path,
    scrubText(formatConsoleArgs(entry.args)),
  ].join(" ")
}

/** Key/value lines the app puts above an exported or copied log. */
export type ConsoleLogHeader = Readonly<Record<string, string | number>>

/** A header block, a blank line, then `entries` oldest first. Redacted. */
export function formatConsoleLog({
  entries,
  header,
}: {
  readonly entries: ReadonlyArray<ConsoleOutputHistoryEntry>
  readonly header: ConsoleLogHeader
}): string {
  const headerLines = Object.entries(header).map(
    ([key, value]) => `${key}: ${scrubText(String(value))}`
  )
  const entryLines = entries
    .toSorted((a, b) => a.id - b.id)
    .map(formatConsoleEntry)
  return [...headerLines, "", ...entryLines].join("\n")
}

const utf8Length = (text: string) => new TextEncoder().encode(text).length

/**
 * What a log sent to support may take of a message: its limit less room for
 * the intro and the truncation line around it (support/0005).
 */
export const supportLogMaxBytes = SUPPORT_MESSAGE_MAX_BYTES - 512

/**
 * `formatConsoleLog` of the newest `entries` that fit in `maxBytes` of UTF-8,
 * for a message that cannot carry the whole log (support/0005). When not even
 * the newest entry fits, it is cut to fit and ends with "…". `included` of
 * `total` entries made it in.
 */
export function formatConsoleLogExcerpt({
  entries,
  header,
  maxBytes,
}: {
  readonly entries: ReadonlyArray<ConsoleOutputHistoryEntry>
  readonly header: ConsoleLogHeader
  readonly maxBytes: number
}): {
  readonly text: string
  readonly included: number
  readonly total: number
} {
  const total = entries.length
  const headerOnly = formatConsoleLog({ entries: [], header })
  const newestFirst = entries.toSorted((a, b) => b.id - a.id)
  let used = utf8Length(headerOnly)
  let included = 0
  for (const entry of newestFirst) {
    // Each entry is its line and the newline before it.
    const cost = utf8Length(formatConsoleEntry(entry)) + 1
    if (used + cost > maxBytes) break
    used += cost
    included++
  }
  const [newest] = newestFirst
  if (included === 0 && newest !== undefined) {
    const room = Math.max(0, maxBytes - utf8Length(headerOnly) - 1 - 3)
    const bytes = new TextEncoder().encode(formatConsoleEntry(newest))
    // A multi-byte character cut in half decodes as one U+FFFD, dropped.
    const cut = new TextDecoder()
      .decode(bytes.slice(0, room))
      .replace(/�$/u, "")
    return { text: `${headerOnly}\n${cut}…`, included: 1, total }
  }
  return {
    text: formatConsoleLog({ entries: newestFirst.slice(0, included), header }),
    included,
    total,
  }
}

export type ConsoleFilterLevel = "all" | "info" | "warn" | "error"

export const consoleFilterLevels: ReadonlyArray<ConsoleFilterLevel> = [
  "all",
  "info",
  "warn",
  "error",
]

const methodRank = {
  trace: 0,
  debug: 1,
  log: 2,
  info: 3,
  warn: 4,
  error: 5,
} satisfies Record<ConsoleMethod, number>

const filterLevelRank = {
  all: 0,
  info: 3,
  warn: 4,
  error: 5,
} satisfies Record<ConsoleFilterLevel, number>

/** The source of an entry logged without a path. */
export const consoleOtherSource = ""

/** An entry's source: the first segment of its path. */
export const consoleEntrySource = (entry: ConsoleEntry): string =>
  entry.path[0] ?? consoleOtherSource

/** Distinct sources in the order they first appear. */
export const consoleEntrySources = (
  entries: ReadonlyArray<ConsoleEntry>
): ReadonlyArray<string> => [...new Set(entries.map(consoleEntrySource))]

export interface ConsoleFilter {
  readonly minLevel: ConsoleFilterLevel
  /** Empty means every source. */
  readonly sources: ReadonlySet<string>
  /** Case-insensitive substring of the path and the message. */
  readonly text: string
}

export function filterConsoleEntries<E extends ConsoleOutputHistoryEntry>(
  entries: ReadonlyArray<E>,
  filter: ConsoleFilter
): ReadonlyArray<E> {
  const minRank = filterLevelRank[filter.minLevel]
  const text = filter.text.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      methodRank[entry.method] >= minRank &&
      (filter.sources.size === 0 ||
        filter.sources.has(consoleEntrySource(entry))) &&
      (text === "" ||
        `${entry.path.join("/")} ${formatConsoleArgs(entry.args)}`
          .toLowerCase()
          .includes(text))
  )
}

/** How many entries each level option would show. */
export function countConsoleEntriesByLevel(
  entries: ReadonlyArray<ConsoleEntry>
): Readonly<Record<ConsoleFilterLevel, number>> {
  const count = (level: ConsoleFilterLevel) =>
    entries.filter(
      (entry) => methodRank[entry.method] >= filterLevelRank[level]
    ).length
  return {
    all: entries.length,
    info: count("info"),
    warn: count("warn"),
    error: count("error"),
  }
}
