// Generates the graphics of Finito's Google Play listing: `bun run
// google-play:assets` (root). Writes them, never committed, into
// .tmp/google-play/<locale>/images/ in the layout fastlane supply uploads
// (icon.png, featureGraphic.png, phoneScreenshots/, sevenInchScreenshots/,
// tenInchScreenshots/), one folder per listing language.
//
// The screenshots are the documentation's scenarios
// (scripts/screenshots/finito-scenarios.ts) over the web export on the e2e
// mock server, each driven once per language in a phone-sized viewport and
// shot at every device's viewport in turn. The icon is the PWA coin on the
// app's dark background, the feature graphic the landing's headline beside
// the payment mockup of docs/mockup.
//
// PAYKY_GOOGLE_PLAY_DEVICES=phone,tenInch shoots only those devices;
// PAYKY_GOOGLE_PLAY_SCENARIOS=home,stats only those scenarios (the other
// screenshots already there stay); PAYKY_GOOGLE_PLAY_SKIP_BUILD=1 reuses the
// last export.
import { Buffer } from "node:buffer"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { brandName, finitoBrand } from "@payky/app-shared/brand"
import { type Language, resources } from "@payky/app-shared/i18n/resources"
import type { ShotName } from "@payky/doc-mockups/compose-mockup"
import type { Page } from "@playwright/test"
import { createEnv } from "@t3-oss/env-core"
import sharp from "sharp"
import { z } from "zod"
import { resources as landingResources } from "../../landing/src/i18n/resources.ts"
import { appThemes } from "../src/theme/themes.ts"
import {
  resetDocumentScroll,
  type Shoot,
  scenarioShots,
  scenarios,
} from "./screenshots/finito-scenarios.ts"
import { startFinitoWeb } from "./screenshots/finito-web.ts"

/**
 * The listing's screenshot slots. Google Play takes up to eight per device,
 * at most 2:1 and 3840 px on a phone or a 7-inch tablet; it features an app
 * with at least four of 1080 px or more on their short side, and a tablet
 * one with 16:9 or 9:16 ones. Shot at `deviceScaleFactor`, every viewport
 * here clears 1080 px and stays within 3840. `shots` is the listing's order.
 *
 * The phone is as tall as 2:1 allows, close to today's phones, so the
 * payment's QR and its actions fit together. It and the 7-inch tablet draw
 * Finito's phone layout; the 10-inch tablet, held landscape, its navigation
 * rail with the detail beside the list (navigation/0002).
 */
const devices = {
  phone: {
    folder: "phoneScreenshots",
    viewport: { width: 405, height: 800 },
    shots: [
      "payment",
      "paid",
      "home",
      "tables",
      "bill",
      "split",
      "stats",
      "stats-charts",
    ],
  },
  sevenInch: {
    folder: "sevenInchScreenshots",
    viewport: { width: 603, height: 1072 },
    shots: [
      "payment",
      "paid",
      "home",
      "tables",
      "bill",
      "split",
      "stats",
      "stats-charts",
    ],
  },
  tenInch: {
    folder: "tenInchScreenshots",
    viewport: { width: 1280, height: 720 },
    shots: [
      "payment",
      "paid",
      "home",
      "tables",
      "table-bill",
      "split",
      "stats",
      "items",
    ],
  },
} as const satisfies Record<
  string,
  {
    readonly folder: string
    readonly viewport: { readonly width: number; readonly height: number }
    readonly shots: ReadonlyArray<ShotName>
  }
>
type Device = keyof typeof devices
type DeviceSpec = (typeof devices)[Device]

const deviceScaleFactor = 3

/** Google Play's listing locale of each app language. */
const listingLocaleByLanguage: Record<Language, string> = {
  en: "en-US",
  cs: "cs-CZ",
  sk: "sk",
}

const listFromCommas = z.string().transform((value) =>
  value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "")
)

