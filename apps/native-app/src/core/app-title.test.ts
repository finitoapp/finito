import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { brandName } from "@payky/app-shared/brand"
import type { ExpoConfig } from "expo/config"
import { describe, expect, test } from "vitest"
import appConfig from "../../app.config.ts"
import { appBrand } from "./app-brand.ts"
import { appChannels, appTitle } from "./app-title.cjs"

describe("appTitle", () => {
  test("names production by the brand alone", () => {
    expect(appTitle("Finito", "production")).toBe("Finito")
  })

  test.each([
    ["edge", "Finito edge"],
    ["prev", "Finito prev"],
    ["dev", "Finito dev"],
  ] as const)("names the %s channel after the brand", (channel, title) => {
    expect(appTitle("Finito", channel)).toBe(title)
  })

  test("takes the same brand name in the app as in the Expo config", () => {
    expect(brandName(appBrand)).toBe(appConfig.name)
  })

  test("fits Android's launcher label on every channel", () => {
    for (const channel of appChannels) {
      expect(appTitle(appConfig.name, channel).length).toBeLessThanOrEqual(11)
    }
  })
})

interface DangerousModConfig extends ExpoConfig {
  readonly mods: {
    readonly android: {
      readonly dangerous: (config: unknown) => Promise<unknown>
    }
  }
}

/** Runs the debug app id plugin's file writes into a fresh project root. */
async function runDebugAppIdPlugin(): Promise<string> {
  const withDebugAppId = createRequire(import.meta.url)(
    "../../plugins/with-debug-app-id.cjs"
  ) as (config: ExpoConfig) => DangerousModConfig
  const config = withDebugAppId({ name: appConfig.name, slug: "finito" })
  const platformProjectRoot = mkdtempSync(path.join(tmpdir(), "finito-"))
  await config.mods.android.dangerous({
    ...config,
    modRequest: {
      platform: "android",
      modName: "dangerous",
      introspect: false,
      platformProjectRoot,
    },
  })
  return platformProjectRoot
}

describe("the APK's name", () => {
  test("keeps the release build plain Finito", async () => {
    expect(appConfig.name).toBe("Finito")
    const platformProjectRoot = await runDebugAppIdPlugin()
    try {
      // Only the debug build types get a name of their own; main's, which
      // the release build takes, stays the config's.
      expect(
        readdirSync(path.join(platformProjectRoot, "app/src")).toSorted()
      ).toEqual(["debug", "debugOptimized"])
    } finally {
      rmSync(platformProjectRoot, { recursive: true, force: true })
    }
  })

  test("names the debug build types after the dev channel", async () => {
    const platformProjectRoot = await runDebugAppIdPlugin()
    try {
      for (const buildType of ["debug", "debugOptimized"]) {
        expect(
          readFileSync(
            path.join(
              platformProjectRoot,
              `app/src/${buildType}/res/values/strings.xml`
            ),
            "utf8"
          )
        ).toContain('<string name="app_name">Finito dev</string>')
      }
    } finally {
      rmSync(platformProjectRoot, { recursive: true, force: true })
    }
  })
})
