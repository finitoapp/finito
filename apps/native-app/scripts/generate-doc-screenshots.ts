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
import { composeMockup, type ShotName } from "@payky/doc-mockups/compose-mockup"
import {
  captureHeight,
  captureWidth,
  deviceScaleFactor,
} from "@payky/doc-mockups/phone-frame-geometry"
import {
  billCartByLanguage,
  billCatalogByLanguage,
  paymentAmountByLanguage,
  splitCartByLanguage,
  statsHistoryDays,
  tableNamesByLanguage,
  tablesCartItemByLanguage,
} from "@payky/doc-mockups/screenshot-content"
import { chromium, expect, type Page } from "@playwright/test"
import { createEnv } from "@t3-oss/env-core"
import { $ } from "bun"
import { z } from "zod"
import { serveMocks } from "../e2e/scripts/mock-server.ts"
import { pointAtMocks } from "../e2e/scripts/point-at-mocks.ts"
import { serveWeb } from "../e2e/scripts/serve-web.ts"
import { palette } from "../src/theme/palette.ts"
import {
  addCart,
  addCatalogItem,
  addTable,
  assignTable,
  completeOnboarding,
  createPayment,
  enterAmount,
  generateDemoData,
  leaveBill,
  markCashPaid,
  openBillSummary,
  openSettings,
  startNewBill,
  startTableBill,
  translate,
} from "./doc-screenshots/finito-steps.ts"

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

interface ScreenshotScenario {
  readonly name: ShotName
  /** Every shot `capture` takes, when it is more than the one named after it. */
  readonly shots?: ReadonlyArray<ShotName>
  readonly capture: (page: Page, language: Language) => Promise<void>
}

const appDir = resolve(import.meta.dirname, "..")
const webDir = join(appDir, ".tmp/docs-web")
const rawScreenshotsDirectory = join(appDir, ".tmp/docs-screenshots")
const screenshotsDirectory = join(appDir, "docs/screenshots")
const mockupsDirectory = join(appDir, "docs/mockup")
const appUrl = `http://127.0.0.1:${env.PAYKY_SCREENSHOT_WEB_PORT}`

const documentationLanguages = Object.keys(resources) as Language[]

// The app picks its first language from the browser's.
const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  cs: "cs-CZ",
  sk: "sk-SK",
}

async function capturePage(
  page: Page,
  name: ShotName,
  language: Language
): Promise<void> {
  // React Native Web scrolls inside each screen's ScrollView; focusing a
  // control near the bottom can still scroll the document itself, which
  // lifts the screen and shows the menu bar laid out below it.
  await page.evaluate(() => {
    if (document.scrollingElement !== null) {
      document.scrollingElement.scrollTop = 0
    }
  })
  await page.screenshot({
    path: `${rawScreenshotsDirectory}/${language}/${name}.png`,
  })
}

