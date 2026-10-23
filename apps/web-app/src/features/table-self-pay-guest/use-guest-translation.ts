import { csBill } from "@payky/app-shared/i18n/cs/bill"
import { enBill } from "@payky/app-shared/i18n/en/bill"
import { interpolate } from "@payky/app-shared/i18n/interpolate"
import { skBill } from "@payky/app-shared/i18n/sk/bill"
import { useMemo } from "react"
import { useGuestLanguage } from "./guest-language.tsx"

const guestResources = { en: enBill, cs: csBill, sk: skBill } as const

type GuestTranslationKey = keyof typeof enBill

export const translateForGuest = (
  language: keyof typeof guestResources,
  key: GuestTranslationKey,
  params: Readonly<Record<string, string | number>> = {}
): string => interpolate(guestResources[language][key], params)

export const useGuestTranslation = () => {
  const { language } = useGuestLanguage()
  return useMemo(
    () => ({
      locale: language,
      t: (
        key: GuestTranslationKey,
        params?: Readonly<Record<string, string | number>>
      ): string => translateForGuest(language, key, params),
    }),
    [language]
  )
}

export type GuestTranslate = ReturnType<typeof useGuestTranslation>["t"]
