import { scrubBreadcrumb, scrubEvent } from "@payky/app-shared/error-scrubbing"
import * as Sentry from "@sentry/react"
import { appBrand } from "@/core/app-brand.ts"
import { appEnv } from "@/core/app-env.ts"

const dsn = appEnv.VITE_SENTRY_DSN

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
    release: __APP_VERSION__,
    environment: import.meta.env.MODE,
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
