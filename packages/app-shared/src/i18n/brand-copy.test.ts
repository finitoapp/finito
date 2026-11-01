import { describe, expect, it } from "vitest"
import { finitoBrand, paykyBrand } from "../brand.ts"
import { type Language, resources } from "./resources.ts"
import {
  brandPlaceholderNames,
  createBrandedResources,
  createTranslate,
} from "./translate.ts"

const languages = Object.keys(resources) as ReadonlyArray<Language>

const entries = (language: Language): ReadonlyArray<[string, string]> =>
  Object.entries(resources[language])

describe("brand copy", () => {
  it("names the app only through brand placeholders", () => {
    const outright = languages.flatMap((language) =>
      entries(language)
        .filter(([, text]) => /\b(?:payky|finito)\b/iu.test(text))
        .map(([key]) => `${language}: ${key}`)
    )
    expect(outright).toEqual([])
  })

  it("uses only the placeholders a brand fills", () => {
    const unknown = languages.flatMap((language) =>
      entries(language).flatMap(([key, text]) =>
        [...text.matchAll(/\{(appName\w*)\}/gu)]
          .map((match) => match[1] ?? "")
          .filter(
            (name) =>
              !(brandPlaceholderNames as ReadonlyArray<string>).includes(name)
          )
          .map((name) => `${language}: ${key}: {${name}}`)
      )
    )
    expect(unknown).toEqual([])
  })

  // "v Payky" but "ve Finitu": the vocalized form depends on the name, so
  // Czech and Slovak copy never puts one of these right before it (brand/0002).
  it("puts no name-dependent preposition before the name", () => {
    const misplaced = (["cs", "sk"] as const).flatMap((language) =>
      entries(language)
        .filter(([, text]) => /(?:^|\s)(?:v|ve|s|se)\s+\{appName/iu.test(text))
        .map(([key]) => `${language}: ${key}`)
    )
    expect(misplaced).toEqual([])
  })

  it("declines the name by the case the copy names", () => {
    const key = "accountTransfer.target.error.NotPaykyUri"
    expect(createTranslate("cs", paykyBrand)(key)).toBe("Tohle není kód Payky.")
    expect(createTranslate("cs", finitoBrand)(key)).toBe(
      "Tohle není kód Finita."
    )
    expect(createTranslate("sk", finitoBrand)(key)).toBe(
      "Toto nie je kód Finita."
    )
    expect(createTranslate("en", finitoBrand)(key)).toBe(
      "This is not a Finito code."
    )
  })

  it("fills the brand before the params", () => {
    const t = createTranslate("en", finitoBrand)
    expect(t("bill.brick.add.aria", { name: "{appName}" })).toContain(
      "{appName}"
    )
  })

  // The review copy: every branded string as Finito renders it, so a new
  // string in the wrong case reads wrong in the diff ("vývoj Finito").
  it.each(languages)("renders Finito's %s copy", async (language) => {
    const branded = createBrandedResources(language, finitoBrand)
    const lines = entries(language)
      .filter(([, text]) => text.includes("{appName"))
      .map(([key]) => `${key}: ${JSON.stringify(branded[key as never])}`)
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot(
      `./brand-copy/finito.${language}.txt`
    )
  })
})
