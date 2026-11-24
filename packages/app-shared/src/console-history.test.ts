import type { ConsoleEntry } from "@evolu/common"
import { SUPPORT_MESSAGE_MAX_BYTES } from "@payky/core/integrations/nostr/nostr-support-chat"
import { describe, expect, test } from "vitest"

import {
  type ConsoleFilter,
  type ConsoleOutputHistoryEntry,
  consoleEntrySources,
  consoleOtherSource,
  countConsoleEntriesByLevel,
  createConsoleOutputHistory,
  filterConsoleEntries,
  formatConsoleEntry,
  formatConsoleGroup,
  formatConsoleLog,
  formatConsoleLogExcerpt,
  supportLogMaxBytes,
} from "./console-history.ts"

const iban = "CZ6508000000192000145399"
const phrase =
  "abandon ability able about above absent absorb abstract absurd abuse access accident"
const cashuToken = `cashuB${"o2FteCJodHRwczovL21pbnQuZXhhbXBsZS5jb20".repeat(2)}`

let nextId = 0
const entry = (
  fields: Partial<ConsoleEntry> & { readonly createdAt?: number }
): ConsoleOutputHistoryEntry => ({
  method: "log",
  path: [],
  args: [],
  createdAt: Date.UTC(2026, 10, 24, 12, 30, 15, 42),
  id: nextId++,
  ...fields,
})

