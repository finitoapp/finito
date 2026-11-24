import { useEffect } from "react"

import { useConsole } from "@/hooks/use-console.ts"

/**
 * Logs uncaught errors and unhandled promise rejections to the app console,
 * so the Debug Console shows them beside what the app logged itself. Reports
 * nothing to Sentry (its two call sites stay as they are), and leaves the
 * global `console` alone: the native console output writes there, so
 * patching it would loop.
 */
export function UnhandledErrorsToConsole() {
  const appConsole = useConsole()

  useEffect(() => {
    const unhandled = appConsole.child("unhandled")
    const onError = (event: ErrorEvent) => {
      unhandled.error(event.error ?? event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      unhandled.error("Unhandled rejection:", event.reason)
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [appConsole])

  return null
}
