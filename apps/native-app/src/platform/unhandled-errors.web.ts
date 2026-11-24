import type { Console } from "@evolu/common"

type ErrorEventTarget = Pick<Window, "addEventListener">

const installedOn = new WeakSet<ErrorEventTarget>()

/**
 * The web export's `captureUnhandledErrors`: an uncaught error or an
 * unhandled promise rejection is logged to `console` (the debug console's
 * history); the browser still reports it as before. Installing twice (a
 * fast refresh) keeps one pair of listeners.
 */
export function captureUnhandledErrors(
  console: Console,
  target: ErrorEventTarget = window
): void {
  if (installedOn.has(target)) return
  installedOn.add(target)
  target.addEventListener("error", (event) => {
    console.error("Uncaught error", event.error ?? event.message)
  })
  target.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled rejection", event.reason)
  })
}
