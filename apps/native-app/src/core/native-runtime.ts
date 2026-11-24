import {
  createConsole,
  createMultiOutput,
  createNativeConsoleOutput,
} from "@evolu/common"
import { createConsoleOutputHistory } from "@payky/app-shared/console-history"
import {
  createEvoluDeps,
  createRun,
  lockManager,
} from "../platform/evolu-runtime"

/**
 * The native composition root's app-lifetime run and its one lock authority.
 * Evolu's React Native lock manager is in-memory, which is sound only while
 * the app has a single JS runtime: a headless task or worker would need its
 * own review before it may write.
 */
/** The last 1000 console entries, in memory only, for the debug console screen. */
export const nativeConsoleHistory = createConsoleOutputHistory({ limit: 1000 })

export const nativeConsole = createConsole({
  // Debug output names owners and relays; a release build logs warnings only.
  level: __DEV__ ? "debug" : "warn",
  output: createMultiOutput([
    createNativeConsoleOutput(),
    nativeConsoleHistory,
  ]),
})

/** Errors nothing caught: the global handler's and the root error screen's. */
export const unhandledConsole = nativeConsole.child("unhandled")

export const nativeRun = createRun({
  ...createEvoluDeps({ console: nativeConsole }),
  lockManager,
})

/**
 * Runs on the device (Hermes) to prove that the lock authority serializes
 * contenders, `ifAvailable` sees a held lock, and `await using` disposes.
 */
export async function checkLockAuthority(): Promise<void> {
  const events: string[] = []
  let disposed = false
  {
    await using stack = new AsyncDisposableStack()
    stack.defer(() => {
      disposed = true
    })
    await Promise.all([
      lockManager.request("payky-native-check", async () => {
        events.push("first started")
        const contended = await lockManager.request(
          "payky-native-check",
          { ifAvailable: true },
          (lock) => lock
        )
        events.push(contended === null ? "held" : "not held")
        events.push("first finished")
      }),
      lockManager.request("payky-native-check", () => {
        events.push("second started")
      }),
    ])
  }
  const expected = "first started,held,first finished,second started"
  if (events.join() !== expected || !disposed)
    throw new Error(`Lock authority check failed: ${events.join()}`)
}
