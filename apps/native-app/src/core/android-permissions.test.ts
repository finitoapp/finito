import { expect, test } from "vitest"
import appConfig from "../../app.config.ts"
import packageJson from "../../package.json"

/**
 * Finito keeps the recovery phrase out of screenshots with FLAG_SECURE alone
 * and never detects screenshots (account/0010), so DETECT_SCREEN_CAPTURE is
 * blocked. expo-screen-capture must not come back with it: its native module
 * registers an Android 14+ screen capture callback as soon as it is created,
 * which throws without the permission, and the module is created while the
 * bundle loads, so v26.11.5 and v26.11.6 crashed at start on every Android
 * 14+ phone.
 */
test("blocks screenshot detection and leaves out the module that needs it", () => {
  expect(appConfig.android.blockedPermissions).toContain(
    "android.permission.DETECT_SCREEN_CAPTURE"
  )
  expect(packageJson.dependencies).not.toHaveProperty("expo-screen-capture")
})
