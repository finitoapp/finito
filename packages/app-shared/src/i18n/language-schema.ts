import { z } from "zod"
import type { Language } from "./resources.ts"

/**
 * A UI language read from outside the app's own state, such as the landing
 * page's `?lang=` on onboarding (landing/0003). Both apps and the landing
 * read languages through it, so the set has one definition.
 */
export const LanguageSchema = z.enum([
  "cs",
  "en",
  "sk",
] as const satisfies ReadonlyArray<Language>)
