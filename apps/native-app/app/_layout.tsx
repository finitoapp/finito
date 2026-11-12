import { QueryClientProvider } from "@tanstack/react-query"
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  usePathname,
} from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { createStore, Provider } from "jotai"
import { type ComponentType, Suspense, useEffect, useState } from "react"
import { useColorScheme, useWindowDimensions } from "react-native"
import { TamaguiProvider, Theme, useTheme, View, XStack } from "tamagui"
import { AccessGate } from "../src/components/app/access-gate.tsx"
import {
  AppEvoluConsumers,
  CashuEvoluConsumers,
} from "../src/components/app/app-background-jobs.tsx"
import { AppErrorScreen } from "../src/components/app/app-error-screen.tsx"
import { AppLoader } from "../src/components/app/app-loader.tsx"
import { AppMigrations } from "../src/components/app/app-migrations.tsx"
import { ConfirmHost } from "../src/components/app/confirm-host.tsx"
import { DemoDataSeed } from "../src/components/app/demo-data-seed.tsx"
import { DeviceRegistration } from "../src/components/app/device-registration.tsx"
import { EvoluStartupError } from "../src/components/app/evolu-startup-error.tsx"
import { NotOnboardedRedirect } from "../src/components/app/not-onboarded-redirect.tsx"
import { PinPromptHost } from "../src/components/app/pin-prompt-host.tsx"
import { SentryController } from "../src/components/app/sentry-controller.tsx"
import { SwitchioRestoredClosure } from "../src/components/app/switchio-restored-closure.tsx"
import { SwitchioRestoredRefund } from "../src/components/app/switchio-restored-refund.tsx"
import { SwitchioRestoredResult } from "../src/components/app/switchio-restored-result.tsx"
import { ToastHost } from "../src/components/app/toast-host.tsx"
import {
  MenuBar,
  MenuNav,
  menuSidebarMinWidth,
  menuSidebarWidth,
} from "../src/components/menu-nav.tsx"
import { paneGap, WebColumn } from "../src/components/web-column.tsx"
import {
  routeFallbackMounted,
  routeFallbackUnmounted,
  useIdleAfterFirstScreen,
} from "../src/core/first-screen.ts"
import { MasterPaneContext } from "../src/core/master-pane.ts"
import { menuDetailRootOf, menuPositionOf } from "../src/core/menu-routes.ts"
import { queryClient } from "../src/core/query-client.ts"
import { resolveTheme } from "../src/core/theme-preference.ts"
import { ActivityLayout } from "../src/features/activity/activity-layout.tsx"
import { BillHistoryPage } from "../src/features/activity/bill-history-page.tsx"
import { PaymentHistoryPage } from "../src/features/activity/payment-history-page.tsx"
import { removeStaleExportFolders } from "../src/features/settings/evolu-export/evolu-export-io"
import { SettingsPage } from "../src/features/settings/settings-page.tsx"
import { EetSandboxBanner } from "../src/features/shared/eet-sandbox-banner.tsx"
import { useThemePreference } from "../src/hooks/use-theme-preference.ts"
import { setBrowserThemeColor } from "../src/platform/browser-theme-color"
import { WindowSafeArea } from "../src/platform/window-safe-area"
import { tamaguiConfig } from "../tamagui.config.ts"

// Kept until the first screen is ready (src/core/first-screen.ts) instead
// of Expo Router hiding it as soon as this layout renders, so the start
// shows the splash's logo throughout rather than loaders in turn.
void SplashScreen.preventAutoHideAsync()
// Android fades it out with an accelerating curve, by default over 400 ms:
// most of the fade comes at the end, so the ready screen sat behind a
// lingering logo. 150 ms still reads as a fade.
SplashScreen.setOptions({ duration: 150 })

/**
 * Expo Router's fallback for a route that suspends, empty on the navigator's
 * background as its default is. It also tells `first-screen.ts` a route is
 * still on its way, so the splash waits for it.
 */
export function SuspenseFallback() {
  useEffect(() => {
    routeFallbackMounted()
    return routeFallbackUnmounted
  }, [])
  return null
}

/**
 * Expo Router's root error boundary. `retry` remounts this layout, whose
 * fresh jotai store recreates the app Evolu client, which is what web's
 * "try again" does with `reloadAppEvoluAtom`; a device-database failure
 * would fail again, as on web.
 */
export function ErrorBoundary({
  error,
  retry,
}: {
  readonly error: Error
  readonly retry: () => void
}) {
  return <AppErrorScreen error={error} retry={retry} />
}

export default function RootLayout() {
  const [store] = useState(createStore)
  // Once per process: clear Evolu export files an earlier run left in the cache.
  useEffect(() => {
    try {
      removeStaleExportFolders()
    } catch {
      // Best effort; the next export clears them too.
    }
  }, [])

  return (
    <WindowSafeArea>
      <Provider store={store}>
        <EvoluStartupError />
        <Suspense fallback={<AppLoader />}>
          <ThemedApp />
        </Suspense>
      </Provider>
    </WindowSafeArea>
  )
}

