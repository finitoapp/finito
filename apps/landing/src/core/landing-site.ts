import {
  type Language,
  landingAppEntryPath,
} from "@payky/web-shared/landing-redirect"
import { appEnv } from "./app-env.ts"
import {
  createLandingResources,
  type LandingSite,
  landingSites,
} from "./landing-sites.ts"

const builtSite = landingSites[appEnv.PAYKY_LANDING_BRAND]

/**
 * The landing this build presents (`PAYKY_LANDING_BRAND`, landing/0013). A
 * landing apart from its app reaches the app `VITE_PAYKY_API_BASE_URL`
 * names, so the edge landing sends visitors to the edge app.
 */
export const landingSite: LandingSite = {
  ...builtSite,
  appOrigin:
    builtSite.appOrigin === null
      ? null
      : (appEnv.VITE_PAYKY_API_BASE_URL ?? builtSite.appOrigin),
}

/** The copy as this landing reads it. */
export const landingResources = createLandingResources(landingSite)

export const landingPaths = landingSite.paths.home
export const landingEetPaths = landingSite.paths.eet
export const landingTechPaths = landingSite.paths.tech
export const landingPrivacyPaths = landingSite.paths.privacy

/**
 * Where the landing's ways into the web app lead, in the page's language
 * (landing/0003): a path on Payky's shared origin, Finito's app elsewhere.
 */
export const landingAppEntryUrl = (language: Language): string =>
  landingSite.appOrigin === null
    ? landingAppEntryPath(language)
    : new URL(landingAppEntryPath(language), landingSite.appOrigin).href

/**
 * Whether the browser can install the app from the landing (landing/0005):
 * only where the landing shares the app's origin and so its manifest.
 */
export const installsFromLanding = landingSite.appOrigin === null

/** `pathname` on the app's API, which the contact form calls. */
export const apiUrl = (pathname: string): string =>
  new URL(
    pathname,
    appEnv.VITE_PAYKY_API_BASE_URL ??
      landingSite.appOrigin ??
      globalThis.location?.origin ??
      landingSite.brand.apiBaseUrl
  ).href
