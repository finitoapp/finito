/**
 * Writes every landing document prerendered in every language, and the
 * sitemap and robots.txt of the brand's site (landing/0002, landing/0013,
 * landing/0006, landing/0008) from
 * the client build's `dist/landing.html` and the server bundle
 * `vite build --ssr src/landing-server.tsx` leaves in `dist-ssr`. The
 * template itself is removed, so only the filled pages are served.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const templatePath = path.join(root, "dist/landing.html")
const serverBundlePath = path.join(root, "dist-ssr/landing-server.js")

const {
  landingDocuments,
  landingFileName,
  landingLanguages,
  renderLandingDocument,
  renderRobots,
  renderSitemap,
}: typeof import("../src/landing-server.tsx") = await import(serverBundlePath)

const template = readFileSync(templatePath, "utf8")

for (const document of landingDocuments) {
  for (const language of landingLanguages) {
    writeFileSync(
      path.join(root, "dist", landingFileName(document, language)),
      renderLandingDocument(template, language, document)
    )
  }
}

writeFileSync(path.join(root, "dist/sitemap.xml"), renderSitemap())
writeFileSync(path.join(root, "dist/robots.txt"), renderRobots())

rmSync(templatePath)
rmSync(path.join(root, "dist-ssr"), { recursive: true, force: true })
