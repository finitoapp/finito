import type { Language } from "@payky/app-shared/i18n/resources"

/** Names stay in their own language; web's `languageOptions` plus Vietnamese,
 * which only Finito offers (brand/0007). */
export const languageOptions: ReadonlyArray<{
  readonly value: Language
  readonly label: string
}> = [
  { value: "en", label: "English" },
  { value: "cs", label: "Čeština" },
  { value: "sk", label: "Slovenčina" },
  { value: "vi", label: "Tiếng Việt" },
]
