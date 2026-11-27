import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test } from "vitest"

/**
 * `patches/react-native@*.patch` copies the bridgeless UIManager's properties
 * as descriptors instead of spreading them, so the getter it defines per lazily
 * loaded view manager stays lazy and Android is not asked for every view
 * manager's constants at start. A React Native upgrade that drops the patch
 * fails here first.
 */
test("React Native's UIManager keeps lazy view manager getters lazy", () => {
  const reactNativeDir = path.dirname(
    createRequire(import.meta.url).resolve("react-native/package.json")
  )
  const uiManager = readFileSync(
    path.join(reactNativeDir, "Libraries/ReactNative/UIManager.js"),
    "utf8"
  )
  expect(uiManager).toContain(
    "Object.defineProperties({}, Object.getOwnPropertyDescriptors(UIManagerImpl))"
  )
  expect(uiManager).not.toContain("...UIManagerImpl")
})