const scenarios: ReadonlyArray<ScreenshotScenario> = [
  {
    name: "home",
    async capture(page, language) {
      await completeOnboarding(page, language)
      await enterAmount(page, language)
      await capturePage(page, "home", language)
    },
  },
  {
    name: "payment",
    async capture(page, language) {
      await completeOnboarding(page, language)
      await createPayment(page, language, paymentAmountByLanguage[language])
      await expect(
        page.getByRole("button", {
          name: translate(language, "paymentWait.copyQr"),
        })
      ).toBeEnabled()
      await capturePage(page, "payment", language)
    },
  },
  {
    name: "paid",
    async capture(page, language) {
      await completeOnboarding(page, language)
      await createPayment(page, language)
      await markCashPaid(page, language)
      await page.waitForTimeout(350)
      await capturePage(page, "paid", language)
    },
  },
  {
    name: "settings",
    async capture(page, language) {
      await completeOnboarding(page, language)
      await openSettings(page, language)
      await capturePage(page, "settings", language)
    },
  },
  {
    name: "bill",
    async capture(page, language) {
      await completeOnboarding(page, language, "pos")
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      await page.goto("/")
      await startNewBill(page, language)
      await addCart(page, language, billCartByLanguage[language])
      await openBillSummary(page)
      await capturePage(page, "bill", language)
    },
  },
  {
    name: "tables",
    async capture(page, language) {
      await completeOnboarding(page, language, "pos")
      const tableNames = tableNamesByLanguage[language]
      for (const name of tableNames) {
        await addTable(page, language, name)
      }
      const cartItem = tablesCartItemByLanguage[language]
      await addCatalogItem(page, language, cartItem)
      await page.goto("/")

      const parkCartOnTable = async (tableName: string) => {
        await startNewBill(page, language)
        await assignTable(page, language, tableName)
        await addCart(page, language, [{ ...cartItem, quantity: 1 }])
        await leaveBill(page, language)
      }
      const [firstTable, secondTable] = tableNames
      await parkCartOnTable(firstTable)
      await parkCartOnTable(secondTable)
      await parkCartOnTable(secondTable)

      // Prefix shared by every bill's accessible name ("Bill #").
      const billLabelPrefix = translate(language, "bill.list.label").split(
        "{number}"
      )[0]
      await expect(
        page
          .getByTestId("table-tile")
          .filter({ hasText: secondTable })
          .getByRole("button", { name: billLabelPrefix })
      ).toHaveCount(2)
      await capturePage(page, "tables", language)
    },
  },
  {
    name: "table-bill",
    async capture(page, language) {
      await completeOnboarding(page, language, "pos")
      const tableName = tableNamesByLanguage[language][3]
      await addTable(page, language, tableName)
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      await page.goto("/")
      await startTableBill(page, language, tableName)
      await addCart(page, language, splitCartByLanguage[language])
      await openBillSummary(page)
      await capturePage(page, "table-bill", language)
    },
  },
  {
    name: "items",
    async capture(page, language) {
      await completeOnboarding(page, language)
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      await capturePage(page, "items", language)
    },
  },
  {
    name: "split",
    async capture(page, language) {
      await completeOnboarding(page, language, "pos")
      const cart = splitCartByLanguage[language]
      for (const item of cart) {
        await addCatalogItem(page, language, item)
      }
      await page.goto("/")
      await startNewBill(page, language)
      await addCart(page, language, cart)

      await page
        .getByRole("button", {
          name: translate(language, "bill.split.button.aria"),
        })
        .click()
      const dialog = page.getByRole("dialog")
      for (const item of cart.slice(1)) {
        await dialog
          .getByRole("button", {
            name: translate(language, "bill.split.increase.aria", {
              name: item.name,
            }),
          })
          .click()
      }
      // The dialog slides in; let it settle before the shot.
      await page.waitForTimeout(400)
      await capturePage(page, "split", language)
    },
  },
  {
    name: "stats",
    shots: ["stats", "stats-charts"],
    async capture(page, language) {
      await completeOnboarding(page, language)
      await generateDemoData(page, language, statsHistoryDays)

      await page.goto("/activity/stats?period=last7Days")
      await page
        .getByText(translate(language, "stats.kpi.netRevenue"))
        .first()
        .waitFor()
      // The revenue chart draws in after the figures.
      await page.waitForTimeout(1000)
      await capturePage(page, "stats", language)

      // Lower down, the charts, under the screen's sticky header.
      await page
        .getByText(translate(language, "stats.chart.title"))
        .first()
        .evaluate((element) => {
          element.scrollIntoView({ block: "start", behavior: "instant" })
        })
      await page.waitForTimeout(500)
      await capturePage(page, "stats-charts", language)
    },
  },
]

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
  pointAtMocks("127.0.0.1", env.PAYKY_SCREENSHOT_MOCK_PORT)
  if (!env.PAYKY_SCREENSHOT_SKIP_BUILD) {
    await rm(webDir, { recursive: true, force: true })
    await $`bun x expo export --platform web --output-dir ${webDir}`.cwd(appDir)
  }
  await rm(rawScreenshotsDirectory, { recursive: true, force: true })

  const mocks = serveMocks(env.PAYKY_SCREENSHOT_MOCK_PORT)
  const server = serveWeb(webDir, env.PAYKY_SCREENSHOT_WEB_PORT)
  const browser = await chromium.launch()

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
        const context = await browser.newContext({
          baseURL: appUrl,
          colorScheme: "dark",
          deviceScaleFactor,
          locale: localeByLanguage[language],
          reducedMotion: "reduce",
          timezoneId: "Europe/Prague",
          viewport: { width: captureWidth, height: captureHeight },
        })
        const page = await context.newPage()

        try {
          await scenario.capture(page, language)
        } finally {
          await context.close()
        }

        for (const shot of scenario.shots ?? [scenario.name]) {
          await composeMockup({
            rawPath: `${rawScreenshotsDirectory}/${language}/${shot}.png`,
            screenshotPath: `${screenshotsDirectory}/${language}/${shot}.png`,
            mockupPath: `${mockupsDirectory}/${language}/${shot}.webp`,
            background: palette.dark.background,
          })
        }
      }
    }
  } finally {
    await browser.close()
    server.stop(true)
    mocks.stop(true)
    await rm(rawScreenshotsDirectory, { recursive: true, force: true })
  }
}

await run()
