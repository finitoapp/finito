import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"

/**
 * The `finito` Vercel projects serve the web app's API on Finito's origin
 * (docs/finito-deployment.md). Vercel deploys only the functions under the
 * project's own `api/`, so every web handler has a twin in
 * `apps/native-app/api` that re-exports it, request methods and all; a
 * handler added on the web alone would answer 404 on app.finito.fit.
 */

const webApiDir = path.resolve(import.meta.dirname, "../../../web-app/api")
const nativeApiDir = path.resolve(import.meta.dirname, "../../api")

const handlers = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter(
      (file) =>
        file.endsWith(".ts") &&
        !file.endsWith(".test.ts") &&
        // Underscored modules are helpers, not endpoints.
        !path.basename(file).startsWith("_")
    )
    .sort()

const entryExports = (source: string): ReadonlyArray<string> => {
  const methods = [
    ...source.matchAll(
      /^export const (GET|POST|PUT|PATCH|DELETE|OPTIONS)\b/gmu
    ),
  ].map((match) => match[1] ?? "")
  return [
    ...(/^export default\b/mu.test(source) ? ["default"] : []),
    ...methods,
  ]
}

const reExport = (source: string) => {
  const match = /export \{([^}]*)\} from "([^"]+)"/u.exec(source)
  return {
    names: (match?.[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== ""),
    from: match?.[2] ?? "",
  }
}

test("every web handler has a native twin and no twin is left without one", () => {
  expect(handlers(nativeApiDir)).toEqual(handlers(webApiDir))
})

test("each twin re-exports its web handler's entry points", () => {
  for (const file of handlers(webApiDir)) {
    const nativeFile = path.join(nativeApiDir, file)
    if (!existsSync(nativeFile)) continue
    const twin = reExport(readFileSync(nativeFile, "utf8"))

    expect(
      path.resolve(path.dirname(nativeFile), twin.from),
      `${file} re-exports another module`
    ).toBe(path.join(webApiDir, file.replace(/\.ts$/u, ".js")))
    expect([...twin.names].sort(), `${file} entry points`).toEqual(
      [...entryExports(readFileSync(path.join(webApiDir, file), "utf8"))].sort()
    )
  }
})
