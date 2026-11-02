import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const sourceRoot = import.meta.dirname
const files = readdirSync(sourceRoot, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith(".ts"))

const imports = (source: string): ReadonlyArray<string> =>
  [
    ...source.matchAll(
      /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gmu
    ),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

describe("core workspace boundary", () => {
  test("never imports application source or UI frameworks", () => {
    const offenders = files.flatMap((file) =>
      imports(readFileSync(resolve(sourceRoot, file), "utf8"))
        .filter(
          (specifier) =>
            specifier.startsWith("@/") ||
            specifier.includes("apps/") ||
            /^(?:react(?:-dom|-native)?(?:\/|$)|jotai(?:\/|$)|@tanstack\/react-|@base-ui\/|@capacitor\/|@evolu\/(?:web|react-web)(?:\/|$))/u.test(
              specifier
            ) ||
            (specifier.startsWith(".") &&
              !resolve(sourceRoot, file, "..", specifier).startsWith(
                `${sourceRoot}/`
              ))
        )
        .map((specifier) => `${file}: ${specifier}`)
    )
    expect(offenders).toEqual([])
  })

  test("keeps Node and browser effects out of shared execution paths", () => {
    const shared = files.filter(
      (file) =>
        !file.endsWith(".test.ts") &&
        !file.startsWith("runtime/") &&
        !file.startsWith("testing/") &&
        !file.endsWith("-test-fixtures.ts")
    )
    const offenders = shared.flatMap((file) => {
      const source = readFileSync(resolve(sourceRoot, file), "utf8")
      const forbidden = imports(source).filter(
        (specifier) =>
          /^(?:node:|@evolu\/nodejs(?:\/|$))/u.test(specifier) ||
          specifier.includes("/runtime/") ||
          specifier.includes("/testing/")
      )
      const ambient =
        /\b(?:navigator|process)\s*\.|(?:globalThis\.localStorage|window\s*\.\s*__)|import\.meta\.env/u.test(
          source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "")
        )
      return forbidden.length > 0 || ambient ? [file] : []
    })
    expect(offenders).toEqual([])
  })
})
