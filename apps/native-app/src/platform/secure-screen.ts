import { NativeModule, requireOptionalNativeModule } from "expo"

/** `modules/finito-secure-screen`: FLAG_SECURE on the app's window. */
declare class FinitoSecureScreenNativeModule extends NativeModule {
  setSecure(secure: boolean): void
}

// Absent on the PWA, which cannot keep the screen out of a screenshot, and
// in a binary built before the module existed: then nothing is protected.
const secureScreen =
  requireOptionalNativeModule<FinitoSecureScreenNativeModule>(
    "FinitoSecureScreen"
  )

let holders = 0

/**
 * Keeps the window out of screenshots, recordings, screen sharing and the
 * recents thumbnail until the returned function is called (account/0010).
 * Holds are counted, so two protected components can overlap and the window
 * is released only when the last one lets go; releasing twice is harmless.
 */
export const holdSecureScreen = (): (() => void) => {
  holders += 1
  if (holders === 1) secureScreen?.setSecure(true)
  let released = false
  return () => {
    if (released) return
    released = true
    holders -= 1
    if (holders === 0) secureScreen?.setSecure(false)
  }
}
