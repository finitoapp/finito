import { brandPlaceholderNames } from "@payky/app-shared/brand"
import { describe, expect, it } from "vitest"
import {
  createLandingResources,
  landingHosts,
  landingSites,
} from "@/core/landing-sites.ts"
import { type Language, resources } from "@/i18n/resources.ts"

/**
 * The landing's copy names its app as the app's own copy does (brand/0002),
 * and its hosts through placeholders too (landing/0013).
 */

const languages = Object.keys(resources) as ReadonlyArray<Language>
const placeholders: ReadonlyArray<string> = [
  ...brandPlaceholderNames,
  ...Object.keys(landingHosts(landingSites.payky)),
]

const entries = (language: Language): ReadonlyArray<[string, string]> =>
  Object.entries(resources[language])

describe("landing brand copy", () => {
  it("names the app and its hosts only through placeholders", () => {
    const outright = languages.flatMap((language) =>
      entries(language)
        .filter(([, text]) => /\b(?:payky|finito)\b/iu.test(text))
        .map(([key]) => `${language}: ${key}`)
    )
    expect(outright).toEqual([])
  })

  it("uses only the placeholders a landing fills", () => {
    const unknown = languages.flatMap((language) =>
      entries(language).flatMap(([key, text]) =>
        [...text.matchAll(/\{(\w+)\}/gu)]
          .map((match) => match[1] ?? "")
          .filter((name) => !placeholders.includes(name))
          .map((name) => `${language}: ${key}: {${name}}`)
      )
    )
    expect(unknown).toEqual([])
  })

  it("puts no name-dependent preposition before the name", () => {
    const misplaced = (["cs", "sk"] as const).flatMap((language) =>
      entries(language)
        .filter(([, text]) => /(?:^|\s)(?:v|ve|s|se)\s+\{appName/iu.test(text))
        .map(([key]) => `${language}: ${key}`)
    )
    expect(misplaced).toEqual([])
  })

  it.each(languages)("renders Finito's %s copy", async (language) => {
    const finito = createLandingResources(landingSites.finito)[language]
    const branded = entries(language)
      .filter(([, text]) => /\{\w+\}/u.test(text))
      .map(([key]) => `${key}\n${finito[key as keyof typeof finito]}\n`)
      .join("\n")
    await expect(branded).toMatchFileSnapshot(
      `./brand-copy/finito.${language}.txt`
    )
  })
})
