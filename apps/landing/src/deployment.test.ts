import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import appConfig from "../../web-app/vercel.json"
import landingConfig from "../vercel.json"
import { landingSites } from "./core/landing-sites.ts"
import {
  landingDocuments,
  landingFileName,
  landingLanguages,
  renderLandingDocument,
} from "./landing-server.tsx"

interface Rewrite {
  readonly source: string
  readonly destination: string
  readonly has?: ReadonlyArray<{
    readonly type: string
    readonly value: string
  }>
}

/** The first rewrite of `rewrites` that answers `source` on `host`. */
const rewriteFor = (
  rewrites: ReadonlyArray<Rewrite>,
  source: string,
  host: string
) =>
  rewrites.find(
    (candidate) =>
      candidate.source === source &&
      (!candidate.has ||
        candidate.has.every(
          (condition) =>
            condition.type === "host" &&
            new RegExp(`^(?:${condition.value})$`, "u").test(host)
        ))
  )

describe("landing deployment", () => {
  test("serves every prerendered language and document at its existing address", () => {
    // Payky's under /landing, Finito's at the root (landing/0013).
    for (const site of Object.values(landingSites)) {
      for (const document of landingDocuments) {
        for (const language of landingLanguages) {
          expect(landingConfig.rewrites).toContainEqual({
            source: site.paths[document][language],
            destination: `/${landingFileName(document, language)}`,
          })
        }
      }
    }
  })

  test.each([
    ["finito.fit", "https://app.finito.fit"],
    ["www.finito.fit", "https://app.finito.fit"],
    ["finito-landing.vercel.app", "https://app.finito.fit"],
    ["edge.finito.fit", "https://edge.app.finito.fit"],
    ["finito-landing-edge.vercel.app", "https://edge.app.finito.fit"],
    [
      "finito-landing-edge-epz6asvwq-josef-ks-projects.vercel.app",
      "https://edge.app.finito.fit",
    ],
  ])("answers Finito's Lightning address on %s from %s", (host, app) => {
    const source = "/.well-known/lnurlp/donate"
    expect(rewriteFor(landingConfig.rewrites, source, host)?.destination).toBe(
      `${app}${source}`
    )
  })

  test("caches the build's assets for a year, as their names change with their content", () => {
    expect(landingConfig.headers).toContainEqual({
      source: "/landing/assets/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    })
  })

  test("proxies landing pages, assets and sitemap before the app fallback", () => {
    const fallback = appConfig.rewrites.findIndex(
      (route) => route.destination === "/index.html"
    )
    for (const source of ["/landing", "/landing/:path*", "/sitemap.xml"]) {
      const index = appConfig.rewrites.findIndex(
        (route) => route.source === source
      )
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(fallback)
      expect(appConfig.rewrites[index]?.destination).toMatch(/^https:\/\//)
    }
    // The landing's own pages first, then everything else under /landing,
    // its assets on finito.fit too, from the build's root.
    const assets = landingConfig.rewrites.findIndex(
      (route) => route.source === "/landing/:path*"
    )
    expect(landingConfig.rewrites[assets]?.destination).toBe("/:path*")
    for (const path of Object.values(landingSites.payky.paths).flatMap(
      Object.values
    )) {
      expect(
        landingConfig.rewrites.findIndex((route) => route.source === path)
      ).toBeLessThan(assets)
    }
  })

  test("installs the existing app from the public origin", () => {
    const template = readFileSync(
      new URL("../landing.html", import.meta.url),
      "utf8"
    )
    const html = renderLandingDocument(template, "en")
    expect(html).toContain(
      '<link rel="manifest" href="/manifest.webmanifest"/>'
    )
    expect(html).not.toContain('href="/landing/manifest.webmanifest"')
  })

  test("serves the logo and favicon from the landing namespace", () => {
    const template = readFileSync(
      new URL("../landing.html", import.meta.url),
      "utf8"
    )
    const icon = readFileSync(
      new URL("../public/pwa-icon.svg", import.meta.url),
      "utf8"
    )
    expect(template).toContain('href="/landing/pwa-icon.svg"')
    expect(icon).toContain("<svg")
    for (const document of landingDocuments) {
      const html = renderLandingDocument(template, "en", document)
      expect(html).toContain('src="/landing/pwa-icon.svg"')
      expect(html).not.toContain('src="/pwa-icon.svg"')
    }
  })

  test.each([
    ["edge.payky.me", "payky-landing-edge"],
    ["payky-edge.vercel.app", "payky-landing-edge"],
    ["payky-edge-josef-ks-projects.vercel.app", "payky-landing-edge"],
    ["payky-edge-git-main-josef-ks-projects.vercel.app", "payky-landing-edge"],
    ["payky-edge-epz6asvwq-josef-ks-projects.vercel.app", "payky-landing-edge"],
    ["payky.me", "payky-landing"],
    ["payky-app.vercel.app", "payky-landing"],
    ["payky-josef-ks-projects.vercel.app", "payky-landing"],
    ["payky-git-production-josef-ks-projects.vercel.app", "payky-landing"],
  ])("pairs %s with %s", (host, upstream) => {
    for (const source of ["/landing", "/landing/:path*", "/sitemap.xml"]) {
      const route = appConfig.rewrites.find(
        (candidate) =>
          candidate.source === source &&
          (!candidate.has ||
            candidate.has.every(
              (condition) =>
                condition.type === "host" &&
                new RegExp(`^(?:${condition.value})$`, "u").test(host)
            ))
      )
      expect(route?.destination).toBe(`https://${upstream}.vercel.app${source}`)
    }
  })
})
