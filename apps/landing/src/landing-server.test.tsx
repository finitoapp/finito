import { readFileSync } from "node:fs"
import { applyBrandName } from "@payky/app-shared/brand"
import { enSettings } from "@payky/app-shared/i18n/en/settings"
import { describe, expect, test } from "vitest"
import {
  landingSite,
  landingResources as resources,
} from "@/core/landing-site.ts"
import { transparencyProof } from "@/features/landing/landing-tech-page.tsx"
import {
  landingDocuments,
  renderLandingDocument,
  renderSitemap,
} from "@/landing-server.tsx"

const template = `<!doctype html><html lang="cs"><head><!--landing-head--></head><body><div id="root"><!--landing-app--></div></body></html>`

describe("renderLandingDocument", () => {
  test.each([
    ["cs", "https://payky.me/landing"],
    ["en", "https://payky.me/landing/en"],
    ["sk", "https://payky.me/landing/sk"],
  ] as const)(
    "prerenders the page in %s at its own address",
    (language, url) => {
      const document = renderLandingDocument(template, language)

      expect(document).toContain(`<html lang="${language}"`)
      expect(document).toContain(`<link rel="canonical" href="${url}"/>`)
      expect(document).toContain(resources[language]["landing.faq.title"])
      expect(document).not.toContain("<!--landing-app-->")
    }
  )

  test("preloads the Manrope faces its language's text needs", () => {
    const preloads = (language: "cs" | "en" | "sk") =>
      [
        ...renderLandingDocument(template, language).matchAll(
          /<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin="anonymous"\/>/gu
        ),
      ].map((match) => match[1])

    for (const language of ["cs", "en", "sk"] as const) {
      expect(
        preloads(language).filter((href) => href?.includes("manrope-latin-"))
      ).toHaveLength(language === "en" ? 3 : 6)
    }
    expect(
      preloads("en").some((href) => href?.includes("manrope-latin-ext-"))
    ).toBe(false)
  })

  test("links every language's page to the others", () => {
    const document = renderLandingDocument(template, "cs")

    expect(document).toContain(
      `<link rel="alternate" hrefLang="en" href="https://payky.me/landing/en"/>`
    )
    expect(document).toContain(
      `<link rel="alternate" hrefLang="sk" href="https://payky.me/landing/sk"/>`
    )
    expect(document).toContain(
      `<link rel="alternate" hrefLang="x-default" href="https://payky.me/landing"/>`
    )
  })

  test("describes the app and the page's FAQ for search results", () => {
    const document = renderLandingDocument(template, "sk")
    const json = document.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/su
    )?.[1]
    const data: unknown = JSON.parse(json ?? "null")

    expect(data).toEqual([
      expect.objectContaining({
        "@type": "Organization",
        sameAs: ["https://github.com/finitoapp/finito"],
      }),
      expect.objectContaining({
        "@type": "SoftwareApplication",
        offers: expect.objectContaining({ price: "0" }),
      }),
      expect.objectContaining({
        "@type": "FAQPage",
        mainEntity: expect.arrayContaining([
          expect.objectContaining({
            name: resources.sk["landing.faq.money.question"],
          }),
        ]),
      }),
    ])
    expect(document).toContain(
      `<meta property="og:image" content="https://payky.me/landing/og-cs.png"/>`
    )
  })

  test("shows the FAQ answers its structured data names", () => {
    const document = renderLandingDocument(template, "cs")
    const body = document.slice(document.indexOf("<body>"))

    expect(body).toContain(resources.cs["landing.faq.money.answer"])
  })

  test("titles each page for search results with its own copy", () => {
    const document = renderLandingDocument(template, "cs")

    expect(document).toContain(
      `<title>${resources.cs["landing.meta.title"]}</title>`
    )
    expect(document).toContain(
      `<meta name="description" content="${resources.cs["landing.meta.description"]}"/>`
    )
  })

  test("offers a native and a web-based way into the app", () => {
    const document = renderLandingDocument(template, "en")

    for (const key of [
      "landing.closing.get.native.title",
      "landing.closing.get.native.action",
      "landing.closing.get.webBased.title",
      "landing.closing.get.webBased.action",
    ] as const) {
      expect(document).toContain(resources.en[key])
    }
  })

  test.each([
    ["cs", "https://payky.me/landing/eet-2-0"],
    ["en", "https://payky.me/landing/en/eet-2-0"],
    ["sk", "https://payky.me/landing/sk/eet-2-0"],
  ] as const)(
    "prerenders the EET page in %s at its own address",
    (language, url) => {
      const document = renderLandingDocument(template, language, "eet")

      expect(document).toContain(`<html lang="${language}"`)
      expect(document).toContain(`<link rel="canonical" href="${url}"/>`)
      expect(document).toContain(
        `<title>${resources[language]["landing.eet.meta.title"]}</title>`
      )
      expect(document).toContain(resources[language]["landing.eet.hero.title"])
    }
  )

  test("links the EET page's languages to each other", () => {
    const document = renderLandingDocument(template, "cs", "eet")

    expect(document).toContain(
      `<link rel="alternate" hrefLang="en" href="https://payky.me/landing/en/eet-2-0"/>`
    )
    expect(document).toContain(
      `<link rel="alternate" hrefLang="x-default" href="https://payky.me/landing/eet-2-0"/>`
    )
  })

  test("describes the EET page's FAQ for search results and shows its answers", () => {
    const document = renderLandingDocument(template, "cs", "eet")
    const json = document.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/su
    )?.[1]
    const data: unknown = JSON.parse(json ?? "null")

    expect(data).toEqual([
      expect.objectContaining({
        "@type": "FAQPage",
        mainEntity: expect.arrayContaining([
          expect.objectContaining({
            name: resources.cs["landing.eet.faq.offline.question"],
          }),
        ]),
      }),
    ])
    expect(document.slice(document.indexOf("<body>"))).toContain(
      resources.cs["landing.eet.faq.offline.answer"]
    )
  })

  test("names where the EET page's facts come from", () => {
    const body = renderLandingDocument(template, "cs", "eet").split("<body>")[1]

    expect(body).toContain(resources.cs["landing.eet.source"])
    expect(body).toContain(`href="https://eet.gov.cz"`)
  })

  test("leads from the home page to the EET page", () => {
    const body = renderLandingDocument(template, "en").split("<body>")[1]

    expect(body).toContain(`href="/landing/en/eet-2-0"`)
  })

  test.each([
    ["cs", "https://payky.me/landing/jak-to-funguje"],
    ["en", "https://payky.me/landing/en/jak-to-funguje"],
    ["sk", "https://payky.me/landing/sk/jak-to-funguje"],
  ] as const)(
    "prerenders the page on how Payky works in %s at its own address",
    (language, url) => {
      const document = renderLandingDocument(template, language, "tech")
      // React writes an apostrophe in the copy as an entity.
      const html = (text: string) => text.replaceAll("'", "&#x27;")

      expect(document).toContain(`<link rel="canonical" href="${url}"/>`)
      expect(document).toContain(
        `<title>${html(resources[language]["landing.tech.meta.title"])}</title>`
      )
      expect(document).toContain(
        html(resources[language]["landing.tech.hero.title"])
      )
    }
  )

  test("links the languages of the page on how Payky works to each other", () => {
    const document = renderLandingDocument(template, "cs", "tech")

    expect(document).toContain(
      `<link rel="alternate" hrefLang="en" href="https://payky.me/landing/en/jak-to-funguje"/>`
    )
    expect(document).toContain(
      `<link rel="alternate" hrefLang="x-default" href="https://payky.me/landing/jak-to-funguje"/>`
    )
  })

  test("describes the FAQ of the page on how Payky works for search results and shows its answers", () => {
    const document = renderLandingDocument(template, "cs", "tech")

    expect(document).toContain(
      JSON.stringify(resources.cs["landing.tech.faq.signup.question"])
    )
    expect(document.split("<body>")[1]).toContain(
      resources.cs["landing.tech.faq.signup.answer"]
    )
  })

  test("lists every service the app talks to on the page on how Payky works", () => {
    const body = renderLandingDocument(template, "en", "tech").split(
      "<body>"
    )[1]

    for (const key of [
      "landing.tech.services.relay.name",
      "landing.tech.services.ai.name",
      "landing.tech.services.linky.name",
      "landing.tech.services.bank.name",
      "landing.tech.services.sentry.name",
      "landing.tech.services.cashuMints.name",
      "landing.tech.services.linkyWallet.name",
    ] as const) {
      expect(body).toContain(resources.en[key])
    }
    expect(body).toContain(`href="https://github.com/finitoapp/finito"`)
  })

  test("follows a claim of the page on how Payky works to the decision and the test that hold it", () => {
    const body = renderLandingDocument(template, "en", "tech").split(
      "<body>"
    )[1]
    const enforcedBy = readFileSync(
      new URL(`../../../${transparencyProof.decision}`, import.meta.url),
      "utf8"
    ).split("## Enforced by")[1]

    expect(enforcedBy).toContain(
      `${transparencyProof.test} > ${transparencyProof.testName}`
    )
    expect(body).toContain(
      `href="https://github.com/finitoapp/finito/blob/main/${transparencyProof.decision}"`
    )
    expect(body).toContain(
      `href="https://github.com/finitoapp/finito/blob/main/${transparencyProof.test}"`
    )
  })

  test("ends only the home page with installing and contact, and leads to the contact form from the menu", () => {
    const home = renderLandingDocument(template, "en").split("<body>")[1]
    expect(home).toContain(`id="contact"`)

    for (const document of ["eet", "tech"] as const) {
      const body = renderLandingDocument(template, "en", document).split(
        "<body>"
      )[1]
      expect(body).not.toContain(`id="get-started"`)
      expect(body).toContain(`href="/landing/en#contact"`)
    }
  })

  test("leads from the home page and the footer of every landing page to the page on how Payky works", () => {
    const link = `href="/landing/en/jak-to-funguje"`

    for (const document of ["home", "eet", "tech"] as const) {
      const body = renderLandingDocument(template, "en", document).split(
        "<body>"
      )[1]
      const header = body?.split("</header>")[0]
      const footer = body?.split("<footer")[1]

      expect(header).not.toContain(link)
      expect(footer).toContain(link)
    }
  })

  test("offers a menu of the landing pages, marking the one shown", () => {
    const body = renderLandingDocument(template, "sk", "eet").split("<body>")[1]

    expect(body).toContain(
      `href="/landing/sk" data-label="${resources.sk["landing.menu.home"]}"`
    )
    expect(body).toContain(`href="/landing/sk/eet-2-0" aria-current="page"`)
  })

  test.each([
    ["cs", "https://payky.me/landing/privacy"],
    ["en", "https://payky.me/landing/en/privacy"],
    ["sk", "https://payky.me/landing/sk/privacy"],
  ] as const)(
    "prerenders the privacy policy in %s at its own address",
    (language, url) => {
      const document = renderLandingDocument(template, language, "privacy")

      expect(document).toContain(`<link rel="canonical" href="${url}"/>`)
      expect(document).toContain(
        `<title>${resources[language]["landing.privacy.meta.title"]}</title>`
      )
      expect(document.split("<body>")[1]).toContain(
        resources[language]["settings.about.privacy.heading"]
      )
    }
  )

  test("prerenders the privacy policy the app shows, every line of it", () => {
    const body = renderLandingDocument(template, "en", "privacy").split(
      "<body>"
    )[1]
    // React escapes the text it renders.
    const html = (text: string) =>
      text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("'", "&#x27;")
    const policy = applyBrandName(
      enSettings["settings.about.privacy.body"],
      landingSite.brand.names.en
    ).replaceAll("{websiteUrl}", landingSite.brand.websiteUrl)
    // The text's own title line gives way to the page's heading.
    const lines = policy
      .split("\n")
      .slice(1)
      .map((line) => line.replace(/^- /u, ""))
      .filter((line) => line !== "")

    expect(lines.length).toBeGreaterThan(10)
    for (const line of lines) {
      // An address in the line is a link of its own.
      expect(body?.replaceAll(/<[^>]*>/gu, "")).toContain(html(line))
    }
    expect(body).toContain(`<h2 class="text-xl font-bold tracking-tight">1. `)
    expect(body).not.toContain('type="application/ld+json"')
  })

  test("leads from the privacy policy to the contact form", () => {
    const body = renderLandingDocument(template, "en", "privacy").split(
      "<body>"
    )[1]

    expect(body).toContain(`href="https://payky.me/landing/en#contact"`)
  })

  // Payky integrates neither the reversal, the refund nor the closure, so
  // its landing has no card terminal documentation (landing/0015).
  test("keeps the card terminal documentation to Finito's landing", () => {
    expect(landingDocuments).not.toContain("terminal")
    expect(renderSitemap()).not.toContain("terminal")
    for (const document of landingDocuments) {
      const body = renderLandingDocument(template, "en", document).split(
        "<body>"
      )[1]
      expect(body).not.toContain("/terminal")
    }
  })

  test("leads from the footer of every landing page to the privacy policy", () => {
    const link = `href="/landing/en/privacy"`

    for (const document of ["home", "eet", "tech", "privacy"] as const) {
      const footer = renderLandingDocument(template, "en", document)
        .split("<body>")[1]
        ?.split("<footer")[1]

      expect(footer).toContain(link)
    }
  })
})
