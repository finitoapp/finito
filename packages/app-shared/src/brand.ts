import type { Language } from "./i18n/resources.ts"

/**
 * The forms of a brand name a language's copy needs (brand/0002). Czech and
 * Slovak decline the name, so copy names the case through its placeholder
 * (`{appNameGen}` for "kód Finita"); a case left out reads as the nominative.
 */
export interface BrandNameForms {
  readonly nominative: string
  readonly genitive?: string
  readonly dative?: string
  readonly locative?: string
}

/**
 * The name an app ships under (brand/0001): the web app and the Capacitor
 * shell are Payky, the native app and its web export are Finito, over one
 * shared account, protocol and set of internal identifiers. Each app imports
 * its own brand statically; nothing switches it at runtime or at build time.
 */
export interface Brand {
  readonly id: "payky" | "finito"
  readonly names: Readonly<Record<Language, BrandNameForms>>
}

const payky = { nominative: "Payky" } as const satisfies BrandNameForms

export const paykyBrand = {
  id: "payky",
  names: { en: payky, cs: payky, sk: payky },
} as const satisfies Brand

export const finitoBrand = {
  id: "finito",
  names: {
    en: { nominative: "Finito" },
    cs: {
      nominative: "Finito",
      genitive: "Finita",
      dative: "Finitu",
      locative: "Finitu",
    },
    sk: {
      nominative: "Finito",
      genitive: "Finita",
      dative: "Finitu",
      locative: "Finite",
    },
  },
} as const satisfies Brand

/**
 * The name where no copy declines it: the launcher, a report header, the name
 * of a key another service lists.
 */
export const brandName = (brand: Brand): string => brand.names.en.nominative
