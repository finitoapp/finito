import {
  createDefaultDeviceSettings,
  createDeviceEvolu,
  createDeviceQuery,
  deviceSettingsId,
} from "@payky/core/evolu/device-client"
import { getPreferredDeviceLanguage } from "@payky/core/modules/device/device-utils"
import { atom } from "jotai"
import { appBrand } from "../core/app-brand.ts"
import { nativeRun } from "../core/native-runtime.ts"

/**
 * The device settings the first screen reads (language, locale, theme, error
 * reporting), as one query: this atom loads it before anything renders, so
 * every hook below finds it cached instead of loading its own column in a
 * round trip of its own.
 */
export const deviceSettingsQuery = createDeviceQuery((db) =>
  db
    .selectFrom("deviceSettings")
    .select(["id", "language", "locale", "theme", "errorReportingEnabled"])
    .where("id", "=", deviceSettingsId)
)

/** The device's UI language source: the OS locale, not `navigator.language`. */
const getNativeLocale = () => Intl.DateTimeFormat().resolvedOptions().locale

/** The one unsynced device database, opened once per Jotai store. */
export const deviceEvoluAtom = atom(async () => {
  const deviceEvolu = await nativeRun.ok(createDeviceEvolu)
  const deviceSettings = await deviceEvolu.loadQuery(deviceSettingsQuery)

  if (deviceSettings.length === 0) {
    deviceEvolu.upsert(
      "deviceSettings",
      createDefaultDeviceSettings(
        getPreferredDeviceLanguage(getNativeLocale(), appBrand.languages)
      )
    )
  }

  return deviceEvolu
})

/** Read-only diagnostic: the stored device language, never other contents. */
export const deviceLanguageAtom = atom(async (get) => {
  const deviceEvolu = await get(deviceEvoluAtom)
  const [row] = await deviceEvolu.loadQuery(deviceSettingsQuery)
  return row?.language ?? null
})
