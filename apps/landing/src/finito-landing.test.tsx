import { describe, expect, test, vi } from "vitest"

// This build presents Finito, as the finito-landing projects build it.
vi.mock("@/core/app-env.ts", () => ({
  appEnv: {
    PAYKY_LANDING_BRAND: "finito",
    VITE_PAYKY_API_BASE_URL: undefined,
  },
}))

const { renderLandingDocument, renderRobots, renderSitemap } = await import(
  "@/landing-server.tsx"
)

const template = `<!doctype html><html lang="cs"><head><!--landing-head--></head><body><div id="root"><!--landing-app--></div></body></html>`

describe("Finito's landing", () => {
  test("lives at the root of finito.fit", () => {
    const html = renderLandingDocument(template, "cs")

    expect(html).toContain('<link rel="canonical" href="https://finito.fit/"/>')
    expect(html).toContain('hrefLang="en" href="https://finito.fit/en"')
    expect(
      renderLandingDocument(template, "sk", "eet").includes(
        '<link rel="canonical" href="https://finito.fit/sk/eet-2-0"/>'
      )
    ).toBe(true)
    expect(renderSitemap()).toContain(
      "<loc>https://finito.fit/en/jak-to-funguje</loc>"
    )
    expect(renderRobots()).toContain("Sitemap: https://finito.fit/sitemap.xml")
  })

  test("names Finito and none of Payky's hosts", () => {
    for (const document of ["home", "eet", "tech"] as const) {
      for (const language of ["cs", "en", "sk"] as const) {
        const html = renderLandingDocument(template, language, document)
        expect(html).toContain("Finito")
        expect(html).not.toMatch(/\bPayky\b|payky\.me/u)
      }
    }
  })

  test("sends visitors to the app on app.finito.fit", () => {
    const html = renderLandingDocument(template, "sk")

    expect(html).toContain('href="https://app.finito.fit/onboarding?lang=sk"')
    expect(html).toContain(
      "https://github.com/finitoapp/finito/releases/latest/download/finito-release-signed.apk"
    )
    expect(html).toContain(
      'rel="apple-touch-icon" href="https://app.finito.fit/apple-touch-icon.png"'
    )
  })

  // Installing happens in the app on its own origin; the landing has no
  // manifest to install from, and Finito is not in Zapstore.
  test("offers no install from the page and no Zapstore", () => {
    const html = renderLandingDocument(template, "en")

    expect(html).not.toContain('rel="manifest"')
    expect(html).not.toContain("zapstore.dev")
  })
})
