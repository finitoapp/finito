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
import { Suspense, useEffect, useState } from "react"
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
import { SwitchioRestoredResult } from "../src/components/app/switchio-restored-result.tsx"
import { ToastHost } from "../src/components/app/toast-host.tsx"
import {
  MenuNav,
  menuSidebarMinWidth,
  menuSidebarWidth,
} from "../src/components/menu-nav.tsx"
import { WebColumn } from "../src/components/web-column.tsx"
import {
  routeFallbackMounted,
  routeFallbackUnmounted,
  useIdleAfterFirstScreen,
} from "../src/core/first-screen.ts"
import { menuPositionOf } from "../src/core/menu-routes.ts"
import { queryClient } from "../src/core/query-client.ts"
import { resolveTheme } from "../src/core/theme-preference.ts"
import { removeStaleExportFolders } from "../src/features/settings/evolu-export/evolu-export-io"
import { EetSandboxBanner } from "../src/features/shared/eet-sandbox-banner.tsx"
import { useThemePreference } from "../src/hooks/use-theme-preference.ts"
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
    <Provider store={store}>
      <EvoluStartupError />
      <Suspense fallback={<AppLoader />}>
        <ThemedApp />
      </Suspense>
    </Provider>
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
          </Suspense>
        </Theme>
      </TamaguiProvider>
    </QueryClientProvider>
  )
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
  // The menu section (navigation/0001): the sidebar on every screen of it on
  // a large window, the bottom bar on a tab's root screen otherwise.
  const menu = menuPositionOf(usePathname())
  const wide = useWindowDimensions().width >= menuSidebarMinWidth
  const sidebar = menu !== undefined && wide
  const bar = menu?.root === true && !wide
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
            <WebColumn reservedWidth={sidebar ? menuSidebarWidth : 0}>
              <View flex={1}>
                {/* Its own boundary: the EET settings query suspends on an account switch. */}
                <Suspense fallback={null}>
                  <EetSandboxBanner />
                </Suspense>
                <View flex={1}>
                  <Stack screenOptions={{ headerShown: false }} />
                </View>
              </View>
            </WebColumn>
          </View>
        </XStack>
        {bar ? <MenuNav active={menu.tab} variant="bar" /> : null}
      </View>
    </ThemeProvider>
  )
}
