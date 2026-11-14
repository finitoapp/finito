package me.payky.securescreen

import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sets FLAG_SECURE on the app's window while JS asks for it, so a screen that
 * shows the recovery phrase is black in screenshots, screen recordings,
 * screen sharing and the recents thumbnail (account/0010).
 *
 * This is all Finito needs from expo-screen-capture, which it replaces: that
 * module also registered an Android 14+ screenshot detection callback as
 * soon as it was created, which made Android show "Finito detected this
 * screenshot" on every screen and crashed the app at start without
 * DETECT_SCREEN_CAPTURE. Nothing here detects screenshots, creating the
 * module does nothing, and it needs no permission.
 *
 * The wanted state is kept here and applied again whenever the activity
 * comes to the foreground, so it survives an activity that was not there
 * yet or was recreated while a protected screen was open.
 */
class PaykySecureScreenModule : Module() {
  @Volatile private var secure = false

  override fun definition() = ModuleDefinition {
    Name("PaykySecureScreen")

    Function("setSecure") { value: Boolean ->
      secure = value
      apply()
    }

    OnActivityEntersForeground {
      apply()
    }
  }

  private fun apply() {
    val activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      if (secure) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }
}
