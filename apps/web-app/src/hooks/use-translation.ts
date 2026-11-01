import type { Language } from "@payky/app-shared/i18n/resources"
import { createTranslate } from "@payky/app-shared/i18n/translate"
import * as React from "react"
import { appBrand } from "@/core/app-brand.ts"
import {
  useDeviceSettings,
  useUpdateDeviceSettings,
} from "@/hooks/use-device-settings.ts"

export function useTranslation() {
  const { language } = useDeviceSettings()

  return React.useMemo(
    () => ({ language, t: createTranslate(language, appBrand) }),
    [language]
  )
}

export function useSetLanguage() {
  const updateDeviceSettings = useUpdateDeviceSettings()

  return React.useCallback(
    (nextLanguage: Language) => {
      updateDeviceSettings({ language: nextLanguage })
    },
    [updateDeviceSettings]
  )
}
