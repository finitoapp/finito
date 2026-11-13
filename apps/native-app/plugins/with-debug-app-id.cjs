const { mkdirSync, writeFileSync } = require("node:fs")
const { join } = require("node:path")
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins")
const { appTitle } = require("../src/core/app-title.cjs")

const marker = "// payky: debug app id"

/** The debug build types React Native's Gradle plugin defines. */
const debugBuildTypes = ["debug", "debugOptimized"]

/**
 * Installs a debug build beside the release one instead of over it: the
 * debug build types get the application id `fit.finito.app.dev` and the
 * launcher name of the dev channel, "Finito dev" (`appTitle`, brand/0005), so
 * the dev client (`bun run android`) and a release APK on the same phone each
 * keep their own app and data. The release build keeps the config's `name`,
 * plain "Finito", as the production channel. Only the id changes; the
 * namespace, and so the Java package, stay as they are.
 *
 * @type {import("expo/config-plugins").ConfigPlugin}
 */
const withDebugAppId = (config) =>
  withDangerousMod(
    withAppBuildGradle(config, (gradleConfig) => {
      if (!gradleConfig.modResults.contents.includes(marker)) {
        gradleConfig.modResults.contents += `
${marker}
android {
  buildTypes.configureEach { buildType ->
    if (${JSON.stringify(debugBuildTypes)}.contains(buildType.name)) {
      buildType.applicationIdSuffix ".dev"
    }
  }
}
`
      }
      return gradleConfig
    }),
    [
      "android",
      (modConfig) => {
        // A build type's own resources override main's app_name.
        for (const buildType of debugBuildTypes) {
          const dir = join(
            modConfig.modRequest.platformProjectRoot,
            `app/src/${buildType}/res/values`
          )
          mkdirSync(dir, { recursive: true })
          writeFileSync(
            join(dir, "strings.xml"),
            `<resources>\n  <string name="app_name">${appTitle(modConfig.name, "dev")}</string>\n</resources>\n`
          )
        }
        return modConfig
      },
    ]
  )

module.exports = withDebugAppId
