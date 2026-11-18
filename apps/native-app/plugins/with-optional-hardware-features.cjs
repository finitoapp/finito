const { withAndroidManifest } = require("expo/config-plugins")

/**
 * Hardware Finito works without, declared optional so Google Play offers the
 * app to devices that lack it. Play reads a feature the manifest implies as
 * required: a permission implies its hardware and a portrait activity a
 * portrait screen, and v26.11.8 was held back from review for the two below
 * that limit the app to some phones, tablets, Chromebooks and XR headsets.
 *
 * - `screen.portrait`: implied by the portrait-locked activities of Google's
 *   code and document scanner UIs, which expo-camera bundles and Finito never
 *   opens (it scans in its own `CameraView`). The app's activity sets no
 *   orientation and follows the device, as the 961 px+ rail layout does on a
 *   tablet (navigation/0002).
 * - `wifi`: implied by expo-network's ACCESS_WIFI_STATE; the network state it
 *   reads comes from any connection, cellular and ethernet included.
 * - `camera`, and `camera.autofocus`, which Play's documentation says CAMERA
 *   implies too: the scanner shows "no camera" when none mounts
 *   (`scan-code-scanner.tsx`) and the rest of the app runs without one, as
 *   Payky's does (`apps/native-shell`, camera optional there too).
 *
 * NFC is optional in the finito-nfc module's own manifest.
 */
const optionalFeatures = [
  "android.hardware.screen.portrait",
  "android.hardware.wifi",
  "android.hardware.camera",
  "android.hardware.camera.autofocus",
]

/**
 * Adds each optional feature, or marks the one already there optional, so
 * running prebuild again changes nothing.
 *
 * @type {import("expo/config-plugins").ConfigPlugin}
 */
const withOptionalHardwareFeatures = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    const { manifest } = manifestConfig.modResults
    const declared = manifest["uses-feature"] ?? []
    const others = declared.filter(
      (feature) => !optionalFeatures.includes(feature.$["android:name"])
    )
    manifest["uses-feature"] = [
      ...others,
      ...optionalFeatures.map((name) => ({
        $: { "android:name": name, "android:required": "false" },
      })),
    ]
    return manifestConfig
  })

module.exports = withOptionalHardwareFeatures
module.exports.optionalFeatures = optionalFeatures
