import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"
import { safeAreaPadding } from "./safe-area-padding.ts"

const insets = { top: 24, bottom: 16, left: 0, right: 4 }

test("adds the inset to the style's own padding on each edge", () => {
  expect(
    safeAreaPadding(
      { paddingTop: 10, paddingHorizontal: 12, padding: 2 },
      insets,
      ["top", "right", "bottom", "left"]
    )
  ).toEqual({
    paddingTop: 34,
    paddingRight: 16,
    paddingBottom: 18,
    paddingLeft: 12,
  })
})

test("leaves the edges it is not given to the style", () => {
  expect(safeAreaPadding({ paddingBottom: 8 }, insets, ["top"])).toEqual({
    paddingTop: 24,
  })
})

const srcDir = path.resolve(import.meta.dirname, "..")
const appDir = path.resolve(srcDir, "../app")

const sourceFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/u.test(file))
    .map((file) => path.join(dir, file))

test("the app's screens use this SafeAreaView, not the library's native one", () => {
  const offenders = [...sourceFiles(srcDir), ...sourceFiles(appDir)].filter(
    (file) =>
      /import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*["']react-native-safe-area-context["']/u.test(
        readFileSync(file, "utf8")
      )
  )
  expect(offenders.map((file) => path.relative(srcDir, file))).toEqual([])
})
