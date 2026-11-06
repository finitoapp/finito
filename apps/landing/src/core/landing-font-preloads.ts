import manropeLatin400 from "@fontsource/manrope/files/manrope-latin-400-normal.woff2?url"
import manropeLatin600 from "@fontsource/manrope/files/manrope-latin-600-normal.woff2?url"
import manropeLatin700 from "@fontsource/manrope/files/manrope-latin-700-normal.woff2?url"
import manropeLatinExt400 from "@fontsource/manrope/files/manrope-latin-ext-400-normal.woff2?url"
import manropeLatinExt600 from "@fontsource/manrope/files/manrope-latin-ext-600-normal.woff2?url"
import manropeLatinExt700 from "@fontsource/manrope/files/manrope-latin-ext-700-normal.woff2?url"
import type { Language } from "@/i18n/resources.ts"

const latin = [manropeLatin400, manropeLatin600, manropeLatin700] as const
const latinExt = [
  manropeLatinExt400,
  manropeLatinExt600,
  manropeLatinExt700,
] as const

/**
 * The Manrope files a page in `language` draws its text with, which its head
 * preloads: the browser otherwise finds them only once the stylesheet is
 * parsed and the text laid out (each face's `unicode-range`), and paints
 * the fallback font first. Every weight `index.css` imports, in the basic
 * Latin subset, and for Czech and Slovak the extended one their accents
 * need; English pulls that in only if a page uses it. Vite names the files
 * by their content, so these are the URLs the stylesheet asks for.
 */
export const landingFontPreloads = {
  cs: [...latin, ...latinExt],
  en: latin,
  sk: [...latin, ...latinExt],
} as const satisfies Record<Language, ReadonlyArray<string>>
