import { scrubBreadcrumb, scrubEvent } from "@payky/app-shared/error-scrubbing"
import * as Sentry from "@sentry/react-native"
import Constants from "expo-constants"
import { appBrand } from "./app-brand.ts"
import { nativeEnv } from "./native-env.ts"

/**
 * Native twin of `apps/web-app/src/core/sentry.ts`: opt-in per device
 * (`errorReportingEnabled`), driven by `SentryController`, scrubbed by the
 * policy in `@payky/app-shared/error-scrubbing`.
 *
 * Nothing of the SDK runs before consent: `Sentry.init` is the only thing
 * that starts it (the library's manifest sets `io.sentry.auto-init=false`, so
 * the native SDK and its crash handler are not started at launch), and this
 * module calls it only from `enableErrorReporting`. Importing the package
 * installs nothing that captures. Switching the setting off calls
 * `Sentry.close()`.
 *
 * Report unexpected crashes only. Sanctioned call sites: `ErrorBoundary` in
 * `app/_layout.tsx`, and `AppEvoluConsumersBoundary` in
 * `src/components/app-background-jobs.tsx`, around the background consumers
 * of the app Evolu client (one instance for the FIO/Spark/EET jobs, a second
 * for the Cashu job). Never pair it with a toast for a handled failure.
 */
const dsn = nativeEnv.EXPO_PUBLIC_SENTRY_DSN

let enabled = false

export function isErrorReportingAvailable(): boolean {
  return dsn !== undefined
}

export function enableErrorReporting(): void {
  if (enabled || !isErrorReportingAvailable()) {
    return
  }

  Sentry.init({
    dsn,
    release: Constants.expoConfig?.version,
    environment: __DEV__ ? "development" : "production",
    // One Sentry project for both apps (brand/0001); the tag tells them apart.
    initialScope: { tags: { brand: appBrand.id } },
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  })

  enabled = true
}

export function disableErrorReporting(): void {
  if (!enabled) {
    return
  }

  enabled = false
  void Sentry.close()
}

export function captureReportedError(
  error: unknown,
  componentStack?: string
): void {
  if (!enabled) {
    return
  }

  Sentry.captureException(
    error,
    componentStack === undefined
      ? undefined
      : { contexts: { react: { componentStack } } }
  )
}
