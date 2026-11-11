import { sqliteFalse, sqliteTrue } from "@evolu/common"
import {
  isServiceProxyEnabled,
  setServiceProxyEnabled,
  updateDeviceSettings,
} from "@payky/core/evolu/device-account"
import {
  type AiAssistantAccess,
  createDefaultDeviceSettings,
  createDeviceQuery,
  deviceSettingsId,
} from "@payky/core/evolu/device-client"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { deviceEvoluAtom } from "../../../atoms/device-evolu.ts"
import { useDeviceEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

export const privacyQuery = createDeviceQuery((db) =>
  db
    .selectFrom("deviceSettings")
    .select([
      "id",
      "errorReportingEnabled",
      "productLookupEnabled",
      "aiAssistantAccess",
      "serviceProxyEnabled",
    ])
    .where("id", "=", deviceSettingsId)
)

/**
 * The consents of this device (ai/0004): none of them syncs, and all are off
 * until turned on, as the defaults say. A missing row reads as the defaults,
 * as web's `useDeviceSettings`; the service proxy has no default and reads
 * through `isServiceProxyEnabled` (service-proxy/0001).
 */
export function usePrivacySettings() {
  const { language } = useTranslation()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const row = useDeviceEvoluQuery(privacyQuery).data[0]
  const defaults = createDefaultDeviceSettings(language)

  return {
    errorReportingEnabled:
      (row?.errorReportingEnabled ?? defaults.errorReportingEnabled) ===
      sqliteTrue,
    productLookupEnabled:
      (row?.productLookupEnabled ?? defaults.productLookupEnabled) ===
      sqliteTrue,
    aiAssistantAccess: row?.aiAssistantAccess ?? defaults.aiAssistantAccess,
    serviceProxyEnabled: isServiceProxyEnabled(row),
    // The write is synchronous and local; the controllers react to the row.
    setErrorReportingEnabled: useCallback(
      (enabled: boolean) =>
        updateDeviceSettings(deviceEvolu, {
          errorReportingEnabled: enabled ? sqliteTrue : sqliteFalse,
        }),
      [deviceEvolu]
    ),
    setProductLookupEnabled: useCallback(
      (enabled: boolean) =>
        updateDeviceSettings(deviceEvolu, {
          productLookupEnabled: enabled ? sqliteTrue : sqliteFalse,
        }),
      [deviceEvolu]
    ),
    setServiceProxyEnabled: useCallback(
      (enabled: boolean) => setServiceProxyEnabled(deviceEvolu, enabled),
      [deviceEvolu]
    ),
    setAiAssistantAccess: useCallback(
      (aiAssistantAccess: AiAssistantAccess) =>
        updateDeviceSettings(deviceEvolu, { aiAssistantAccess }),
      [deviceEvolu]
    ),
  }
}
