import { rm } from "node:fs/promises"
import type { Language } from "@payky/app-shared/i18n/resources"
import { type Browser, type BrowserContext, chromium } from "@playwright/test"
import { $ } from "bun"
import { serveMocks } from "../../e2e/scripts/mock-server.ts"
import { pointAtMocks } from "../../e2e/scripts/point-at-mocks.ts"
import { serveWeb } from "../../e2e/scripts/serve-web.ts"

/**
 * Finito's web export served over the e2e mock server, with a browser to
 * drive it: what the documentation screenshots
 * (generate-doc-screenshots.ts) and the Google Play listing
 * (generate-google-play-assets.ts) capture. The mock server's port is built
 * into the export, so each script keeps its own `webDir` and ports.
 */
export interface FinitoWeb extends AsyncDisposable {
  readonly browser: Browser
  /** A fresh app, in `language`, dark, at `viewport` and `deviceScaleFactor`. */
  readonly newContext: (options: {
    readonly language: Language
    readonly viewport: { readonly width: number; readonly height: number }
    readonly deviceScaleFactor: number
  }) => Promise<BrowserContext>
}

// The app picks its first language from the browser's.
const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  cs: "cs-CZ",
  sk: "sk-SK",
}

export async function startFinitoWeb({
  appDir,
  webDir,
  webPort,
  mockPort,
  skipBuild,
}: {
  readonly appDir: string
  readonly webDir: string
  readonly webPort: number
  readonly mockPort: number
  /** Reuses the export already in `webDir`. */
  readonly skipBuild: boolean
}): Promise<FinitoWeb> {
  pointAtMocks("127.0.0.1", mockPort)
  if (!skipBuild) {
    await rm(webDir, { recursive: true, force: true })
    await $`bun x expo export --platform web --output-dir ${webDir}`.cwd(appDir)
  }

  const mocks = serveMocks(mockPort)
  const server = serveWeb(webDir, webPort)
  const browser = await chromium.launch()

  return {
    browser,
    newContext: ({ language, viewport, deviceScaleFactor }) =>
      browser.newContext({
        baseURL: `http://127.0.0.1:${webPort}`,
        colorScheme: "dark",
        deviceScaleFactor,
        locale: localeByLanguage[language],
        reducedMotion: "reduce",
        timezoneId: "Europe/Prague",
        viewport,
      }),
    async [Symbol.asyncDispose]() {
      await browser.close()
      server.stop(true)
      mocks.stop(true)
    },
  }
}
