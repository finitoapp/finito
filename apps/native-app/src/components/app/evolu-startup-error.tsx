import { useSyncExternalStore } from "react"
import { evoluErrorToError } from "../../core/evolu-error.ts"
import { useFirstScreenReady } from "../../core/first-screen.ts"
import { nativeRun } from "../../core/native-runtime.ts"

const { evoluError } = nativeRun.deps

/**
 * Throws an Evolu error reported before the first screen into the root error
 * boundary. Evolu reports a database that fails to open (a native SQLite
 * that cannot load, say) to its error store rather than rejecting, and the
 * queries the start waits on then never settle: without this, the splash the
 * root layout holds stayed up for good instead of the error screen.
 */
export function EvoluStartupError() {
  const error = useSyncExternalStore(evoluError.subscribe, evoluError.get)
  const firstScreenReady = useFirstScreenReady()
  if (error !== null && !firstScreenReady) throw evoluErrorToError(error)
  return null
}
