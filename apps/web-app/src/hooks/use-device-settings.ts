import { updateDeviceSettings } from "@payky/core/evolu/device-account"
import {
  createDefaultDeviceSettings,
  createDeviceQuery,
  type DeviceSettings,
  type DeviceSettingsRow,
  deviceSettingsId,
  getDeviceLocaleForLanguage,
} from "@payky/core/evolu/device-client"
import { getPreferredDeviceLanguage } from "@payky/core/modules/device/device-utils"
import { useAtomValue } from "jotai"
import * as React from "react"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"

function getDefaultDeviceSettings(): DeviceSettings {
  return createDefaultDeviceSettings(
    getPreferredDeviceLanguage(navigator.language)
  )
}

const deviceSettingsQuery = createDeviceQuery((db) =>
  db
    .selectFrom("deviceSettings")
    .select([
      "id",
      "language",
      "theme",
      "locale",
      "errorReportingEnabled",
      "productLookupEnabled",
      "aiAssistantAccess",
    ])
    .where("id", "=", deviceSettingsId)
)

/**
 * The consent to the service proxy is not one of the `DeviceSettings`: it is
 * read through `useServiceProxyEnabled`, so it is neither selected here nor
 * defaulted.
 */
function withDeviceSettingsDefaults(
  row: Omit<DeviceSettingsRow, "serviceProxyEnabled"> | undefined
): DeviceSettings {
  const defaults = getDefaultDeviceSettings()
  const language = row?.language ?? defaults.language

  return {
    id: row?.id ?? defaults.id,
    language,
    theme: row?.theme ?? defaults.theme,
    locale: row?.locale ?? getDeviceLocaleForLanguage(language),
    errorReportingEnabled:
      row?.errorReportingEnabled ?? defaults.errorReportingEnabled,
    productLookupEnabled:
      row?.productLookupEnabled ?? defaults.productLookupEnabled,
    aiAssistantAccess: row?.aiAssistantAccess ?? defaults.aiAssistantAccess,
  }
}

export function useDeviceSettings(): DeviceSettings {
  const { data } = useDeviceEvoluQuery(deviceSettingsQuery)
  const deviceSettings = data[0]

  return React.useMemo(
    () => withDeviceSettingsDefaults(deviceSettings),
    [deviceSettings]
  )
}

export function useUpdateDeviceSettings() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)

  return React.useCallback(
    (patch: Partial<Omit<DeviceSettings, "id">>) => {
      updateDeviceSettings(deviceEvolu, patch)
    },
    [deviceEvolu]
  )
}
