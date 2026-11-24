import { App as CapacitorApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { brandName } from "@payky/app-shared/brand"
import {
  type ConsoleLogHeader,
  type ConsoleOutputHistoryEntry,
  formatConsoleLog,
  formatConsoleLogExcerpt,
  supportLogMaxBytes,
} from "@payky/app-shared/console-history"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useCallback } from "react"

import { appBrand } from "@/core/app-brand.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { type SavedFileDestination, saveFile } from "@/lib/save-file.ts"

/**
 * What support needs to place a log: the app, its version and build, the
 * platform. The native build number is read ahead, through the same query the
 * About screen uses, so formatting stays synchronous and a clipboard write
 * keeps the click's user activation.
 */
function useConsoleLogHeader(): () => ConsoleLogHeader {
  const isNative = Capacitor.isNativePlatform()
  const { data: build } = useQuery({
    queryKey: ["native", "android-version-code"],
    queryFn: async () => (await CapacitorApp.getInfo()).build,
    enabled: isNative,
    staleTime: Number.POSITIVE_INFINITY,
  })

  return useCallback(
    () => ({
      App: brandName(appBrand),
      Version: __APP_VERSION__,
      ...(isNative && build !== undefined ? { Build: build } : {}),
      Platform: Capacitor.getPlatform(),
      "User agent": navigator.userAgent,
    }),
    [isNative, build]
  )
}

/**
 * Formats entries as the log that leaves the device (copy, export), under
 * `useConsoleLogHeader`'s header. Redacted by `formatConsoleLog`
 * (settings/0006).
 */
export function useFormatConsoleLog(): (
  entries: ReadonlyArray<ConsoleOutputHistoryEntry>
) => string {
  const header = useConsoleLogHeader()
  return useCallback(
    (entries) =>
      formatConsoleLog({
        entries,
        header: {
          ...header(),
          "Exported at": new Date().toISOString(),
          Entries: entries.length,
        },
      }),
    [header]
  )
}

/**
 * Formats entries as a message to support (support/0005): an intro naming how
 * many entries it holds, then the newest that fit in one message, redacted.
 */
export function useFormatSupportLog(): (
  entries: ReadonlyArray<ConsoleOutputHistoryEntry>
) => string {
  const { t } = useTranslation()
  const header = useConsoleLogHeader()
  return useCallback(
    (entries) => {
      const { text, included, total } = formatConsoleLogExcerpt({
        entries,
        header: header(),
        maxBytes: supportLogMaxBytes,
      })
      return [
        t("settings.debugConsole.sendToSupport.message.intro", {
          count: included,
        }),
        ...(included < total
          ? [
              t("settings.debugConsole.sendToSupport.message.truncated", {
                count: included,
                total,
              }),
            ]
          : []),
        "",
        text,
      ].join("\n")
    },
    [header, t]
  )
}

/** Saves `log` as `<brand>-console-yyyyMMdd-HHmmss.txt`; `null` if dismissed. */
export function saveConsoleLog(
  log: string
): Promise<SavedFileDestination | null> {
  return saveFile({
    filename: `${appBrand.id}-console-${format(new Date(), "yyyyMMdd-HHmmss")}.txt`,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode(log),
    cacheDirectory: "console-export",
  })
}
