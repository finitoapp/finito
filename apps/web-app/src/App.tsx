import { QueryClientProvider } from "@tanstack/react-query"
import { CatchBoundary, RouterProvider } from "@tanstack/react-router"
import { Provider } from "jotai"
import { LoaderCircleIcon } from "lucide-react"
import { Suspense, useEffect } from "react"
import { jotaiStore } from "@/atoms/store.ts"
import { AccountShareRequestHost } from "@/components/app/account-share-request-host.tsx"
import {
  AppBackgroundJobs,
  CashuBackgroundJobs,
} from "@/components/app/app-background-jobs.tsx"
import { AppLoaderCleanup } from "@/components/app/app-loader-cleanup.tsx"
import { AppMigrations } from "@/components/app/app-migrations.tsx"
import { ConfirmDialogHost } from "@/components/app/confirm-dialog-host.tsx"
import { DemoDataSeed } from "@/components/app/demo-data-seed.tsx"
import { DeviceRegistration } from "@/components/app/device-registration.tsx"
import { E2eTestBridge } from "@/components/app/e2e-test-bridge.tsx"
import { AppErrorBoundary } from "@/components/app/error-boundary.tsx"
import { NativeBackButtonHandler } from "@/components/app/native-back-button-handler.tsx"
import { PinPromptHost } from "@/components/app/pin-prompt-host.tsx"
import { PwaUpdateToast } from "@/components/app/pwa-update-toast.tsx"
import { SentryController } from "@/components/app/sentry-controller.tsx"
import { SwitchioRestoredResult } from "@/components/app/switchio-restored-result.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner.tsx"
import { queryClient } from "@/core/query-client.ts"
import { captureReportedError } from "@/core/sentry.ts"
import { router } from "@/router.tsx"

/**
 * Renders before `ThemeProvider` has mounted (it's suspended in the same
 * boundary). The `dark` class it would normally apply is already set by
 * index.html's bootstrap script (synchronously, before first paint, from the
 * cached theme hint), so these theme-aware classes resolve correctly here too.
 */
function AppLoadingFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <LoaderCircleIcon
        className="size-8 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * Renders nothing: a broken app Evolu client already shows up on the screens
 * that need it, and the shell has to keep working without background sync.
 * Still reported, so it cannot vanish silently.
 */
function AppEvoluConsumersFailed({ error }: { readonly error: unknown }) {
  useEffect(() => {
    captureReportedError(error)
  }, [error])

  return null
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={jotaiStore}>
        {/*
         * Sits above the Suspense boundary, so it also catches what the
         * components below suspend on: device Evolu (`ThemeProvider`), the
         * active account and app Evolu (`AppBackgroundJobs`). Those reads
         * happen outside the router, so the root route's own
         * `errorComponent` never saw them — a failing one threw with no
         * boundary above it, React unmounted the root, and the app was left
         * showing index.html's boot spinner forever (or a blank page, once
         * the spinner had already been removed).
         */}
        <CatchBoundary
          getResetKey={() => "app"}
          errorComponent={AppErrorBoundary}
        >
          <Suspense fallback={<AppLoadingFallback />}>
            <AppLoaderCleanup />
            <ThemeProvider disableTransitionOnChange>
              <SentryController />
              <NativeBackButtonHandler />
              {/*
               * Isolated, because both read the active account's app Evolu
               * client: one that throws would otherwise take the shell
               * down with it, and one that never finishes opening would
               * suspend the shell forever. Both of these are best-effort;
               * losing them costs sync, not the UI.
               */}
              <CatchBoundary
                getResetKey={() => "app-evolu-consumers"}
                errorComponent={AppEvoluConsumersFailed}
              >
                <Suspense fallback={null}>
                  {/*
                   * Background jobs start behind the migrations, so no job
                   * ever reads a half-migrated database. The test bridge
                   * stays outside: it is how a test seeds the database in
                   * the first place.
                   */}
                  <AppMigrations>
                    <DemoDataSeed />
                    <AppBackgroundJobs />
                    <SwitchioRestoredResult />
                    <AccountShareRequestHost />
                    <DeviceRegistration />
                    {/*
                     * The Cashu job waits on and can fail with the shared
                     * Cashu wallet alone: under its own boundary and
                     * Suspense, it holds up nothing beside it.
                     */}
                    <CatchBoundary
                      getResetKey={() => "cashu-background-jobs"}
                      errorComponent={AppEvoluConsumersFailed}
                    >
                      <Suspense fallback={null}>
                        <CashuBackgroundJobs />
                      </Suspense>
                    </CatchBoundary>
                  </AppMigrations>
                  <E2eTestBridge />
                </Suspense>
              </CatchBoundary>
              <RouterProvider router={router} />
              <PwaUpdateToast />
              <Toaster />
              <ConfirmDialogHost />
              <PinPromptHost />
            </ThemeProvider>
          </Suspense>
        </CatchBoundary>
      </Provider>
    </QueryClientProvider>
  )
}
