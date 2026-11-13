import type { ReactNode } from "react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { landingFontPreloads } from "@/core/landing-font-preloads.ts"
import {
  installsFromLanding,
  landingResources,
  landingSite,
} from "@/core/landing-site.ts"
import {
  eetFaqItems,
  LandingEetPage,
} from "@/features/landing/landing-eet-page.tsx"
import {
  type FaqItem,
  faqItems,
  githubUrl,
  LandingPage,
} from "@/features/landing/landing-page.tsx"
import { LandingPrivacyPage } from "@/features/landing/landing-privacy-page.tsx"
import {
  LandingTechPage,
  techFaqItems,
} from "@/features/landing/landing-tech-page.tsx"
import type { Language, TranslationKey } from "@/i18n/resources.ts"

const { siteUrl } = landingSite

/**
 * The app's own origin, which serves its icons and manifest: payky.me for
 * Payky's landing, which lives there, app.finito.fit for Finito's.
 */
const appUrl = landingSite.appOrigin ?? siteUrl

export const landingLanguages = Object.keys(
  landingSite.paths.home
) as ReadonlyArray<Language>

/**
 * The prerendered landing documents: the home page, the EET 2.0 page, the
 * page on how the app works and the privacy policy.
 */
export type LandingDocument = "home" | "eet" | "tech" | "privacy"

export const landingDocuments: ReadonlyArray<LandingDocument> = [
  "home",
  "eet",
  "tech",
  "privacy",
]

/** The file each document is written to, which `vercel.json` serves. */
export const landingFileName = (
  document: LandingDocument,
  language: Language
): string =>
  document === "home"
    ? `landing-${language}.html`
    : `landing-${document}-${language}.html`

const documentPaths = landingSite.paths satisfies Record<
  LandingDocument,
  Readonly<Record<Language, string>>
>

const documentMeta = {
  home: {
    title: "landing.meta.title",
    description: "landing.meta.description",
  },
  eet: {
    title: "landing.eet.meta.title",
    description: "landing.eet.meta.description",
  },
  tech: {
    title: "landing.tech.meta.title",
    description: "landing.tech.meta.description",
  },
  privacy: {
    title: "landing.privacy.meta.title",
    description: "landing.privacy.meta.description",
  },
} satisfies Record<
  LandingDocument,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

const pageUrl = (document: LandingDocument, language: Language) =>
  `${siteUrl}${documentPaths[document][language]}`

const ogLocales = {
  cs: "cs_CZ",
  en: "en_US",
  sk: "sk_SK",
} satisfies Record<Language, string>

// Made from the Twitter header, which has no Slovak version yet.
const ogImages = {
  cs: "/landing/og-cs.png",
  en: "/landing/og-en.png",
  sk: "/landing/og-cs.png",
} satisfies Record<Language, string>

const faqStructuredData = (
  language: Language,
  items: ReadonlyArray<FaqItem>
) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: language,
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: landingResources[language][item.question],
    acceptedAnswer: {
      "@type": "Answer",
      text: landingResources[language][item.answer],
    },
  })),
})

/**
 * Structured data for search results: who makes the app, the app with its
 * price and downloads, and the page's FAQ, whose answers the page shows too.
 * The EET page and the page on how the app works describe only their own FAQ;
 * the privacy policy has none.
 */
const structuredData = {
  home: (language) => {
    const t = landingResources[language]
    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: t["app.name"],
        url: pageUrl("home", language),
        logo: `${appUrl}/pwa-icon-512.png`,
        sameAs: [githubUrl],
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: t["app.name"],
        description: t["landing.meta.description"],
        url: pageUrl("home", language),
        image: `${siteUrl}${ogImages[language]}`,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Android, Web",
        downloadUrl: landingSite.apkUrl,
        installUrl: landingSite.zapstoreUrl ?? undefined,
        inLanguage: language,
        offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" },
      },
      faqStructuredData(language, faqItems),
    ]
  },
  eet: (language) => [faqStructuredData(language, eetFaqItems)],
  tech: (language) => [faqStructuredData(language, techFaqItems)],
  privacy: () => [],
} satisfies Record<
  LandingDocument,
  (language: Language) => ReadonlyArray<object>
