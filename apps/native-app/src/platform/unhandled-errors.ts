import type { Console } from "@evolu/common"

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void

/** React Native's `ErrorUtils`, injected so a test can stand in for it. */
export interface GlobalErrorHandlerHost {
  readonly getGlobalHandler: () => GlobalErrorHandler
  readonly setGlobalHandler: (handler: GlobalErrorHandler) => void
}

const ownHandlers = new WeakSet<GlobalErrorHandler>()

/**
 * Logs an error nothing caught to `console` (the debug console's history),
 * then hands it on to the handler that was there before (React Native's
 * red box or crash, Sentry's when it is on), so nothing else changes. Global
 * `console.*` stays unpatched: the native console output writes to it.
 * Installing twice (a fast refresh) keeps one wrapper.
 */
export function captureUnhandledErrors(
  console: Console,
  host: GlobalErrorHandlerHost = ErrorUtils
): void {
  const previous = host.getGlobalHandler()
  if (ownHandlers.has(previous)) return
  const handler: GlobalErrorHandler = (error, isFatal) => {
    try {
      console.error(isFatal === true ? "Fatal error" : "Uncaught error", error)
    } catch {
      // The previous handler must run whatever happens here.
    }
    previous(error, isFatal)
  }
  ownHandlers.add(handler)
  host.setGlobalHandler(handler)
}
