import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

const appDir = path.join(import.meta.dirname, "../..")
// CommonJS, which this ES module package cannot import; its entries are
// read from the text.
const config = readFileSync(path.join(appDir, "react-native.config.js"), "utf8")
const unlinked = [...config.matchAll(/"([^"]+)": unlinked/gu)].map(
  ([, name]) => name ?? ""
)

const sources = (dir: string): string[] =>
  readdirSync(path.join(appDir, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) return sources(file)
      return /\.tsx?$/u.test(entry.name) ? [file] : []
    }
  )

it("imports none of the packages react-native.config.js leaves unlinked", () => {
  // Their JS would load against native code the APK lacks.
  expect(unlinked).toEqual(["react-native-reanimated", "react-native-worklets"])
  const importers = [...sources("src"), ...sources("app")].filter(
    (file) =>
      !file.endsWith("unlinked-modules.test.ts") &&
      unlinked.some((name) =>
        readFileSync(path.join(appDir, file), "utf8").includes(`"${name}`)
      )
  )
  expect(importers).toEqual([])
})
