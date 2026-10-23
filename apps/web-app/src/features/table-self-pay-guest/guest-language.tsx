import { jsonCodec } from "@payky/core/zod-utils"
import type { Language } from "@payky/web-shared/landing-redirect"
import { languageOptions } from "@payky/web-shared/language-options"
import { createContext, type ReactNode, use, useEffect, useState } from "react"
import { z } from "zod"

const STORAGE_KEY = "payky.guestLanguage"
const GuestLanguageSchema = z.literal(languageOptions.map(({ value }) => value))
const GuestLanguageJson = jsonCodec(GuestLanguageSchema)

export const resolveGuestLanguage = (
  stored: string | null,
  browserLanguages: ReadonlyArray<string>
): Language => {
  const remembered =
    stored === null ? null : z.safeDecode(GuestLanguageJson, stored)
  if (remembered?.success) return remembered.data
  return (
    browserLanguages
      .map((language) =>
        GuestLanguageSchema.safeParse(language.slice(0, 2).toLowerCase())
      )
      .find((offered) => offered.success)?.data ?? "en"
  )
}

const readStoredLanguage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const GuestLanguageContext = createContext<{
  readonly language: Language
  readonly setLanguage: (language: Language) => void
}>({ language: "en", setLanguage: () => undefined })

export const useGuestLanguage = () => use(GuestLanguageContext)

export function GuestLanguageProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const [language, setLanguage] = useState(() =>
    resolveGuestLanguage(readStoredLanguage(), navigator.languages)
  )
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const chooseLanguage = (next: Language) => {
    setLanguage(next)
    try {
      localStorage.setItem(STORAGE_KEY, z.encode(GuestLanguageJson, next))
    } catch {}
  }

  return (
    <GuestLanguageContext value={{ language, setLanguage: chooseLanguage }}>
      {children}
    </GuestLanguageContext>
  )
}
