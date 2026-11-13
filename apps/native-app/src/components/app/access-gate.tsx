import {
  accessLastActivityAtom,
  accessSessionAtom,
} from "@payky/app-shared/access-state"
import { router, usePathname } from "expo-router"
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai"
import {
  type ReactNode,
  type SetStateAction,
  Suspense,
  useEffect,
  useLayoutEffect,
  useState,
} from "react"
import { AppState, StyleSheet, View } from "react-native"
import { evoluCounterAtom } from "../../atoms/evolu-counter.ts"
import {
  endsSessionOnAppState,
  isIdleExpired,
  sessionOutlivesAccount,
} from "../../core/access-session.ts"
import { markGateResolved } from "../../core/first-screen.ts"
import { requiredPermission } from "../../core/route-access.ts"
import { useAccess } from "../../core/use-access.ts"
import { FadeHeader } from "../fade-header.tsx"
import { Screen } from "../screen.tsx"
import { AppLoader } from "./app-loader.tsx"
import { PinScreen } from "./pin-screen.tsx"

// `Date.now()` is branded by Evolu's globals; the shared atom holds a plain number.
const touch = (store: ReturnType<typeof useStore>) => {
  const now: number = Date.now()
  store.set<number, [SetStateAction<number>], void>(accessLastActivityAtom, now)
}

/**
 * Renders the PIN screen instead of a route the device may not open
 * (access/0001), and runs the PIN session's end rules (access/0005).
 */
function Gate({
  onLockedChange,
}: {
  readonly onLockedChange: (locked: boolean) => void
}) {
  const pathname = usePathname()
  const access = useAccess()
  const [sessionState, setSession] = useAtom(accessSessionAtom)
  const permission = requiredPermission(pathname)
  const covered = permission !== null && access.defaults.has(permission)

  // Navigating to a route the device defaults already cover ends the
  // session; a `free` route neither starts nor ends one.
  useEffect(() => {
    if (access.session && covered) setSession(null)
  }, [access.session, covered, setSession])

  // Switching account ends the session: switching back must not revive it.
  useEffect(() => {
    if (!sessionOutlivesAccount(sessionState, access.accountId)) {
      setSession(null)
    }
  }, [access.accountId, sessionState, setSession])

  const locked =
    access.enabled && permission !== null && !access.effective.has(permission)

  // Before paint, so a route this account locks is never drawn.
  useLayoutEffect(() => {
    onLockedChange(locked)
  }, [locked, onLockedChange])

  return (
    <>
      {access.session ? (
        <SessionWatcher sell={access.defaults.has("sell")} />
      ) : null}
      {locked ? (
        <Screen>
          {/* Home has nowhere to go back to (web's gate). */}
          {pathname === "/" ? null : <FadeHeader />}
          <Suspense fallback={null}>
            <PinScreen
              key={`${access.accountId}:${pathname}`}
              permission={permission}
              target={pathname}
              onUnlocked={() => setSession({ accountId: access.accountId })}
            />
          </Suspense>
        </Screen>
      ) : null}
    </>
  )
}

/**
 * Ends the session after five minutes without activity, on any route, and
 * when the app goes to the background (access/0005). A device without `sell`
 * then returns to its PIN screen, which is home's.
 */
function SessionWatcher({ sell }: { readonly sell: boolean }) {
  const store = useStore()
  const setSession = useSetAtom(accessSessionAtom)

  useEffect(() => {
    const end = () => {
      setSession(null)
      if (!sell) router.replace("/")
    }
    // Mounted when the session starts, whichever way it started.
    touch(store)
    const subscription = AppState.addEventListener("change", (state) => {
      if (endsSessionOnAppState(state)) end()
    })
    const interval = setInterval(() => {
      if (isIdleExpired(store.get(accessLastActivityAtom), Date.now())) end()
    }, 5000)
    return () => {
      clearInterval(interval)
      subscription.remove()
    }
  }, [sell, setSession, store])

  return null
}

/** Re-resolves the current path on every render: deep links, back, restores. */
export function AccessGate({ children }: { readonly children: ReactNode }) {
  const store = useStore()
  const setSession = useSetAtom(accessSessionAtom)
  const accountVersion = useAtomValue(evoluCounterAtom)

  // The app Evolu client reloads on an account switch: no session survives it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: accountVersion is the trigger
  useEffect(() => {
    setSession(null)
  }, [accountVersion, setSession])

  // Unknown (null) until the gate first resolves, then kept through an
  // account switch until the next account's rules are read.
  const [locked, setLocked] = useState<boolean | null>(null)

  // The Stack stays mounted and outside every Suspense of the gate: the gate
  // suspends on each account switch, and a navigator hidden behind a fallback
  // unregisters, so Expo Router reseeds the navigation tree and remounts the
  // root layout with a fresh jotai store, losing what the switch handed over
  // (the restored account, the onboarding step). Web's router sits above its
  // gate.
  return (
    <View
      style={{ flex: 1 }}
      // Capture phase, so a tap any child handles still counts as activity;
      // the atom is read with `store.get`, so nothing re-renders.
      onTouchStartCapture={() => {
        touch(store)
      }}
    >
      <View style={{ flex: 1, display: locked === false ? "flex" : "none" }}>
        {children}
      </View>
      {/* Only an account switch shows it: the start keeps the splash on. */}
      <Suspense
        fallback={
          <View style={StyleSheet.absoluteFill}>
            <AppLoader />
          </View>
        }
      >
        <GateResolved />
        <Gate onLockedChange={setLocked} />
      </Suspense>
    </View>
  )
}

/**
 * Tells `first-screen.ts` the gate has what it needs (the account, its
 * database, the access rules): it sits in the same Suspense boundary, so it
 * mounts together with the route or the PIN screen. The splash hides once
 * that route has rendered too.
 */
function GateResolved() {
  useEffect(markGateResolved, [])
  return null
}
