import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"
import { z } from "zod"

/**
 * The conditions of the bundlers and runtimes that compile core's TypeScript
 * themselves, so they read `src`: Vite (`browser`), Bun, Vitest and Metro in
 * development (`development`), and Metro in an Android release build, which
 * sets only `react-native` and would otherwise fall through to `default`,
 * the `dist` that only Node's production resolution builds.
 */
const sourceConditions = [
  "types",
  "browser",
  "bun",
  "development",
  "react-native",
] as const

const { exports } = z
  .object({ exports: z.record(z.string(), z.record(z.string(), z.string())) })
  .parse(
    JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8")
    )
  )
const entries = Object.entries(exports)

describe("core package exports", () => {
  test("declares entries", () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  test.each(entries)(
    "%s resolves to its source for every source-compiling condition, before default",
    (_subpath, conditions) => {
      const source = conditions.types
      expect(source).toMatch(/^\.\/src\//u)
      expect(Object.keys(conditions)).toEqual([...sourceConditions, "default"])
      for (const condition of sourceConditions) {
        expect(conditions[condition]).toBe(source)
      }
    }
  )
})
