import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createTranslate } from "@payky/app-shared/i18n/translate"
import { getPreferredDeviceLanguage } from "@payky/core/modules/device/device-utils"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useSetAtom } from "jotai"
import { AlertTriangleIcon, ChevronDownIcon, CopyIcon } from "lucide-react"
import * as React from "react"
import { reloadAppEvoluAtom } from "@/atoms/evolu-counter.ts"
import { AppLoaderCleanup } from "@/components/app/app-loader-cleanup.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import { appBrand } from "@/core/app-brand.ts"
import { captureReportedError } from "@/core/sentry.ts"

/**
 * Deliberately does not use `useTranslation()`/`useDeviceSettings()`: those
 * suspend on device Evolu, and this component is the error fallback for a
 * crash that may originate in device-Evolu init itself. A synchronous,
 * best-effort lookup keeps the recovery UI rendering even then, degrading to
 * English if anything here goes wrong.
 */
function t(key: TranslationKey): string {
  try {
    const language = getPreferredDeviceLanguage(navigator.language)
    return createTranslate(language, appBrand)(key)
  } catch {
    return createTranslate("en", appBrand)(key)
  }
}

type CopyState = "idle" | "copied" | "failed"

const copyLabelKeys = {
  idle: "appError.copy",
  copied: "appError.copied",
  failed: "appError.copyFailed",
} satisfies Record<CopyState, TranslationKey>

export function AppErrorBoundary({
  error,
  info,
  reset,
}: ErrorComponentProps<unknown>) {
  const detail = formatErrorDetail(error, info?.componentStack)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const [copyState, setCopyState] = React.useState<CopyState>("idle")
  const [repairing, setRepairing] = React.useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: report once per caught error, not on every componentStack identity change
  React.useEffect(() => {
    captureReportedError(error, info?.componentStack)
  }, [error])
  const errorName = error instanceof Error ? error.name : t("appError.unknown")
  const errorMessage =
    error instanceof Error ? error.message : t("appError.nonError")

  const tryAgain = () => {
    // Recreates the app Evolu client on the way out. Jotai caches the
    // rejected promise of an async atom, so a bare `reset` would re-read the
    // same failure; bumping the counter invalidates `activeAccountRowAtom`
    // and with it `accountAtom`/`evoluAtom`, which is what makes a retry
    // able to succeed at all. `deviceEvoluAtom` does not depend on the
    // counter, so a device-database failure still needs a full reload.
    reloadAppEvolu()
    reset()
  }

  const copyDetail = async () => {
    try {
      await navigator.clipboard.writeText(
        `Payky ${__APP_VERSION__}\n${errorName}: ${errorMessage}\n\n${detail}`
      )
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  /**
   * The failure mode this exists for: a released build whose index.html is
   * served from the service worker's cache while the hashed chunk or worker
   * it asks for is already gone, so the app cannot boot at all and every
   * plain reload hits the same cache. Only rendered where there is a cache
   * to clear — a Capacitor WebView has neither.
   */
  const repairAndReload = async () => {
    setRepairing(true)
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations.map((registration) => registration.unregister())
      )
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    } finally {
      window.location.reload()
    }
  }

  const canRepair = "serviceWorker" in navigator && "caches" in window

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-8">
      {/*
       * index.html's boot spinner covers the whole viewport at the top of
       * the stacking order, and it is only removed once the real app
       * mounts — which never happened if this card is standing in for a
       * crash during boot. Idempotent when the spinner is already gone.
       */}
      <AppLoaderCleanup />
      <Card className="w-full max-w-2xl border-destructive/30 bg-card/95 shadow-xl">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>{t("appError.title")}</CardTitle>
          <CardDescription>{t("appError.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="font-medium text-muted-foreground">
              {t("appError.name")}
            </dt>
            <dd className="break-words font-mono">{errorName}</dd>
            <dt className="font-medium text-muted-foreground">
              {t("appError.message")}
            </dt>
            <dd className="break-words font-mono">{errorMessage}</dd>
            <dt className="font-medium text-muted-foreground">
              {t("appError.version")}
            </dt>
            <dd className="break-words font-mono">{__APP_VERSION__}</dd>
          </dl>
          <Collapsible className="flex flex-col gap-2">
            <CollapsibleTrigger
              render={
                <Button
                  className="group/error-detail-trigger w-full justify-between"
                  variant="outline"
                />
              }
            >
              {t("appError.details")}
              <ChevronDownIcon
                data-icon="inline-end"
                className="transition-transform group-data-[panel-open]/error-detail-trigger:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent keepMounted>
              <pre className="max-h-[50svh] overflow-auto rounded-lg border bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                {detail}
              </pre>
            </CollapsibleContent>
          </Collapsible>
          <Button
            className="self-start"
            variant="ghost"
            size="sm"
            onClick={() => {
              void copyDetail()
            }}
          >
            <CopyIcon data-icon="inline-start" aria-hidden="true" />
            {t(copyLabelKeys[copyState])}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={tryAgain}>
            {t("appError.tryAgain")}
          </Button>
          {canRepair ? (
            <Button
              variant="outline"
              disabled={repairing}
              onClick={() => {
                void repairAndReload()
              }}
            >
              {t("appError.repair")}
            </Button>
          ) : null}
          <Button onClick={() => window.location.reload()}>
            {t("appError.reload")}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

function formatErrorDetail(
  error: unknown,
  componentStack: string | undefined
): string {
  const errorDetail =
    error instanceof Error
      ? [error.stack, error.message, error.name].find(
          (value) => value && value.trim().length > 0
        )
      : stringifyUnknown(error)

  return [errorDetail, componentStack]
    .filter((value): value is string => Boolean(value))
    .join("\n\nComponent stack:\n")
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}
