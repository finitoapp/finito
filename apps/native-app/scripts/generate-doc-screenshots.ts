// Generates Finito's documentation screenshots and phone mockups:
// `bun run docs:screenshots:native` (root). Builds the web export pointed at
// the e2e mock server (e2e/scripts/point-at-mocks.ts), drives it with
// Playwright in every language at the capture viewport the web app's
// screenshots use, and composes each capture through @payky/doc-mockups into
// docs/screenshots/<language>/<shot>.png and docs/mockup/<language>/<shot>.webp.
// PAYKY_SCREENSHOT_SCENARIOS=home,stats regenerates only those scenarios;
// PAYKY_SCREENSHOT_SKIP_BUILD=1 reuses the last export.
import { mkdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { type Language, resources } from "@payky/app-shared/i18n/resources"
import { composeMockup } from "@payky/doc-mockups/compose-mockup"
import {
  captureHeight,
  captureWidth,
  deviceScaleFactor,
} from "@payky/doc-mockups/phone-frame-geometry"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { palette } from "../src/theme/palette.ts"
import {
  resetDocumentScroll,
  type Shoot,
  scenarios,
} from "./screenshots/finito-scenarios.ts"
import { startFinitoWeb } from "./screenshots/finito-web.ts"

const env = createEnv({
  server: {
    PAYKY_SCREENSHOT_SCENARIOS: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name !== "")
      )
      .optional(),
    PAYKY_SCREENSHOT_SKIP_BUILD: z.stringbool().default(false),
    // Not the e2e runner's ports, so both can run at once.
    PAYKY_SCREENSHOT_WEB_PORT: z.coerce.number().int().default(8793),
    PAYKY_SCREENSHOT_MOCK_PORT: z.coerce.number().int().default(8794),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

const appDir = resolve(import.meta.dirname, "..")
const rawScreenshotsDirectory = join(appDir, ".tmp/docs-screenshots")
const screenshotsDirectory = join(appDir, "docs/screenshots")
const mockupsDirectory = join(appDir, "docs/mockup")

const documentationLanguages = Object.keys(resources) as Language[]

const selectedScenarios =
  env.PAYKY_SCREENSHOT_SCENARIOS === undefined
    ? scenarios
    : scenarios.filter((scenario) =>
        env.PAYKY_SCREENSHOT_SCENARIOS?.includes(scenario.name)
      )

if (selectedScenarios.length === 0) {
  throw new Error(
    `No screenshot scenario matched: ${env.PAYKY_SCREENSHOT_SCENARIOS?.join(", ") ?? ""}.`
  )
}

async function run(): Promise<void> {
  await rm(rawScreenshotsDirectory, { recursive: true, force: true })
  await using web = await startFinitoWeb({
    appDir,
    webDir: join(appDir, ".tmp/docs-web"),
    webPort: env.PAYKY_SCREENSHOT_WEB_PORT,
    mockPort: env.PAYKY_SCREENSHOT_MOCK_PORT,
    skipBuild: env.PAYKY_SCREENSHOT_SKIP_BUILD,
  })

  try {
    for (const language of documentationLanguages) {
      await Promise.all(
        [rawScreenshotsDirectory, screenshotsDirectory, mockupsDirectory].map(
          (directory) => mkdir(`${directory}/${language}`, { recursive: true })
        )
      )

      for (const scenario of selectedScenarios) {
        console.info(
          `Generating ${language} documentation screenshot: ${scenario.name}`
        )
        // A context of its own: a fresh app, onboarded anew.
        const context = await web.newContext({
          language,
          viewport: { width: captureWidth, height: captureHeight },
          deviceScaleFactor,
        })
        const page = await context.newPage()
        const shoot: Shoot = async (name, prepare) => {
          await prepare?.(page)
          await resetDocumentScroll(page)
          const rawPath = `${rawScreenshotsDirectory}/${language}/${name}.png`
          await page.screenshot({ path: rawPath })
          await composeMockup({
            rawPath,
            screenshotPath: `${screenshotsDirectory}/${language}/${name}.png`,
            mockupPath: `${mockupsDirectory}/${language}/${name}.webp`,
            background: palette.dark.background,
          })
        }

        try {
          await scenario.capture(page, language, shoot)
        } finally {
          await context.close()
        }
      }
    }
  } finally {
    await rm(rawScreenshotsDirectory, { recursive: true, force: true })
  }
}

await run()
