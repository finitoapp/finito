import { useWakeLock } from "@dedalik/use-react"
import { useEffect } from "react"

/**
 * Holds a screen wake lock for as long as `enabled` is true — a terminal
 * showing a payment QR or an open cart must not dim mid-transaction.
 *
 * A wrapper rather than a direct `useWakeLock` call because the library
 * hook is imperative (`request`/`release`, no argument) while every caller
 * here wants it declarative: tie the lock to a condition and forget about
 * it. Both of its callbacks are `useCallback`-stable, so this effect runs
 * only when `enabled` actually flips.
 */
export function useScreenWakeLock(enabled: boolean): {
  readonly supported: boolean
} {
  const { isSupported, release, request } = useWakeLock()

  useEffect(() => {
    if (!enabled) return

    void request()
    // The browser releases the lock whenever the page is hidden (the screen
    // off, another app on top), and it is not taken back on its own.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void request()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void release().catch(() => undefined)
    }
  }, [enabled, release, request])

  return {
    supported: isSupported,
  }
}
