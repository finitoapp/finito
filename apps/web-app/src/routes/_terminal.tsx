import { useTimeout } from "@dedalik/use-react"
import {
  initialSyncIdleLimitMs,
  isInitialSyncPending,
} from "@payky/core/evolu/initial-sync-state"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import {
  landingPaths,
  preferredLandingLanguage,
  readInstallLanguage,
  readLandingRedirectEnvironment,
  shouldRedirectToLanding,
} from "@payky/web-shared/landing-redirect"
import {
  createFileRoute,
  Outlet,
  type StaticDataRouteOption,
  useMatches,
  useNavigate,
} from "@tanstack/react-router"
import { LoaderCircleIcon } from "lucide-react"
import { Suspense, useEffect, useState } from "react"
import { AccessGate } from "@/components/app/access-gate.tsx"
import { MenuOrderAnnouncer } from "@/components/app/menu-order-announcer.tsx"
import { MenuNav } from "@/components/menu-nav.tsx"
import { PhoneViewport } from "@/components/phone-viewport.tsx"
import { EetSandboxBanner } from "@/features/shared/eet-sandbox-banner.tsx"
import { useEetSettings } from "@/features/shared/use-eet-settings.ts"
import { useAppOwnerSyncState } from "@/hooks/use-app-owner-sync-state.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/**
 * The viewport padding nearly every terminal screen uses. A route declares
 * `terminalLayout.viewportClassName` only to differ from it.
 */
const defaultViewportClassName = "px-3 py-6"

export const Route = createFileRoute("/_terminal")({
  component: TerminalLayout,
  staticData: { access: "free" },
})

function TerminalLayout() {
  const { data } = useEvoluQuery(settingsQuery)
  const [settings] = data
  const { isSandboxActive } = useEetSettings()
  const terminalLayout = useMatches({
    select: (matches) => deepestStaticData(matches, "terminalLayout"),
  })
  const menu = useMatches({
    select: (matches) => deepestStaticData(matches, "menu"),
  })
  // The appSettings row's existence marks the account as onboarded.
  const onboarded = settings !== undefined

  if (!onboarded) {
    return <NotOnboarded />
  }

  return (
    <main
      className={cn(
        "min-h-svh bg-background text-foreground",
        isSandboxActive && "[--terminal-banner-height:2.5rem]",
        // The room the menu takes (navigation/0001): the phone's bottom bar on
        // a tab's root screen, the sidebar on every screen of a large monitor.
        menu?.root && "[--menu-nav-height:3rem] lg:[--menu-nav-height:0px]",
        menu && "lg:[--menu-sidebar-width:14rem]",
        terminalLayout?.mainClassName
      )}
    >
      {isSandboxActive ? <EetSandboxBanner /> : null}
      {menu ? <MenuNav active={menu.tab} root={menu.root === true} /> : null}
      <Suspense fallback={null}>
        <MenuOrderAnnouncer />
      </Suspense>
      <PhoneViewport
        className={
          terminalLayout?.viewportClassName ?? defaultViewportClassName
        }
      >
        <AccessGate>
          <Outlet />
        </AccessGate>
      </PhoneViewport>
    </main>
  )
}

/** The `staticData` field the deepest matched route declares. */
const deepestStaticData = <Key extends "terminalLayout" | "menu">(
  matches: ReadonlyArray<{ readonly staticData: StaticDataRouteOption }>,
  key: Key
): StaticDataRouteOption[Key] => {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const value = matches[index]?.staticData[key]

    if (value) {
      return value
    }
  }

  return undefined
}

/**
 * A missing appSettings row means nothing while the account's first sync is
 * still transferring (a restored account reopened mid-sync), so this waits
 * for that before sending the account to onboarding (or, in a browser tab
 * that never opened the app, to the landing page — landing/0001), where finishing would
 * overwrite the synced settings via last-write-wins. Kept out of
 * `TerminalLayout` so an onboarded terminal never re-renders on sync-state
 * snapshots.
 */
function NotOnboarded() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const owner = useAppOwnerSyncState()
  // Before the shared worker reports the owner there is nothing to go on;
  // don't wait for it forever.
  const [ownerTimedOut, setOwnerTimedOut] = useState(false)
  useTimeout(
    () => {
      setOwnerTimedOut(true)
    },
    owner === null ? initialSyncIdleLimitMs : null
  )
  const waitingForSync =
    owner === null ? !ownerTimedOut : isInitialSyncPending(owner)

  useEffect(() => {
    if (!waitingForSync) {
      const environment = readLandingRedirectEnvironment()
      if (shouldRedirectToLanding(environment)) {
        // Another document: the landing page is prerendered (landing/0002).
        window.location.replace(landingPaths[preferredLandingLanguage()])
      } else {
        // An app installed from the landing page starts in its language
        // (landing/0005).
        const lang = environment.installedPwa
          ? readInstallLanguage()
          : undefined
        void navigate({ to: "/onboarding", search: { lang }, replace: true })
      }
    }
  }, [navigate, waitingForSync])

  return waitingForSync ? (
    <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
      <LoaderCircleIcon
        className="size-8 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <span className="sr-only" aria-live="polite">
        {t("accountRestore.syncing")}
      </span>
    </main>
  ) : null
}
