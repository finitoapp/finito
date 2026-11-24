import { brandName } from "@payky/app-shared/brand"
import {
  type ConsoleLogHeader,
  type ConsoleOutputHistoryEntry,
  formatConsoleLog,
  formatConsoleLogExcerpt,
  supportLogMaxBytes,
} from "@payky/app-shared/console-history"
import { format } from "date-fns"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { appBrand } from "../../../core/app-brand.ts"
import type { useTranslation } from "../../../hooks/use-translation.ts"
import { shareFile } from "../../../platform/share-file"
import type { ShareFileOutcome } from "../../../platform/share-file-flow.ts"

/** What support needs to place a log: the app, its version and build, the platform. */
function consoleLogHeader(): ConsoleLogHeader {
  const versionCode = Constants.expoConfig?.android?.versionCode
  return {
    App: brandName(appBrand),
    Version: Constants.expoConfig?.version ?? "",
    ...(Platform.OS === "android" && versionCode !== undefined
      ? { Build: versionCode }
      : {}),
    Platform: `${Platform.OS} ${Platform.Version}`.trim(),
    ...(Platform.OS === "web" ? { "User agent": navigator.userAgent } : {}),
  }
}

/**
 * Web's `useFormatConsoleLog`: entries as the log that leaves the device
 * (copy, export), under `consoleLogHeader`. Redacted by `formatConsoleLog`
 * (settings/0006).
 */
export function formatDebugConsoleLog(
  entries: ReadonlyArray<ConsoleOutputHistoryEntry>
): string {
  return formatConsoleLog({
    entries,
    header: {
      ...consoleLogHeader(),
      "Exported at": new Date().toISOString(),
      Entries: entries.length,
    },
  })
}

/**
 * Web's `useFormatSupportLog`: entries as a message to support
 * (support/0005), an intro naming how many entries it holds, then the newest
 * that fit in one message, redacted.
 */
export function formatDebugConsoleSupportLog(
  entries: ReadonlyArray<ConsoleOutputHistoryEntry>,
  t: ReturnType<typeof useTranslation>["t"]
): string {
  const { text, included, total } = formatConsoleLogExcerpt({
    entries,
    header: consoleLogHeader(),
    maxBytes: supportLogMaxBytes,
  })
  return [
    t("settings.debugConsole.sendToSupport.message.intro", { count: included }),
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
}

/** Shares `log` as `<brand>-console-yyyyMMdd-HHmmss.txt`. */
export const shareDebugConsoleLog = (log: string): Promise<ShareFileOutcome> =>
  shareFile({
    filename: `${appBrand.id}-console-${format(new Date(), "yyyyMMdd-HHmmss")}.txt`,
    mimeType: "text/plain",
    bytes: new TextEncoder().encode(log),
  })