/**
 * Everything under the Tamagui theme, which follows the device theme
 * preference (settings): `system` the OS scheme, light/dark forced. The
 * preference lives in the device database, so this suspends until it is
 * open; `AppLoader` covers that wait on the system scheme's background.
 */
function ThemedApp() {
  const preference = useThemePreference()
  const systemScheme = useColorScheme()
  const theme = resolveTheme(preference, systemScheme)
  useEffect(() => {
    setBrowserThemeColor(theme)
  }, [theme])
  // App jobs first, the Cashu one after, each once the screen is left alone.
  const appJobsMayStart = useIdleAfterFirstScreen(1500)
  const cashuJobsMayStart = useIdleAfterFirstScreen(3000)

  return (
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
        <Theme name={theme}>
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
          <AccessGate>
            <ThemedStack dark={theme === "dark"} />
          </AccessGate>
          {/* After the first screen and a pause in tapping: their start blocks the JS thread. */}
          {appJobsMayStart ? <AppEvoluConsumers /> : null}
          {cashuJobsMayStart ? <CashuEvoluConsumers /> : null}
          <ConfirmHost />
          <PinPromptHost />
          <ToastHost />
          {/* Its own boundary: the pending check suspends on every account switch. */}
          <Suspense fallback={null}>
            <AppMigrations />
          </Suspense>
          <Suspense fallback={null}>
            <NotOnboardedRedirect />
          </Suspense>
          <Suspense fallback={null}>
            <SentryController />
            <DeviceRegistration />
            <DemoDataSeed />
            <SwitchioRestoredResult />
            <SwitchioRestoredClosure />
            <SwitchioRestoredRefund />
          </Suspense>
        </Theme>
      </TamaguiProvider>
    </QueryClientProvider>
  )
}

/**
 * The root screens a wide window draws beside their details
 * (navigation/0002), by the path `menuDetailRootOf` names: the same page
 * components the routes render, mounted a second time left of the stack.
 */
const masterPages: Readonly<Record<string, ComponentType>> = {
  // Under the header and tabs `app/activity/(tabs)` draws around them.
  "/activity": () => (
    <ActivityLayout>
      <PaymentHistoryPage />
    </ActivityLayout>
  ),
  "/activity/bills": () => (
    <ActivityLayout>
      <BillHistoryPage />
    </ActivityLayout>
  ),
  "/settings": SettingsPage,
}

/**
 * The navigator on the app's theme. React Navigation draws screens and their
 * transitions on its own theme's background, light grey by default, so a
 * route that suspends on its first open (rendering nothing until its data is
 * there) showed that grey meanwhile: a white flash, most visible in dark.
 */
function ThemedStack({ dark }: { readonly dark: boolean }) {
  const theme = useTheme()
  const base = dark ? DarkTheme : DefaultTheme
  const background = theme.background.val
  // The tabs (navigation/0001, navigation/0002): the rail on every screen of
  // them on a large window, the terminal's included; the bottom bar on a
  // menu tab's root screen otherwise (home keeps its hamburger).
  const pathname = usePathname()
  const menu = menuPositionOf(pathname)
  const wide = useWindowDimensions().width >= menuSidebarMinWidth
  const sidebar = menu !== undefined && wide
  const bar = menu?.root === true && menu.tab !== "terminal" && !wide
  // A detail screen on a wide window sits right of the root it was opened
  // from, as Linky's desktop split view. The stack keeps its place in the
  // tree either way, so navigation state survives the window resizing.
  const masterPath = wide ? menuDetailRootOf(pathname) : undefined
  const MasterPage =
    masterPath === undefined ? undefined : masterPages[masterPath]
  const panes = MasterPage !== undefined
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background, card: background },
      }}
    >
      <View flex={1} bg="background">
        <XStack flex={1}>
          {sidebar ? <MenuNav active={menu.tab} variant="sidebar" /> : null}
          <View flex={1}>
            <WebColumn
              reservedWidth={sidebar ? menuSidebarWidth : 0}
              panes={panes}
            >
              <View flex={1}>
                {/* Its own boundary: the EET settings query suspends on an account switch. */}
                <Suspense fallback={null}>
                  <EetSandboxBanner />
                </Suspense>
                <XStack flex={1} gap={panes ? paneGap : 0}>
                  {MasterPage === undefined ? null : (
                    <View flex={0.88} minW={0}>
                      <MasterPaneContext value={masterPath ?? null}>
                        {/* Its own boundary: the root's queries must not blank the detail. */}
                        <Suspense fallback={null}>
                          <MasterPage />
                        </Suspense>
                      </MasterPaneContext>
                    </View>
                  )}
                  <View flex={panes ? 1.12 : 1} minW={0}>
                    <Stack screenOptions={{ headerShown: false }} />
                  </View>
                </XStack>
              </View>
            </WebColumn>
          </View>
        </XStack>
        {wide ? null : <MenuBar tab={bar ? menu.tab : undefined} />}
      </View>
    </ThemeProvider>
  )
}
