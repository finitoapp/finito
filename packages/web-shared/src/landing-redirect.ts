import { Capacitor } from "@capacitor/core"
import { jsonCodec } from "@payky/core/zod-utils"
import { z } from "zod"
export type Language = "cs" | "en" | "sk"

// Presence alone is the marker, so there is no value to decode.
const appEnteredStorageKey = "payky.appEntered"
const landingLanguageStorageKey = "payky.landingLanguage"
const installLanguageStorageKey = "payky.installLanguage"

/**
 * The addresses of the landing documents, one per language: the home page
 * (landing/0002), the EET 2.0 page (landing/0006) and the page on how the
 * app works (landing/0008), Czech at the bare path.
 */
export interface LandingSitePaths {
  readonly home: Readonly<Record<Language, string>>
  readonly eet: Readonly<Record<Language, string>>
  readonly tech: Readonly<Record<Language, string>>
}

/**
 * The documents under `base`: `/landing` on payky.me, which the web app
 * proxies there, the domain's root on finito.fit (landing/0013).
 */
export const createLandingSitePaths = (
  base: "/landing" | ""
): LandingSitePaths => ({
  home: { cs: base === "" ? "/" : base, en: `${base}/en`, sk: `${base}/sk` },
  eet: {
    cs: `${base}/eet-2-0`,
    en: `${base}/en/eet-2-0`,
    sk: `${base}/sk/eet-2-0`,
  },
  tech: {
    cs: `${base}/jak-to-funguje`,
    en: `${base}/en/jak-to-funguje`,
    sk: `${base}/sk/jak-to-funguje`,
  },
})

/** Payky's landing, where the web app sends a visitor (landing/0001). */
export const landingPaths = createLandingSitePaths("/landing").home

export const LandingLanguageSchema: z.ZodType<Language> = z.enum([
  "cs",
  "en",
  "sk",
])

const LandingLanguageJson = jsonCodec(LandingLanguageSchema)

export interface LandingRedirectEnvironment {
  readonly nativePlatform: boolean
  readonly installedPwa: boolean
  readonly appEntered: boolean
}

/**
 * Whether a device with no account goes to the landing page rather than to
 * onboarding (landing/0001): only a browser tab that has never opened the
 * app does.
 */
export const shouldRedirectToLanding = ({
  nativePlatform,
  installedPwa,
  appEntered,
}: LandingRedirectEnvironment): boolean =>
  !nativePlatform && !installedPwa && !appEntered

export function readLandingRedirectEnvironment(): LandingRedirectEnvironment {
  return {
    nativePlatform: Capacitor.isNativePlatform(),
    installedPwa:
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's home-screen apps report themselves only through this.
      ("standalone" in navigator && navigator.standalone === true),
    appEntered: readAppEntered(),
  }
}

function readAppEntered(): boolean {
  try {
    return localStorage.getItem(appEnteredStorageKey) !== null
  } catch {
    // Storage blocked: the visitor sees the landing page again, nothing worse.
    return false
  }
}

export function markAppEntered(): void {
  try {
    localStorage.setItem(appEnteredStorageKey, "1")
    // Onboarding has its language by now; a language picked there must not
    // be undone by the installed app's next start (landing/0005).
    localStorage.removeItem(installLanguageStorageKey)
  } catch {
    // Same as above.
  }
}

/**
 * The language picked on the landing page before, else Czech, whatever the
 * browser's language is (landing/0004).
 */
export function preferredLandingLanguage(): Language {
  try {
    const stored = localStorage.getItem(landingLanguageStorageKey)
    if (stored !== null) {
      const parsed = z.safeDecode(LandingLanguageJson, stored)
      if (parsed.success) return parsed.data
    }
  } catch {
    // Storage blocked: the default it is.
  }
  return "cs"
}

export function rememberLandingLanguage(language: Language): void {
  try {
    localStorage.setItem(
      landingLanguageStorageKey,
      z.encode(LandingLanguageJson, language)
    )
  } catch {
    // Storage blocked: the next redirect uses the default.
  }
}

/**
 * Kept when the app is installed from the landing page, whose start URL
 * cannot carry the page's language (landing/0005).
 */
export function rememberInstallLanguage(language: Language): void {
  try {
    localStorage.setItem(
      installLanguageStorageKey,
      z.encode(LandingLanguageJson, language)
    )
  } catch {
    // Storage blocked: the installed app starts in the browser's language.
  }
}

/** The language the app was installed in, until onboarding has opened. */
export function readInstallLanguage(): Language | undefined {
  try {
    const stored = localStorage.getItem(installLanguageStorageKey)
    if (stored === null) return undefined
    const parsed = z.safeDecode(LandingLanguageJson, stored)
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/** Where the landing page's ways into the web app lead (landing/0003). */
export const landingAppEntryPath = (language: Language): string =>
  `/onboarding?lang=${language}`

// A trailing slash goes, except from the root itself.
const normalizeLandingPath = (pathname: string) =>
  pathname.replace(/(?<=.)\/+$/u, "")

/** The language of the landing page at `pathname`, Czech for the bare path. */
export function landingLanguageFromPath(
  pathname: string,
  site: LandingSitePaths
): Language {
  const normalized = normalizeLandingPath(pathname)
  const match = [
    ...Object.entries(site.home),
    ...Object.entries(site.eet),
    ...Object.entries(site.tech),
  ].find(([, path]) => path === normalized)
  return LandingLanguageSchema.catch("cs").parse(match?.[0])
}

/** Whether `pathname` is the EET 2.0 page in one of its languages. */
export const isLandingEetPath = (
  pathname: string,
  site: LandingSitePaths
): boolean =>
  Object.values<string>(site.eet).includes(normalizeLandingPath(pathname))

/** Whether `pathname` is the page on how the app works in one of its languages. */
export const isLandingTechPath = (
  pathname: string,
  site: LandingSitePaths
): boolean =>
  Object.values<string>(site.tech).includes(normalizeLandingPath(pathname))
