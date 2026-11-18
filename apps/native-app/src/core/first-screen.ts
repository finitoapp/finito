import { accessLastActivityAtom } from "@payky/app-shared/access-state"
import * as SplashScreen from "expo-splash-screen"
import { useStore } from "jotai"
import { useEffect, useState, useSyncExternalStore } from "react"

/**
 * When the first screen is really on: `AccessGate` has resolved (account,
 * databases, access rules) and no route is still behind its Suspense
 * fallback, the root layout's `SuspenseFallback`. Then the native splash,
 * which the root layout holds, hides straight onto that screen rather than
 * onto an empty background, and the background jobs may start once the
 * user pauses (`useIdleAfterFirstScreen`): before it, their key derivations
 * and the Spark SDK's start held the first screen up.
 *
 * Module state, as the splash it drives is once per process: an account
 * switch or an error-screen retry does not show it again.
 */

/** A first screen that never settles still gets the splash out of the way. */
const SAFETY_TIMEOUT_MS = 10_000

/**
 * The same from the moment the app loads, for a start that never reaches the
 * gate at all (a database that does not open): the splash must not stay up
 * for good whatever hangs before it.
 */
const STARTUP_SAFETY_TIMEOUT_MS = 20_000

let gateResolved = false
let routesWaiting = 0
let ready = false
const listeners = new Set<() => void>()

const settle = () => {
  if (ready || !gateResolved || routesWaiting > 0) return
  ready = true
  SplashScreen.hide()
  for (const listener of listeners) listener()
}

/** `AccessGate` has what it needs; its route, or the PIN screen, is rendering. */
export const markGateResolved = (): void => {
  if (gateResolved) return
  gateResolved = true
  // A route that suspended in this same commit mounts its fallback in this
  // commit's effects, so it is counted by the next frame.
  requestAnimationFrame(settle)
  setTimeout(markFirstScreenReady, SAFETY_TIMEOUT_MS)
}

/** The root layout's route `SuspenseFallback` mounted. */
export const routeFallbackMounted = (): void => {
  routesWaiting += 1
}

/** The route behind that fallback rendered. */
export const routeFallbackUnmounted = (): void => {
  routesWaiting -= 1
  settle()
}

/** Ready now, whatever is still pending: the error screen, the timeout. */
export const markFirstScreenReady = (): void => {
  gateResolved = true
  routesWaiting = 0
  settle()
}

setTimeout(markFirstScreenReady, STARTUP_SAFETY_TIMEOUT_MS)

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** `useFirstScreenReady` outside render, read once. */
export const isFirstScreenReady = (): boolean => ready

export const useFirstScreenReady = (): boolean =>
  useSyncExternalStore(subscribe, () => ready)

/** How long a background start may wait for the user to pause tapping. */
const MAX_IDLE_WAIT_MS = 15_000

/**
 * True once the first screen is on and nobody has touched it for `idleMs`
 * (the last touch is the one `AccessGate` records), or `MAX_IDLE_WAIT_MS`
 * after the first screen at the latest. Background jobs block the JS thread
 * while they start (Spark's SDK for seconds), which a merchant typing an
 * amount right after the start would feel as dropped keys; different
 * `idleMs` stagger the jobs, so they do not all start in one stall.
 */
export function useIdleAfterFirstScreen(idleMs: number): boolean {
  const firstScreenReady = useFirstScreenReady()
  const store = useStore()
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!firstScreenReady || idle) return
    const readyAt = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      const lastActivity = Math.max(store.get(accessLastActivityAtom), readyAt)
      if (now - lastActivity >= idleMs || now - readyAt >= MAX_IDLE_WAIT_MS) {
        setIdle(true)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [firstScreenReady, idle, idleMs, store])

  return idle
}