const timestamp = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}`

describe("console output history", () => {
  test("ids keep counting across a clear, so they stay unique", () => {
    const history = createConsoleOutputHistory({ limit: 10 })
    history.write({ method: "log", path: [], args: ["a"] })
    history.write({ method: "log", path: [], args: ["b"] })
    history.clearEntries()
    history.write({ method: "log", path: [], args: ["c"] })

    expect(history.getEntries().map((e) => e.id)).toEqual([2])
  })
})

describe("formatConsoleEntry", () => {
  test("writes time, method, path and message, a multi-line message following", () => {
    const text = formatConsoleEntry(
      entry({
        method: "info",
        path: ["relay", "db"],
        args: ["synced", { rows: 2 }],
      })
    )

    expect(text).toMatch(
      new RegExp(`^${timestamp} INFO  relay/db synced \\{\n  "rows": 2\n\\}$`)
    )
  })

  test("leaves the path out when there is none", () => {
    expect(formatConsoleEntry(entry({ method: "warn", args: ["x"] }))).toMatch(
      new RegExp(`^${timestamp} WARN  x$`)
    )
  })

  test("redacts an IBAN, a recovery phrase and a cashu token", () => {
    const text = formatConsoleEntry(entry({ args: [iban, phrase, cashuToken] }))

    expect(text).not.toContain(iban)
    expect(text).not.toContain("abandon")
    expect(text).not.toContain("cashuB")
    expect(text).toContain("[redacted]")
  })
})

describe("formatConsoleLog", () => {
  test("puts the header first, then the entries oldest first, redacted", () => {
    const older = entry({ args: ["first"] })
    const newer = entry({ args: [`second ${cashuToken}`] })

    const lines = formatConsoleLog({
      entries: [newer, older],
      header: { app: "Payky", entries: 2, iban },
    }).split("\n")

    expect(lines.slice(0, 4)).toEqual([
      "app: Payky",
      "entries: 2",
      "iban: [redacted]",
      "",
    ])
    expect(lines[4]).toMatch(/ first$/)
    expect(lines[5]).toMatch(/ second \[redacted\]$/)
    expect(lines.join("\n")).not.toContain(phrase)
  })

  test("redacts a recovery phrase in an entry", () => {
    expect(
      formatConsoleLog({ entries: [entry({ args: [phrase] })], header: {} })
    ).not.toContain("abandon")
  })
})

describe("formatConsoleLogExcerpt", () => {
  const utf8Length = (text: string) => new TextEncoder().encode(text).length
  const header = { app: "Payky" }

  test("keeps the newest entries that fit in the byte budget, oldest first", () => {
    const entries = ["first", "second", "třetí", "čtvrtý"].map((word) =>
      entry({ args: [`${word} ${"ž".repeat(40)}`] })
    )
    const all = formatConsoleLog({ entries, header })
    const lastTwo = formatConsoleLog({ entries: entries.slice(2), header })

    const excerpt = formatConsoleLogExcerpt({
      entries,
      header,
      maxBytes: utf8Length(lastTwo) + 10,
    })

    expect(excerpt).toEqual({ text: lastTwo, included: 2, total: 4 })
    expect(
      formatConsoleLogExcerpt({ entries, header, maxBytes: utf8Length(all) })
    ).toEqual({ text: all, included: 4, total: 4 })
  })

  test("cuts the newest entry to fit when not even it fits, redacted", () => {
    const excerpt = formatConsoleLogExcerpt({
      entries: [entry({ args: [`${iban} ${"ř".repeat(5000)}`] })],
      header,
      maxBytes: 1001,
    })

    expect(excerpt.included).toBe(1)
    expect(excerpt.text).toMatch(/^app: Payky\n\n.* \[redacted\] ř+…$/u)
    expect(utf8Length(excerpt.text)).toBeLessThanOrEqual(1001)
    expect(excerpt.text).not.toContain("�")
  })

  test("leaves room in a support message for the intro", () => {
    expect(supportLogMaxBytes).toBeLessThan(SUPPORT_MESSAGE_MAX_BYTES)
  })
})

describe("filterConsoleEntries", () => {
  const debug = entry({ method: "debug", path: ["relay"], args: ["ping"] })
  const info = entry({ method: "info", path: ["sync", "fio"], args: ["Done"] })
  const warn = entry({ method: "warn", path: ["relay"], args: ["slow"] })
  const error = entry({ method: "error", args: ["Boom"] })
  const entries = [debug, info, warn, error]

  const all: ConsoleFilter = { minLevel: "all", sources: new Set(), text: "" }

  test("an empty filter keeps everything", () => {
    expect(filterConsoleEntries(entries, all)).toEqual(entries)
  })

  test.each([
    ["info", ["info", "warn", "error"]],
    ["warn", ["warn", "error"]],
    ["error", ["error"]],
  ] as const)("level %s keeps %j", (minLevel, methods) => {
    expect(
      filterConsoleEntries(entries, { ...all, minLevel }).map((e) => e.method)
    ).toEqual(methods)
  })

  test("sources keep entries by the first path segment, other for no path", () => {
    expect(
      filterConsoleEntries(entries, {
        ...all,
        sources: new Set(["relay", consoleOtherSource]),
      })
    ).toEqual([debug, warn, error])
  })

  test("text matches path and message, ignoring case", () => {
    expect(filterConsoleEntries(entries, { ...all, text: "BOOM" })).toEqual([
      error,
    ])
    expect(filterConsoleEntries(entries, { ...all, text: "sync/fio" })).toEqual(
      [info]
    )
  })

  test("sources come in order of first appearance", () => {
    expect(consoleEntrySources(entries)).toEqual([
      "relay",
      "sync",
      consoleOtherSource,
    ])
  })

  test("counts what each level would show", () => {
    expect(countConsoleEntriesByLevel(entries)).toEqual({
      all: 4,
      info: 3,
      warn: 2,
      error: 1,
    })
  })
})

test("formatConsoleGroup cuts a long group to 24 characters", () => {
  expect(formatConsoleGroup(["app", "sync"])).toBe("app/sync")
  expect(formatConsoleGroup(["a".repeat(24)])).toBe("a".repeat(24))
  const cut = formatConsoleGroup(["background-jobs", "spark-sync", "wallet"])
  expect(cut).toBe("background-jobs/spark-s…")
  expect(cut).toHaveLength(24)
})
