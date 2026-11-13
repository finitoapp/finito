import { afterEach, describe, expect, test, vi } from "vitest"

import {
  createLandingSitePaths,
  isLandingEetPath,
  isLandingPrivacyPath,
  isLandingTechPath,
  isLandingTerminalPath,
  landingLanguageFromPath,
  markAppEntered,
  preferredLandingLanguage,
  readInstallLanguage,
  rememberInstallLanguage,
  shouldRedirectToLanding,
} from "./landing-redirect.ts"

const paykySite = createLandingSitePaths("/landing")
const finitoSite = createLandingSitePaths("", { terminal: true })

describe("shouldRedirectToLanding", () => {
  test("sends a browser tab that never opened the app to the landing page", () => {
    expect(
      shouldRedirectToLanding({
        nativePlatform: false,
        installedPwa: false,
        appEntered: false,
      })
    ).toBe(true)
  })

  test.each([
    ["the native app", { nativePlatform: true }],
    ["an installed PWA", { installedPwa: true }],
    ["a browser that already opened the app", { appEntered: true }],
  ])("keeps %s out of the landing page", (_, overrides) => {
    expect(
      shouldRedirectToLanding({
        nativePlatform: false,
        installedPwa: false,
        appEntered: false,
        ...overrides,
      })
    ).toBe(false)
  })
})

describe("landingLanguageFromPath", () => {
  test.each([
    ["/landing", "cs"],
    ["/landing/", "cs"],
    ["/landing/en", "en"],
    ["/landing/sk/", "sk"],
    ["/landing/de", "cs"],
    ["/landing/eet-2-0", "cs"],
    ["/landing/en/eet-2-0", "en"],
    ["/landing/sk/eet-2-0/", "sk"],
    ["/landing/jak-to-funguje", "cs"],
    ["/landing/en/jak-to-funguje", "en"],
    ["/landing/privacy", "cs"],
    ["/landing/sk/privacy", "sk"],
  ] as const)("reads %s as %s", (pathname, language) => {
    expect(landingLanguageFromPath(pathname, paykySite)).toBe(language)
  })
})

describe("a landing at the domain's root", () => {
  test.each([
    ["/", "cs"],
    ["/en", "en"],
    ["/sk/", "sk"],
    ["/eet-2-0", "cs"],
    ["/en/jak-to-funguje", "en"],
    ["/en/privacy", "en"],
    ["/terminal", "cs"],
    ["/sk/terminal/", "sk"],
  ] as const)("reads %s as %s", (pathname, language) => {
    expect(landingLanguageFromPath(pathname, finitoSite)).toBe(language)
  })

  test("tells its documents apart", () => {
    expect(isLandingEetPath("/sk/eet-2-0", finitoSite)).toBe(true)
    expect(isLandingTechPath("/jak-to-funguje/", finitoSite)).toBe(true)
    expect(isLandingEetPath("/", finitoSite)).toBe(false)
    expect(isLandingTechPath("/landing/jak-to-funguje", finitoSite)).toBe(false)
    expect(isLandingPrivacyPath("/en/privacy", finitoSite)).toBe(true)
    expect(isLandingPrivacyPath("/landing/privacy", finitoSite)).toBe(false)
  })
})

describe("isLandingEetPath", () => {
  test.each([
    ["/landing/eet-2-0", true],
    ["/landing/en/eet-2-0/", true],
    ["/landing", false],
    ["/landing/en", false],
  ] as const)("reads %s as the EET page: %s", (pathname, isEet) => {
    expect(isLandingEetPath(pathname, paykySite)).toBe(isEet)
  })
})

describe("isLandingTechPath", () => {
  test.each([
    ["/landing/jak-to-funguje", true],
    ["/landing/sk/jak-to-funguje/", true],
    ["/landing/eet-2-0", false],
    ["/landing", false],
  ] as const)(
    "reads %s as the page on how Payky works: %s",
    (pathname, isTech) => {
      expect(isLandingTechPath(pathname, paykySite)).toBe(isTech)
    }
  )
})

describe("isLandingPrivacyPath", () => {
  test.each([
    ["/landing/privacy", true],
    ["/landing/en/privacy/", true],
    ["/landing/jak-to-funguje", false],
    ["/landing", false],
  ] as const)("reads %s as the privacy policy: %s", (pathname, isPrivacy) => {
    expect(isLandingPrivacyPath(pathname, paykySite)).toBe(isPrivacy)
  })
})

describe("isLandingTerminalPath", () => {
  test.each([
    ["/terminal", true],
    ["/en/terminal/", true],
    ["/sk/terminal", true],
    ["/privacy", false],
    ["/", false],
    ["/landing/terminal", false],
  ] as const)(
    "reads %s on Finito's landing as the card terminal documentation: %s",
    (pathname, isTerminal) => {
      expect(isLandingTerminalPath(pathname, finitoSite)).toBe(isTerminal)
    }
  )

  // Only Finito's landing has the document (landing/0015).
  test.each(["/landing/terminal", "/landing/en/terminal", "/terminal"])(
    "finds no card terminal documentation at %s on Payky's landing",
    (pathname) => {
      expect(paykySite.terminal).toBeUndefined()
      expect(isLandingTerminalPath(pathname, paykySite)).toBe(false)
    }
  )
})

describe("preferredLandingLanguage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const stubBrowser = (stored: string | null) => {
    vi.stubGlobal("navigator", { language: "en-US" })
    vi.stubGlobal("localStorage", { getItem: () => stored })
  }

  test("is Czech whatever the browser's language", () => {
    stubBrowser(null)
    expect(preferredLandingLanguage()).toBe("cs")
  })

  test("is the language picked on the landing page before", () => {
    stubBrowser(JSON.stringify("sk"))
    expect(preferredLandingLanguage()).toBe("sk")
  })
})

describe("install language", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const stubStorage = () => {
    const items = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    })
  }

  test("keeps the language the app was installed in until onboarding opens", () => {
    stubStorage()
    expect(readInstallLanguage()).toBeUndefined()

    rememberInstallLanguage("sk")
    expect(readInstallLanguage()).toBe("sk")
    expect(readInstallLanguage()).toBe("sk")

    markAppEntered()
    expect(readInstallLanguage()).toBeUndefined()
  })
})
