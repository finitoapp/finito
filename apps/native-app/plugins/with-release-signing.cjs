const { withAppBuildGradle } = require("expo/config-plugins")

const marker = "// payky: release signing"

/**
 * Signs the release build with Finito's upload key when Gradle is handed one
 * (`finitoReleaseStoreFile` and its passwords, which the release workflow
 * passes as `ORG_GRADLE_PROJECT_*` variables, so no secret lands in a file).
 * Without it the release build keeps the template's debug key, which is what
 * a local or e2e release build wants.
 *
 * @type {import("expo/config-plugins").ConfigPlugin}
 */
const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    if (!gradleConfig.modResults.contents.includes(marker)) {
      gradleConfig.modResults.contents += `
${marker}
if (findProperty('finitoReleaseStoreFile')) {
  android {
    signingConfigs {
      release {
        storeFile file(findProperty('finitoReleaseStoreFile'))
        storePassword findProperty('finitoReleaseStorePassword')
        keyAlias findProperty('finitoReleaseKeyAlias')
        keyPassword findProperty('finitoReleaseKeyPassword')
      }
    }
    buildTypes {
      release {
        signingConfig signingConfigs.release
      }
    }
  }
}
`
    }
    return gradleConfig
  })

module.exports = withReleaseSigning
