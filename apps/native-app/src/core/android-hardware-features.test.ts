import { createRequire } from "node:module"
import type { ExpoConfig } from "expo/config"
import { describe, expect, test } from "vitest"
import appConfig from "../../app.config.ts"

interface UsesFeature {
  readonly $: Readonly<Record<string, string>>
}

interface Manifest {
  readonly manifest: { readonly "uses-feature"?: ReadonlyArray<UsesFeature> }
}

interface ManifestModConfig extends ExpoConfig {
  readonly mods: {
    readonly android: {
      readonly manifest: (config: unknown) => Promise<{
        readonly modResults: Manifest
      }>
    }
  }
}

const require = createRequire(import.meta.url)
const pluginPath = "../../plugins/with-optional-hardware-features.cjs"
const withOptionalHardwareFeatures = require(pluginPath) as ((
  config: ExpoConfig
) => ManifestModConfig) & { readonly optionalFeatures: ReadonlyArray<string> }

/** Runs the plugin's manifest mod over `manifest`, as prebuild does. */
async function runPlugin(manifest: Manifest): Promise<Manifest> {
  const config = withOptionalHardwareFeatures({
    name: appConfig.name,
    slug: "finito",
  })
  const result = await config.mods.android.manifest({
    ...config,
    modResults: manifest,
    modRequest: {
      platform: "android",
      modName: "manifest",
      introspect: false,
      platformProjectRoot: "",
    },
  })
  return result.modResults
}

const features = (manifest: Manifest) =>
  (manifest.manifest["uses-feature"] ?? []).map(({ $ }) => [
    $["android:name"],
    $["android:required"],
  ])

describe("the hardware features Finito declares", () => {
  test("are the ones Google Play held v26.11.8 back for, and the camera's", () => {
    expect(withOptionalHardwareFeatures.optionalFeatures).toEqual([
      "android.hardware.screen.portrait",
      "android.hardware.wifi",
      "android.hardware.camera",
      "android.hardware.camera.autofocus",
    ])
  })

  test("are declared optional, so Play implies none of them required", async () => {
    expect(features(await runPlugin({ manifest: {} }))).toEqual(
      withOptionalHardwareFeatures.optionalFeatures.map((name) => [
        name,
        "false",
      ])
    )
  })

  test("turn a required declaration optional and leave the others", async () => {
    const manifest = await runPlugin({
      manifest: {
        "uses-feature": [
          {
            $: {
              "android:name": "android.hardware.camera",
              "android:required": "true",
            },
          },
          { $: { "android:name": "android.hardware.usb.host" } },
        ],
      },
    })
    expect(features(manifest)).toEqual([
      ["android.hardware.usb.host", undefined],
      ...withOptionalHardwareFeatures.optionalFeatures.map((name) => [
        name,
        "false",
      ]),
    ])
    // Prebuild run again over its own output changes nothing.
    expect(await runPlugin(manifest)).toEqual(manifest)
  })

  test("run with every prebuild", () => {
    expect(appConfig.plugins).toContain(
      "./plugins/with-optional-hardware-features.cjs"
    )
  })
})
