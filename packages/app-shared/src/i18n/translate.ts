import { applyBrandName, type Brand, type BrandPlaceholder } from "../brand.ts"
import type { en } from "./en.ts"
import { type Language, resources, type TranslationKey } from "./resources.ts"

/**
 * The `{name}`-style placeholder names a translation key's English source
 * string requires. English is the source of truth for translation keys
 * (see AGENTS.md), so params are derived from `en`, not the active language.
 * Brand placeholders are filled by `createTranslate` and are not params.
 */
type ExtractParams<S extends string> =
  S extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractParams<Rest>
    : never
type ParamsFor<K extends TranslationKey> = Exclude<
  ExtractParams<(typeof en)[K]>,
  BrandPlaceholder
>

/**
 * Distributes over `K` (via the `K extends TranslationKey` naked-type-param
 * trick) so a call site whose key isn't a literal — e.g. a `TranslationKey`
 * value read from data — degrades to "params optional" instead of unioning
 * every key's params into one impossible-to-satisfy requirement.
 */
export type ParamsArgs<K extends TranslationKey> = K extends TranslationKey
  ? [ParamsFor<K>] extends [never]
    ? [params?: undefined]
    : [params: Readonly<Record<ParamsFor<K>, string | number>>]
  : never

function interpolate(
  text: string,
  params: Readonly<Record<string, string | number>>
): string {
  return text.replace(/\{([^{}]+)\}/gu, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  )
}

/**
 * The `t` function both apps' `useTranslation` hooks return for a language,
 * naming the app by `brand`. The brand is filled in before the params, so a
 * param value is never read as a placeholder.
 */
export const createTranslate = (language: Language, brand: Brand) => {
  const forms = brand.names[language]
  return <K extends TranslationKey>(key: K, ...args: ParamsArgs<K>): string => {
    const [params] = args as [
      Readonly<Record<string, string | number>> | undefined,
    ]
    const text = applyBrandName(resources[language][key], forms)
    return params === undefined ? text : interpolate(text, params)
  }
}

/**
 * Every key's copy in `language` with `brand` filled in and `{name}` params
 * left as they are — for code that needs the whole table at once, such as
 * the e2e string dumps.
 */
export const createBrandedResources = (
  language: Language,
  brand: Brand
): Readonly<Record<TranslationKey, string>> => {
  const forms = brand.names[language]
  return Object.fromEntries(
    Object.entries(resources[language]).map(([key, text]) => [
      key,
      applyBrandName(text, forms),
    ])
  ) as Record<TranslationKey, string>
}
