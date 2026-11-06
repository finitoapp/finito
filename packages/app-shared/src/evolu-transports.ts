import type { Name, OwnerId } from "@evolu/common"
import {
  type RelaySyncState,
  type RelaySyncStatus,
  type SyncRouteError,
  type SyncState,
  syncStateToRelaySyncStates,
} from "@evolu/common/local-first"
import { appOwnerIdPlaceholder } from "@payky/core/evolu/device-account"
import type { TranslationKey } from "./i18n/resources.ts"

/**
 * Evolu labels a transport by its URL without the query, which carries the
 * owner id, so a configured URL is compared the same way.
 */
const transportLabel = (url: string): string => {
  const queryIndex = url.indexOf("?")
  return queryIndex === -1 ? url : url.slice(0, queryIndex)
}

export const orderDefaultTransportsFirst = <T extends { readonly url: string }>(
  transports: ReadonlyArray<T>,
  defaultUrls: ReadonlyArray<string>
): ReadonlyArray<T> => {
  const rank = (url: string): number => {
    const index = defaultUrls.indexOf(url)
    return index === -1 ? defaultUrls.length : index
  }
  return transports.toSorted((a, b) => rank(a.url) - rank(b.url))
}

/**
 * The relay state of `url` for `ownerId` in the database `name`, or null
 * while the shared worker has not reported it — before it connects, or right
 * after a transport change reopens the app database — and for a URL Evolu
 * cannot dial (`resolveTransportUrl`).
 */
export const findRelaySyncState = (
  state: SyncState | null,
  name: Name,
  ownerId: OwnerId,
  url: string | null
): RelaySyncState | null => {
  if (url === null) return null
  const label = transportLabel(url)
  return (
    syncStateToRelaySyncStates(state, name, ownerId).find(
      (relay) => relay.transport.label === label
    ) ?? null
  )
}

export type TransportSyncKind =
  | "synced"
  | "syncing"
  | "connecting"
  | "offline"
  | "error"

export const transportSyncKindLabels = {
  synced: "settings.security.transports.status.synced",
  syncing: "settings.security.transports.status.syncing",
  connecting: "settings.security.transports.status.connecting",
  offline: "settings.security.transports.status.offline",
  error: "settings.security.transports.status.error",
} satisfies Record<TransportSyncKind, TranslationKey>

export const transportRouteErrorKeys = {
  ProtocolVersionError: "settings.security.transports.status.errors.version",
  ProtocolWriteKeyError: "settings.security.transports.status.errors.writeKey",
  ProtocolQuotaError: "settings.security.transports.status.errors.quota",
  StorageQuotaError: "settings.security.transports.status.errors.quota",
  UnknownError: "settings.security.transports.status.errors.generic",
  ProtocolChangeTooLargeError:
    "settings.security.transports.status.errors.generic",
  DecryptWithXChaCha20Poly1305Error:
    "settings.security.transports.status.errors.decrypt",
  ProtocolInvalidDataError:
    "settings.security.transports.status.errors.generic",
  ProtocolWriteError: "settings.security.transports.status.errors.generic",
  ProtocolSyncError: "settings.security.transports.status.errors.generic",
  ProtocolTimestampMismatchError:
    "settings.security.transports.status.errors.generic",
  WriteFailed: "settings.security.transports.status.errors.generic",
  SyncFailed: "settings.security.transports.status.errors.generic",
} satisfies Record<SyncRouteError["type"], TranslationKey>

/** Evolu's `Syncing` covers a first connection too, which this line tells apart. */
export const toTransportSyncKind = (
  relay: RelaySyncState | null,
  status: RelaySyncStatus | null
): TransportSyncKind => {
  if (relay === null || status === null) return "connecting"
  switch (status.type) {
    case "Error":
      return "error"
    case "Synced":
      return "synced"
    case "Disconnected":
      return "offline"
    case "Syncing":
      return relay.transport.connection.type === "Connecting"
        ? "connecting"
        : "syncing"
  }
}

/**
 * A stored URL cut at its owner-id placeholders: `parts` are the text between
 * them, so a screen can show the placeholder as what it stands for instead of
 * raw template syntax. `scheme` is the leading `wss://`, when there is one.
 */
export const splitTransportUrl = (
  url: string
): {
  readonly scheme: string | null
  readonly parts: ReadonlyArray<string>
} => {
  const scheme = "wss://"
  const hasScheme = url.startsWith(scheme)
  return {
    scheme: hasScheme ? scheme : null,
    parts: (hasScheme ? url.slice(scheme.length) : url).split(
      appOwnerIdPlaceholder
    ),
  }
}