>

// Inside a <script>, so nothing in the copy may close it.
const scriptJson = (data: ReadonlyArray<object>) =>
  JSON.stringify(data).replaceAll("<", "\\u003c")

/** What a crawler and a link preview read before any script runs. */
function LandingHead({
  document,
  language,
}: {
  readonly document: LandingDocument
  readonly language: Language
}) {
  const t = landingResources[language]
  const data = structuredData[document](language)
  const title = t[documentMeta[document].title]
  const description = t[documentMeta[document].description]

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {/* Before anything else, so the text is in Manrope by its first paint. */}
      {landingFontPreloads[language].map((href) => (
        <link
          key={href}
          rel="preload"
          href={href}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      ))}
      <link rel="canonical" href={pageUrl(document, language)} />
      {landingLanguages.map((alternate) => (
        <link
          key={alternate}
          rel="alternate"
          hrefLang={alternate}
          href={pageUrl(document, alternate)}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={pageUrl(document, "cs")}
      />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={t["app.name"]} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={pageUrl(document, language)} />
      <meta property="og:locale" content={ogLocales[language]} />
      {landingLanguages
        .filter((alternate) => alternate !== language)
        .map((alternate) => (
          <meta
            key={alternate}
            property="og:locale:alternate"
            content={ogLocales[alternate]}
          />
        ))}
      <meta property="og:image" content={`${siteUrl}${ogImages[language]}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta name="twitter:card" content="summary_large_image" />
      <link
        rel="apple-touch-icon"
        href={`${landingSite.appOrigin ?? ""}/apple-touch-icon.png`}
      />
      {/* The app's own manifest, so the browser can install it from here
          (landing/0005), where the landing shares its origin (landing/0013). */}
      {installsFromLanding ? (
        <link rel="manifest" href="/manifest.webmanifest" />
      ) : null}
      {data.length === 0 ? null : (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON built here, `<` escaped.
          dangerouslySetInnerHTML={{ __html: scriptJson(data) }}
        />
      )}
    </>
  )
}

const documentPages = {
  home: LandingPage,
  eet: LandingEetPage,
  tech: LandingTechPage,
  privacy: LandingPrivacyPage,
} satisfies Record<
  LandingDocument,
  (props: { readonly language: Language }) => ReactNode
>

/**
 * Fills the built `landing.html` with `document` in `language` (landing/0002,
 * landing/0006, landing/0008, landing/0014): `bin/prerender-landing.ts` writes one file per document and
 * language from it.
 */
export function renderLandingDocument(
  template: string,
  language: Language,
  document: LandingDocument = "home"
): string {
  const Page = documentPages[document]
  return template
    .replace(/<html lang="[^"]*"/u, `<html lang="${language}"`)
    .replace(
      "<!--landing-head-->",
      renderToStaticMarkup(
        <LandingHead document={document} language={language} />
      )
    )
    .replace("<!--landing-app-->", renderToString(<Page language={language} />))
}

/**
 * Every landing document in every language with its alternates, under the
 * brand's own site (landing/0013), which the prerender writes to
 * `sitemap.xml`.
 */
export function renderSitemap(): string {
  const alternates = (document: LandingDocument) =>
    [
      ...landingLanguages.map(
        (language) =>
          `    <xhtml:link rel="alternate" hreflang="${language}" href="${pageUrl(document, language)}"/>`
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(document, "cs")}"/>`,
    ].join("\n")
  const urls = landingDocuments.flatMap((document) =>
    landingLanguages.map((language) =>
      [
        "  <url>",
        `    <loc>${pageUrl(document, language)}</loc>`,
        alternates(document),
        "  </url>",
      ].join("\n")
    )
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n")
}

/**
 * The landing's own `robots.txt`, which only a landing at its domain's root
 * serves; payky.me's comes from the web app.
 */
export const renderRobots = (): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
