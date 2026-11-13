import { describe, expect, test, vi } from "vitest"

// This build presents Finito, as the finito-landing projects build it.
vi.mock("@/core/app-env.ts", () => ({
  appEnv: {
    PAYKY_LANDING_BRAND: "finito",
    VITE_PAYKY_API_BASE_URL: undefined,
  },
}))

const { landingDocuments, renderLandingDocument, renderRobots, renderSitemap } =
  await import("@/landing-server.tsx")
const { landingResources } = await import("@/core/landing-site.ts")

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
    for (const document of [
      "home",
      "eet",
      "tech",
      "privacy",
      "terminal",
    ] as const) {
      for (const language of ["cs", "en", "sk"] as const) {
        const html = renderLandingDocument(template, language, document)
        expect(html).toContain("Finito")
        expect(html).not.toMatch(/\bPayky\b|payky\.me/u)
      }
    }
  })

  // The address Google Play's listing links to, which must show the policy
  // itself rather than a page leading to it (landing/0014).
  test("serves its privacy policy at finito.fit/en/privacy", () => {
    const html = renderLandingDocument(template, "en", "privacy")

    expect(html).toContain(
      '<link rel="canonical" href="https://finito.fit/en/privacy"/>'
    )
    expect(html).toContain("Finito Privacy Policy")
    expect(html).toContain("1. DATA COLLECTION")
    expect(html).toContain('href="https://finito.fit/en#contact"')
  })

  // The documentation Comgate certifies Finito by, Finito's alone
  // (landing/0015).
  test("serves its card terminal documentation at finito.fit/terminal", () => {
    expect(landingDocuments).toContain("terminal")
    const html = renderLandingDocument(template, "cs", "terminal")
    const body = html.split("<body>")[1]
    const data: unknown = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">(.*?)<\/script>/su
      )?.[1] ?? "null"
    )

    expect(html).toContain(
      '<link rel="canonical" href="https://finito.fit/terminal"/>'
    )
    expect(html).toContain(
      '<link rel="alternate" hrefLang="sk" href="https://finito.fit/sk/terminal"/>'
    )
    expect(html).toContain(
      `<title>${landingResources.cs["landing.terminal.meta.title"]}</title>`
    )
    expect(data).toEqual([
      expect.objectContaining({
        "@type": "FAQPage",
        mainEntity: expect.arrayContaining([
          expect.objectContaining({
            name: landingResources.cs[
              "landing.terminal.faq.cardNumber.question"
            ],
          }),
        ]),
      }),
    ])
    expect(body).toContain(
      landingResources.cs["landing.terminal.faq.cardNumber.answer"]
    )
    // The app's own labels, as the screenshots show them.
    expect(body).toContain(landingResources.cs["paymentWait.cardPaid.action"])
    expect(renderSitemap()).toContain(
      "<loc>https://finito.fit/en/terminal</loc>"
    )
    for (const document of landingDocuments) {
      const footer = renderLandingDocument(template, "en", document)
        .split("<body>")[1]
        ?.split("<footer")[1]
      expect(footer).toContain('href="/en/terminal"')
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
