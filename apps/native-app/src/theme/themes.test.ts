import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"
import { appThemes } from "./themes"

/**
 * The splash (`app.config.ts`), the PWA shell (`public/index.html`) and the
 * installed PWA's manifest paint the page and the system bar before the app
 * does, with the theme's `background` written out as a literal; this keeps
 * them on it when the theme moves. Once running, the app sets the bar itself
 * (`src/platform/browser-theme-color.web.ts`).
 */

const appDir = path.resolve(import.meta.dirname, "../..")
const read = (file: string) => readFileSync(path.join(appDir, file), "utf8")

test("the splash paints each theme's background", () => {
  const config = read("app.config.ts")
  expect(config).toContain(`backgroundColor: "${appThemes.light.background}"`)
  expect(config).toContain(
    `dark: { image: "./assets/app-icon.png", backgroundColor: "${appThemes.dark.background}" }`
  )
})

test("the PWA shell paints each theme's background", () => {
  const html = read("public/index.html")
  for (const [mode, theme] of Object.entries(appThemes)) {
    expect(html).toContain(
      `<meta name="theme-color" content="${theme.background}" media="(prefers-color-scheme: ${mode})" />`
    )
    expect(html).toContain(`background: ${theme.background};`)
  }
})

test("the installed PWA's manifest paints the dark page", () => {
  // A manifest takes one color, not one per scheme, so it takes the dark
  // page: the launch splash and the bar until the shell's `theme-color`
  // takes over.
  const manifest = JSON.parse(read("public/manifest.webmanifest"))
  expect(manifest.background_color).toBe(appThemes.dark.background)
  expect(manifest.theme_color).toBe(appThemes.dark.background)
})
