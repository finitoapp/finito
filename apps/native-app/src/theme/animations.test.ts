import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test } from "vitest"

/**
 * `patches/@tamagui%2Fanimations-react-native@*.patch` keeps the React Native
 * driver from animating layout dimensions, so a fixed-size control whose fill
 * fades on press stays on the native driver (`theme/animations.ts`). A Tamagui
 * upgrade that drops the patch fails here first.
 */
test("Tamagui's React Native driver animates no layout dimension", () => {
  const driverDir = path.dirname(
    createRequire(import.meta.url).resolve(
      "@tamagui/animations-react-native/package.json"
    )
  )
  const driver = readFileSync(
    path.join(driverDir, "dist/esm/createAnimations.native.js"),
    "utf8"
  )
  expect(driver).toContain("var layoutStyleKey = {};")
})
