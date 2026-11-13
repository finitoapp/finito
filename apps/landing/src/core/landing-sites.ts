import {
  applyBrandName,
  type Brand,
  type BrandId,
  finitoBrand,
  paykyBrand,
} from "@payky/app-shared/brand"
import {
  createLandingSitePaths,
  type LandingSitePaths,
} from "@payky/web-shared/landing-redirect"
import {
  type Language,
  resources,
  type TranslationKey,
} from "../i18n/resources.ts"

/**
 * Where a brand's landing lives and where it sends a visitor (landing/0013).
 * Payky's is proxied under `/landing` on payky.me, the app's own origin;
 * Finito's is the root of finito.fit, apart from the app on app.finito.fit.
 * Imports stay relative and free of build env, so the web app's e2e helpers
 * can read the copy too.
 */
export interface LandingSite {
  readonly brand: Brand
  /** The origin the pages' canonical addresses and the sitemap hang off. */
  readonly siteUrl: string
  readonly paths: LandingSitePaths
  /** Where the app runs; `null` on the landing's own origin. */
  readonly appOrigin: string | null
  /** The newest release's APK, named by the release workflow (docs/releases.md). */
  readonly apkUrl: string
  /** The app's listing in Zapstore, if it has one. */
  readonly zapstoreUrl: string | null
}

const releasesUrl =
  "https://github.com/finitoapp/finito/releases/latest/download"

export const landingSites = {
  payky: {
    brand: paykyBrand,
    siteUrl: "https://payky.me",
    paths: createLandingSitePaths("/landing"),
    appOrigin: null,
    apkUrl: `${releasesUrl}/app-release-signed.apk`,
    zapstoreUrl: "https://zapstore.dev/apps/me.payky",
  },
  finito: {
    brand: finitoBrand,
    siteUrl: "https://finito.fit",
    paths: createLandingSitePaths("", { terminal: true }),
    appOrigin: finitoBrand.apiBaseUrl,
    apkUrl: `${releasesUrl}/finito-release-signed.apk`,
    zapstoreUrl: null,
  },
} as const satisfies Record<BrandId, LandingSite>

/**
 * The hosts the copy names besides the app's name, by placeholder, and the
 * brand's website, which the privacy policy taken from the app's copy names
 * for its contact form (landing/0014).
 */
export const landingHosts = (site: LandingSite) =>
  ({
    siteHost: new URL(site.siteUrl).host,
    appHost: new URL(site.appOrigin ?? site.siteUrl).host,
    liveRelayHost: site.brand.liveRelayHost,
    websiteUrl: site.brand.websiteUrl,
  }) as const

export type LandingResources = Readonly<
  Record<Language, Readonly<Record<TranslationKey, string>>>
>

/** The copy as `site` reads it: its app's name and hosts filled in. */
export function createLandingResources(site: LandingSite): LandingResources {
  const hosts = Object.entries(landingHosts(site))
  const fill = (language: Language) =>
    Object.fromEntries(
      Object.entries(resources[language]).map(([key, text]) => [
        key,
        hosts.reduce(
          (result, [placeholder, host]) =>
            result.replaceAll(`{${placeholder}}`, host),
          applyBrandName(text, site.brand.names[language])
        ),
      ])
    ) as Readonly<Record<TranslationKey, string>>
  return { en: fill("en"), cs: fill("cs"), sk: fill("sk") }
}
