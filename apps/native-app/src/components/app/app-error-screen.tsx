import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createTranslate } from "@payky/app-shared/i18n/translate"
import { getPreferredDeviceLanguage } from "@payky/core/modules/device/device-utils"
import * as Clipboard from "expo-clipboard"
import Constants from "expo-constants"
import { useEffect, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
} from "react-native"
import { appBrand } from "../../core/app-brand.ts"
import { captureReportedError } from "../../core/error-reporting.ts"
import { markFirstScreenReady } from "../../core/first-screen.ts"

/**
 * Plain React Native on purpose: Expo Router renders the root layout's
 * `ErrorBoundary` outside that layout, so there is no jotai store, Tamagui
 * theme or device Evolu to read here (and the crash may come from them). The
 * language is a best-effort lookup that degrades to English, as on web.
 */
function t(key: TranslationKey): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    return createTranslate(getPreferredDeviceLanguage(locale), appBrand)(key)
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

/** Web's `formatErrorDetail`, without the component stack native's boundary lacks. */
function formatErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return (
      [error.stack, error.message, error.name].find(
        (value) => value !== undefined && value.trim().length > 0
      ) ?? ""
    )
  }
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error, null, 2) ?? String(error)
  } catch {
    return String(error)
  }
}

export function AppErrorScreen({
  error,
  retry,
}: {
  readonly error: unknown
  readonly retry: () => void
}) {
  const dark = useColorScheme() === "dark"
  const fg = dark ? "#fafafa" : "#0a0a0a"
  const [copyState, setCopyState] = useState<CopyState>("idle")

  useEffect(() => {
    captureReportedError(error)
  }, [error])
  // A crash before the first screen would stay behind the held splash.
  useEffect(() => {
    markFirstScreenReady()
  }, [])

  const name = error instanceof Error ? error.name : t("appError.unknown")
  const message =
    error instanceof Error ? error.message : t("appError.nonError")
  const version = Constants.expoConfig?.version

  const copyDetail = async () => {
    try {
      await Clipboard.setStringAsync(
        `Payky ${version ?? ""}\n${name}: ${message}\n\n${formatErrorDetail(error)}`
      )
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: dark ? "#0a0a0a" : "#ffffff" }}
      contentContainerStyle={styles.content}
    >
      <Text role="heading" style={[styles.title, { color: fg }]}>
        {t("appError.title")}
      </Text>
      <Text style={{ color: fg }}>{t("appError.description")}</Text>
      <Text style={{ color: fg }}>
        {t("appError.name")}: {name}
      </Text>
      <Text style={{ color: fg }}>
        {t("appError.message")}: {message}
      </Text>
      <Text style={{ color: fg }}>
        {t("appError.version")}: {version}
      </Text>
      <Pressable
        role="button"
        onPress={() => void copyDetail()}
        style={styles.linkButton}
      >
        <Text style={{ color: fg, textDecorationLine: "underline" }}>
          {t(copyLabelKeys[copyState])}
        </Text>
      </Pressable>
      <Pressable
        role="button"
        onPress={retry}
        style={[styles.button, { backgroundColor: fg }]}
      >
        <Text style={{ color: dark ? "#0a0a0a" : "#fafafa" }}>
          {t("appError.tryAgain")}
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: "700" },
  linkButton: { alignSelf: "flex-start", paddingVertical: 10 },
  button: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
})