const env = createEnv({
  server: {
    PAYKY_GOOGLE_PLAY_DEVICES: listFromCommas
      .pipe(z.array(z.enum(Object.keys(devices) as [Device, ...Device[]])))
      .optional(),
    PAYKY_GOOGLE_PLAY_SCENARIOS: listFromCommas.optional(),
    PAYKY_GOOGLE_PLAY_SKIP_BUILD: z.stringbool().default(false),
    // Neither the e2e runner's ports nor the documentation's, so all three
    // can run at once.
    PAYKY_GOOGLE_PLAY_WEB_PORT: z.coerce.number().int().default(8795),
    PAYKY_GOOGLE_PLAY_MOCK_PORT: z.coerce.number().int().default(8796),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

const appDir = resolve(import.meta.dirname, "..")
const outputDirectory = join(appDir, ".tmp/google-play")
const coinSvgPath = join(appDir, "public/pwa-icon.svg")
const languages = Object.keys(resources) as Language[]
const background = appThemes.dark.background
const gold = appThemes.dark.primary

const selectedDevices = (env.PAYKY_GOOGLE_PLAY_DEVICES ??
  (Object.keys(devices) as Device[])) as ReadonlyArray<Device>
const wantedShots = new Set<ShotName>(
  selectedDevices.flatMap((device) => devices[device].shots)
)
const selectedScenarios = scenarios.filter(
  (scenario) =>
    (env.PAYKY_GOOGLE_PLAY_SCENARIOS === undefined ||
      env.PAYKY_GOOGLE_PLAY_SCENARIOS.includes(scenario.name)) &&
    scenarioShots(scenario).some((shot) => wantedShots.has(shot))
)

if (selectedScenarios.length === 0) {
  throw new Error(
    `No screenshot scenario matched: ${env.PAYKY_GOOGLE_PLAY_SCENARIOS?.join(", ") ?? ""}.`
  )
}

function imagesDirectory(language: Language): string {
  return join(outputDirectory, listingLocaleByLanguage[language], "images")
}

/** Google Play wants opaque images: a 24-bit PNG, not one with alpha. */
async function writeOpaquePng(path: string, image: Buffer): Promise<void> {
  await sharp(image).flatten({ background }).removeAlpha().png().toFile(path)
}

/**
 * The 512 × 512 store icon: the coin on the app's dark background, inside
 * the circle Google Play's rounded mask leaves whole.
 */
async function createIcon(): Promise<Buffer> {
  const size = 512
  const coinSize = 400
  const coin = await sharp(await readFile(coinSvgPath), { density: 300 })
    .resize(coinSize, coinSize, { fit: "contain", background: "#0000" })
    .png()
    .toBuffer()
  const backdrop = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0" stop-color="${gold}" stop-opacity="0.22"/>
          <stop offset="1" stop-color="${gold}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="${background}"/>
      <rect width="${size}" height="${size}" fill="url(#glow)"/>
    </svg>
  `)
  return sharp(backdrop)
    .composite([{ input: coin, gravity: "center" }])
    .png()
    .toBuffer()
}

async function dataUrl(path: string, type: string): Promise<string> {
  return `data:${type};base64,${(await readFile(path)).toString("base64")}`
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

/**
 * The 1024 × 500 feature graphic: the landing's headline, its accent in the
 * gold, beside the payment mockup, drawn in the landing's Manrope.
 */
async function renderFeatureGraphic(
  page: Page,
  language: Language
): Promise<Buffer> {
  const copy = landingResources[language]
  const title = copy["landing.hero.title"]
  const accent = copy["landing.hero.titleAccent"]
  const [before = "", after = ""] = title.split(accent)
  const fontFile = (weight: number, subset: string) =>
    join(
      appDir,
      `node_modules/@fontsource/manrope/files/manrope-${subset}-${weight}-normal.woff2`
    )
  const fontFaces = await Promise.all(
    [700, 800].flatMap((weight) =>
      ["latin", "latin-ext"].map(
        async (subset) => `
          @font-face {
            font-family: Manrope;
            font-weight: ${weight};
            src: url(${await dataUrl(fontFile(weight, subset), "font/woff2")}) format("woff2");
          }`
      )
    )
  )
  const coin = await dataUrl(coinSvgPath, "image/svg+xml")
  const mockup = await dataUrl(
    join(appDir, `docs/mockup/${language}/payment.webp`),
    "image/webp"
  )

  await page.setViewportSize({ width: 1024, height: 500 })
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          ${fontFaces.join("\n")}
          * { box-sizing: border-box; margin: 0; }
          body {
            width: 1024px;
            height: 500px;
            overflow: hidden;
            position: relative;
            background:
              radial-gradient(circle at 78% 38%, color-mix(in oklch, ${gold} 22%, transparent), transparent 46%),
              radial-gradient(circle at 8% 100%, color-mix(in oklch, ${gold} 10%, transparent), transparent 40%),
              ${background};
            color: ${appThemes.dark.foreground};
            font-family: Manrope, sans-serif;
          }
          .copy {
            position: absolute;
            left: 72px;
            top: 0;
            bottom: 0;
            width: 560px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 28px;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 14px;
            font-size: 34px;
            font-weight: 800;
            letter-spacing: -0.02em;
          }
          .brand img { width: 60px; height: 60px; }
          h1 {
            font-size: 54px;
            line-height: 1.08;
            font-weight: 800;
            letter-spacing: -0.03em;
          }
          h1 span { color: ${gold}; }
          .phone {
            position: absolute;
            right: 70px;
            top: 44px;
            width: 300px;
            filter: drop-shadow(0 24px 48px rgb(0 0 0 / 0.5));
          }
        </style>
      </head>
      <body>
        <div class="copy">
          <div class="brand"><img src="${coin}" alt="" />${escapeHtml(brandName(finitoBrand))}</div>
          <h1>${escapeHtml(before)}<span>${escapeHtml(accent)}</span>${escapeHtml(after)}</h1>
        </div>
        <img class="phone" src="${mockup}" alt="" />
      </body>
    </html>
  `)
  await page.evaluate(() => document.fonts.ready)
  return page.screenshot()
}

/** The device's screenshot file of `shot`, numbered in the listing's order. */
function screenshotPath(
  language: Language,
  device: DeviceSpec,
  shot: ShotName
): string | undefined {
  const index = (device.shots as ReadonlyArray<ShotName>).indexOf(shot)
  return index === -1
    ? undefined
    : join(imagesDirectory(language), device.folder, `${index + 1}_${shot}.png`)
}

async function run(): Promise<void> {
  // A partial run keeps the screenshots it does not retake.
  if (
    env.PAYKY_GOOGLE_PLAY_DEVICES === undefined &&
    env.PAYKY_GOOGLE_PLAY_SCENARIOS === undefined
  ) {
    await rm(outputDirectory, { recursive: true, force: true })
  }

  await using web = await startFinitoWeb({
    appDir,
    webDir: join(appDir, ".tmp/google-play-web"),
    webPort: env.PAYKY_GOOGLE_PLAY_WEB_PORT,
    mockPort: env.PAYKY_GOOGLE_PLAY_MOCK_PORT,
    skipBuild: env.PAYKY_GOOGLE_PLAY_SKIP_BUILD,
  })
  const icon = await createIcon()
  const phoneViewport = devices.phone.viewport

  for (const language of languages) {
    const directory = imagesDirectory(language)
    await Promise.all(
      Object.values(devices).map((device) =>
        mkdir(join(directory, device.folder), { recursive: true })
      )
    )

    console.info(`Generating ${language} Google Play graphics`)
    await writeFile(join(directory, "icon.png"), icon)
    const graphicsContext = await web.browser.newContext()
    try {
      await writeOpaquePng(
        join(directory, "featureGraphic.png"),
        await renderFeatureGraphic(await graphicsContext.newPage(), language)
      )
    } finally {
      await graphicsContext.close()
    }

    for (const scenario of selectedScenarios) {
      console.info(
        `Generating ${language} Google Play screenshots: ${scenario.name}`
      )
      // A fresh app, onboarded anew, driven in the phone's viewport the
      // steps are written for.
      const context = await web.newContext({
        language,
        viewport: phoneViewport,
        deviceScaleFactor,
      })
      const page = await context.newPage()
      const shoot: Shoot = async (name, prepare) => {
        for (const device of selectedDevices.map((key) => devices[key])) {
          const path = screenshotPath(language, device, name)
          if (path === undefined) continue
          await page.setViewportSize(device.viewport)
          // Let the layout settle into the new size.
          await page.waitForTimeout(600)
          await prepare?.(page)
          await resetDocumentScroll(page)
          await writeOpaquePng(path, await page.screenshot())
        }
        await page.setViewportSize(phoneViewport)
        await page.waitForTimeout(300)
      }

      try {
        await scenario.capture(page, language, shoot)
      } finally {
        await context.close()
      }
    }
  }

  console.info(`Google Play graphics written to ${outputDirectory}`)
}

await run()
