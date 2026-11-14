import { expect, test } from "vitest"
import appConfig from "../../app.config.ts"
import packageJson from "../../package.json"

/**
 * expo-screen-capture's native module registers an Android 14+ screen
 * capture callback as soon as it is created, whether or not anything
 * listens for screenshots, and Android throws without DETECT_SCREEN_CAPTURE.
 * The module is created while the bundle loads, so blocking the permission
 * crashed Finito at start on every Android 14+ phone (v26.11.5, v26.11.6).
 */
test("keeps the permission expo-screen-capture needs at start", () => {
  expect(packageJson.dependencies).toHaveProperty("expo-screen-capture")
  expect(appConfig.android.blockedPermissions).not.toContain(
    "android.permission.DETECT_SCREEN_CAPTURE"
  )
})
