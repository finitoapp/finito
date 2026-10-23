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
 * its own brand statically; the API, deployed once per brand, reads which one
 * it serves from `PAYKY_BRAND` (`apps/web-app/src/server/server-brand.ts`).
 */
export interface Brand {
  readonly id: BrandId
  readonly names: Readonly<Record<Language, BrandNameForms>>
  /** The production origin of the app's API, which the native app calls. */
  readonly apiBaseUrl: string
  /** The Lightning address the donations page pays (LUD-16). */
  readonly donateLightningAddress: string
  /**
   * The live relay's host in the transports a new account starts with; both
   * hosts reach the one relay, so the apps' devices share a room.
   */
  readonly liveRelayHost: string
  readonly selfPayOrigin: string
}

export type BrandId = "payky" | "finito"

const payky = { nominative: "Payky" } as const satisfies BrandNameForms

export const paykyBrand = {
  id: "payky",
  names: { en: payky, cs: payky, sk: payky },
  apiBaseUrl: "https://payky.me",
  donateLightningAddress: "donate@payky.me",
  liveRelayHost: "live-relay.payky.me",
  selfPayOrigin: "https://t.payky.me",
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
  apiBaseUrl: "https://app.finito.fit",
  // Served by the landing on finito.fit, which forwards the LNURL request to
  // the API on app.finito.fit.
  donateLightningAddress: "donate@finito.fit",
  liveRelayHost: "live-relay.finito.fit",
  selfPayOrigin: "https://t.finito.fit",
} as const satisfies Brand

export const brands = {
  payky: paykyBrand,
  finito: finitoBrand,
} as const satisfies Record<BrandId, Brand>

export const brandSelfPayOrigins: ReadonlyArray<string> = Object.values(
  brands
).map((brand) => brand.selfPayOrigin)

export const brandOfSelfPayHost = (host: string): Brand =>
  Object.values(brands).find(
    (brand) => new URL(brand.selfPayOrigin).host === host
  ) ?? paykyBrand

/**
 * The name where no copy declines it: the launcher, a report header, the name
 * of a key another service lists.
 */
export const brandName = (brand: Brand): string => brand.names.en.nominative

/**
 * The placeholders copy names the app by, each with the case it needs
 * (brand/0002): "Aktualizujte {appName}" but "kód {appNameGen}". The app's
 * `t` and the landing's resources fill them from the brand, so call sites
 * never pass them.
 */
const brandPlaceholders = {
  appName: "nominative",
  appNameGen: "genitive",
  appNameDat: "dative",
  appNameLoc: "locative",
} as const satisfies Record<string, keyof BrandNameForms>

export type BrandPlaceholder = keyof typeof brandPlaceholders

export const brandPlaceholderNames = Object.keys(
  brandPlaceholders
) as ReadonlyArray<BrandPlaceholder>

/** `text` with every brand placeholder replaced by its form of the name. */
export const applyBrandName = (text: string, forms: BrandNameForms): string =>
  Object.entries(brandPlaceholders).reduce(
    (result, [placeholder, form]) =>
      result.replaceAll(`{${placeholder}}`, forms[form] ?? forms.nominative),
    text
  )
