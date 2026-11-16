import type { Millis } from "@evolu/common"
import { relaySyncStateToStatus } from "@evolu/common/local-first"
import {
  findRelaySyncState,
  type TransportSyncKind,
  toTransportSyncKind,
  transportRouteErrorKeys,
  transportSyncKindLabels,
} from "@payky/app-shared/evolu-transports"
import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import { resolveTransportUrl } from "@payky/core/evolu/device-account"
import { isSameDay } from "date-fns"
import { useAtomValue } from "jotai"
import { useSyncExternalStore } from "react"
import { Text, XStack } from "tamagui"
import { evoluAtom } from "../../../atoms/evolu.ts"
import { PulseDot } from "../../../components/pulse-dot.tsx"
import { nativeRun } from "../../../core/native-runtime.ts"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

const kindDotColors = {
  synced: "success",
  syncing: "info",
  connecting: "warning",
  offline: "muted-foreground",
  error: "destructive",
} as const satisfies Record<TransportSyncKind, string>

/** The live sync status of one active transport, from Evolu's `syncState`. */
export function TransportSyncStatus({ url }: { readonly url: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const evolu = useAtomValue(evoluAtom)
  const { syncState } = nativeRun.deps
  const state = useSyncExternalStore(syncState.subscribe, syncState.get)
  // Every write flips a synced relay to syncing and back within moments.
  const relay = useDebouncedValue(
    findRelaySyncState(
      state,
      evolu.name,
      evolu.appOwner.id,
      resolveTransportUrl(url, evolu.appOwner.id)
    ),
    400
  )
  const status = relay === null ? null : relaySyncStateToStatus(relay)
  const kind = toTransportSyncKind(relay, status)

  const formatAt = (millis: Millis) => {
    const date = new Date(millis)
    return isSameDay(date, new Date())
      ? formatTime(date, locale)
      : formatDateTime(date, locale)
  }

  const detail = ((): string | null => {
    if (relay === null) return null
    const { route } = relay
    const { connection } = relay.transport

    switch (kind) {
      case "error":
        return status?.type === "Error"
          ? t(transportRouteErrorKeys[status.error.type])
          : null
      case "synced":
        return route.completeAt === null ? null : formatAt(route.completeAt)
      case "syncing":
        return route.completeAt === null
          ? t("settings.security.transports.status.firstSync")
          : null
      case "connecting":
      case "offline":
        if (connection.type !== "Connecting" && connection.error !== null) {
          return t("settings.security.transports.status.unreachable")
        }
        if (route.completeAt !== null) {
          return t("settings.security.transports.status.lastSynced", {
            time: formatAt(route.completeAt),
          })
        }
        return connection.type === "Disconnected"
          ? t("settings.security.transports.status.offlineSince", {
              time: formatAt(connection.disconnectedAt),
            })
          : null
    }
  })()

  return (
    <XStack items="center" gap={6}>
      <PulseDot
        color={kindDotColors[kind]}
        loop={kind === "syncing" || kind === "connecting" ? "pulse" : undefined}
      />
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        color={kind === "error" ? "destructive" : "muted-foreground"}
      >
        {t(transportSyncKindLabels[kind])}
        {detail === null ? "" : ` · ${detail}`}
      </Text>
    </XStack>
  )
}
