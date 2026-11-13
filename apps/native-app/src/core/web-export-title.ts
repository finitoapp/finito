import { jsonCodec } from "@payky/core/zod-utils"
import { z } from "zod"

/**
 * Writes the name an installed PWA shows (`appTitle`, brand/0005) into the
 * files Expo's web export copies from `public/`, which name plain Finito.
 * `scripts/build-web.ts` runs these on the export. A field the source no longer
 * has is an error rather than a skipped rewrite, so a changed `index.html` or
 * manifest fails the build instead of shipping every channel as Finito.
 */

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const replaceOnce = (
  html: string,
  pattern: RegExp,
  replacement: string,
  what: string
): string => {
  const count = html.match(new RegExp(pattern, "gu"))?.length ?? 0
  if (count !== 1) {
    throw new Error(`index.html has ${count} ${what}, expected exactly one`)
  }
  return html.replace(pattern, replacement)
}

/** Sets the page's `<title>` and the title iOS gives it on a home screen. */
export const retitleIndexHtml = (html: string, title: string): string => {
  const text = escapeHtml(title)
  return replaceOnce(
    replaceOnce(
      html,
      /<title>[^<]*<\/title>/u,
      `<title>${text}</title>`,
      "<title> elements"
    ),
    /<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/u,
    `<meta name="apple-mobile-web-app-title" content="${text}" />`,
    "apple-mobile-web-app-title metas"
  )
}

const WebManifestJson = jsonCodec(
  z.looseObject({ name: z.string(), short_name: z.string() })
)

/** Sets the manifest's `name` and `short_name`, keeping every other field. */
export const retitleWebManifest = (text: string, title: string): string => {
  const manifest = z.safeDecode(WebManifestJson, text)
  if (!manifest.success) {
    throw new Error(
      `manifest.webmanifest has no name to set: ${z.prettifyError(manifest.error)}`
    )
  }
  return z.encode(WebManifestJson, {
    ...manifest.data,
    name: title,
    short_name: title,
  })
}
