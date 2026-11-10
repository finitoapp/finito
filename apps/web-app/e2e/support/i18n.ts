import type {
  TranslationKey as AppTranslationKey,
  Language,
} from "@payky/app-shared/i18n/resources"
import { createBrandedResources } from "@payky/app-shared/i18n/translate"
import {
  createLandingResources,
  landingSites,
} from "../../../landing/src/core/landing-sites.ts"
import type { TranslationKey as LandingTranslationKey } from "../../../landing/src/i18n/resources.ts"
import { appBrand } from "../../src/core/app-brand.ts"

type TranslationKey = AppTranslationKey | LandingTranslationKey
// The web app proxies Payky's landing (landing/0013).
const landingResources = createLandingResources(landingSites.payky)
const resources = {
  en: { ...createBrandedResources("en", appBrand), ...landingResources.en },
  cs: { ...createBrandedResources("cs", appBrand), ...landingResources.cs },
  sk: { ...createBrandedResources("sk", appBrand), ...landingResources.sk },
}

/**
 * Runner-agnostic: `bin/generate-doc-screenshots.ts` imports these helpers
 * outside the Playwright test runner, so nothing here may call `test.step(...)`
 * — it throws "test.step() can only be called from a test" there.
 */
export function translate(language: Language, key: TranslationKey): string {
  return resources[language][key]
}

/** `translate()` for a `{name}`-templated key, e.g. `"bill.brick.add.aria"`. Always English — every current call site only ever needs it in the default test language. */
export function nameParam(key: TranslationKey, name: string): string {
  return translate("en", key).replace("{name}", name)
}

/** `translate()` for a `{value}`-templated key, e.g. `"settings.tips.percentages.value"` ("{value}%"). */
export function translateValue(
  language: Language,
  key: TranslationKey,
  value: string | number
): string {
  return translate(language, key).replace("{value}", String(value))
}

export function translateParams(
  language: Language,
  key: TranslationKey,
  params: Readonly<Record<string, string | number>>
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    translate(language, key)
  )
}
