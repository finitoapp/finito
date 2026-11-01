import type { Language } from "@payky/app-shared/i18n/resources"
import { createTranslate } from "@payky/app-shared/i18n/translate"
import { updateDeviceSettings } from "@payky/core/evolu/device-account"
import {
  type DeviceLocale,
  getDeviceLocaleForLanguage,
} from "@payky/core/evolu/device-client"
import { useAtomValue } from "jotai"
import { useCallback, useMemo } from "react"
import { deviceEvoluAtom, deviceSettingsQuery } from "../atoms/device-evolu.ts"
import { appBrand } from "../core/app-brand.ts"
import { useDeviceEvoluQuery } from "./use-evolu-query.ts"

/** Number and money formatting locale; falls back to the language's, as web's `useLocale`. */
export function useLocale(): DeviceLocale {
  const row = useDeviceEvoluQuery(deviceSettingsQuery).data[0]
  return row?.locale ?? getDeviceLocaleForLanguage(row?.language ?? "en")
}

/** The device language comes from the bootstrapped device settings row. */
export function useTranslation() {
  const language =
    useDeviceEvoluQuery(deviceSettingsQuery).data[0]?.language ?? "en"

  return useMemo(
    () => ({ language, t: createTranslate(language, appBrand) }),
    [language]
  )
}

/** Writes the device language (unsynced), as web's `useSetLanguage` does. */
export function useSetLanguage() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)

  return useCallback(
    (language: Language) => {
      updateDeviceSettings(deviceEvolu, { language })
    },
    [deviceEvolu]
  )
}

/** Writes the device locale (number and money formatting), as web's `useSetLocale`. */
export function useSetLocale() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)

  return useCallback(
    (locale: DeviceLocale) => {
      updateDeviceSettings(deviceEvolu, { locale })
    },
    [deviceEvolu]
  )
}
