const { mkdirSync, writeFileSync } = require("node:fs")
const { join } = require("node:path")
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins")

const marker = "// payky: debug app id"

/** The debug build types React Native's Gradle plugin defines. */
const debugBuildTypes = ["debug", "debugOptimized"]

/**
 * Installs a debug build beside the release one instead of over it: the
 * debug build types get the application id `fit.finito.app.dev` and the
 * launcher name "Finito Dev", so the dev client (`bun run android`) and a
 * release APK on the same phone each keep their own app and data. Only the
 * id changes; the namespace, and so the Java package, stay as they are.
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
            `<resources>\n  <string name="app_name">${modConfig.name} Dev</string>\n</resources>\n`
          )
        }
        return modConfig
      },
    ]
  )

module.exports = withDebugAppId
