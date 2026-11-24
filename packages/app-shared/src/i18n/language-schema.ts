import { z } from "zod"
import type { Language } from "./resources.ts"

/**
 * A UI language read from outside the app's own state, such as the landing
 * page's `?lang=` on onboarding (landing/0003). It holds every language the
 * copy is translated into; which of them an app offers is its brand's
 * (`Brand.languages`, brand/0007).
 */
export const LanguageSchema = z.enum([
  "cs",
  "en",
  "sk",
  "vi",
] as const satisfies ReadonlyArray<Language>)
