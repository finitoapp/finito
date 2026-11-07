import { spawn } from "node:child_process"
import { mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import {
  type Language,
  resources,
  type TranslationKey,
} from "@payky/app-shared/i18n/resources"
import { composeMockup, type ShotName } from "@payky/doc-mockups/compose-mockup"
import { deviceScaleFactor } from "@payky/doc-mockups/phone-frame-geometry"
import {
  billCartByLanguage,
  billCatalogByLanguage,
  type CartItem,
  paymentAmountByLanguage,
  splitCartByLanguage,
  statsHistoryDays,
  tableNamesByLanguage,
  tablesCartItemByLanguage,
} from "@payky/doc-mockups/screenshot-content"
import { chromium, expect, type Page } from "@playwright/test"
import { addCatalogItem, addTable, startNewBill } from "../e2e/support/bill.ts"
import { translate } from "../e2e/support/i18n.ts"
import {
  gotoPage,
  gotoPosOverview,
  openMenuTabFromHome,
} from "../e2e/support/navigation.ts"
import { completeOnboarding } from "../e2e/support/onboarding.ts"
import {
  createPayment,
  enterAmount,
  markCashPaid,
} from "../e2e/support/payment.ts"
import { pageHeight, pageWidth } from "../e2e/support/viewport.ts"
import { docEnv } from "./doc-env.ts"

interface ScreenshotScenario {
  readonly name: ShotName
  /** Every shot `capture` takes, when it is more than the one named after it. */
  readonly shots?: ReadonlyArray<ShotName>
  readonly capture: (page: Page, language: Language) => Promise<void>
}

const documentationLanguages = Object.keys(resources) as Language[]

const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  cs: "cs-CZ",
  sk: "sk-SK",
}

const projectRoot = fileURLToPath(new URL("..", import.meta.url))
const rawScreenshotsDirectory = `${projectRoot}/.tmp/docs-screenshots`
const screenshotsDirectory = `${projectRoot}/docs/screenshots`
const mockupsDirectory = `${projectRoot}/docs/mockup`
const appUrl = "http://127.0.0.1:4173"

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

async function waitForApp(): Promise<void> {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(appUrl)
      if (response.ok) return
    } catch {
      // The development server is still starting.
    }

    await delay(250)
  }

  throw new Error("Timed out waiting for the documentation screenshot server.")
}

function nameParam(
  language: Language,
  key: TranslationKey,
  name: string
): string {
  return translate(language, key).replace("{name}", name)
}

/** Matches `demoData.running.progress`, capturing `{done}`. */
function demoProgressPattern(language: Language): RegExp {
  const [before = "", after = ""] = translate(
    language,
    "demoData.running.progress"
  )
    .replace(/[.*+?^$()|[\]\\]/gu, "\\$&")
    .split("{done}")
  return new RegExp(`${before}(\\d+)${after.replace("{total}", "\\d+")}`, "u")
}

async function addCart(
  page: Page,
  language: Language,
  cart: ReadonlyArray<CartItem>
): Promise<void> {
  for (const item of cart) {
    const addButton = page.getByRole("button", {
      name: nameParam(language, "bill.brick.add.aria", item.name),
    })
    for (let count = 0; count < item.quantity; count += 1) {
      await addButton.click()
    }
  }
  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
}

async function capturePage(
  page: Page,
  name: ShotName,
  language: Language
): Promise<void> {
  await page.screenshot({
    path: `${rawScreenshotsDirectory}/${language}/${name}.png`,
  })
}

const scenarios: ReadonlyArray<ScreenshotScenario> = [
  {
    name: "home",
    async capture(page, language) {
      await completeOnboarding(page, language, { baseURL: appUrl })
      await enterAmount(page, language)
      await capturePage(page, "home", language)
    },
  },
  {
    name: "payment",
    async capture(page, language) {
      await completeOnboarding(page, language, { baseURL: appUrl })
      await createPayment(page, language, paymentAmountByLanguage[language])
      await page
        .getByRole("tab", {
          name: translate(language, "paymentWait.method.iban"),
        })
        .click()
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
      await completeOnboarding(page, language, { baseURL: appUrl })
      await createPayment(page, language)
      await page
        .getByRole("tab", {
          name: translate(language, "paymentWait.method.cash"),
        })
        .click()
      await markCashPaid(page, language)
      await page.waitForTimeout(350)
      await capturePage(page, "paid", language)
    },
  },
  {
    name: "settings",
    async capture(page, language) {
      await completeOnboarding(page, language, { baseURL: appUrl })
      await openMenuTabFromHome(page, language, "nav.settings")
      await page
        .getByRole("heading", { name: translate(language, "settings.title") })
        .waitFor()
      await capturePage(page, "settings", language)
    },
  },
  {
    name: "bill",
    async capture(page, language) {
      await completeOnboarding(page, language, {
        baseURL: appUrl,
        sellingMode: "pos",
      })
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      const cartItems = billCartByLanguage[language]

      await page.goto("/", { waitUntil: "domcontentloaded" })
      await startNewBill(page, language)

      await addCart(page, language, cartItems)

      await page.getByTestId("bill-summary-trigger").click()
      await page.getByTestId("bill-summary-panel").waitFor()
      // The summary panel's expand/collapse is a 300ms CSS transition
      // (grid-template-rows), not a mount/unmount `waitFor()` can catch.
      await page.waitForTimeout(400)
      await capturePage(page, "bill", language)
    },
  },
  {
    name: "tables",
    async capture(page, language) {
      await completeOnboarding(page, language, { baseURL: appUrl })
      const tableNames = tableNamesByLanguage[language]
      for (const name of tableNames) {
        await addTable(page, language, { name, seatCount: "4" })
      }
      const cartItem = tablesCartItemByLanguage[language]
      await addCatalogItem(page, language, {
        name: cartItem.name,
        price: cartItem.price,
      })

      await gotoPosOverview(page, language)

      const parkCartOnTable = async (tableName: string) => {
        await page
          .getByTestId("no-table-tile")
          .getByRole("link", {
            name: translate(language, "tables.tile.newBill"),
          })
          .click()
        await page
          .getByRole("heading", { name: translate(language, "bill.title") })
          .waitFor()
        await page
          .getByRole("button", {
            name: translate(language, "bill.table.aria"),
          })
          .click()
        const dialog = page.getByRole("dialog", {
          name: translate(language, "bill.table.dialog.title"),
        })
        await dialog.getByRole("button", { name: tableName }).click()
        await expect(dialog).not.toBeVisible()
        await page
          .getByRole("button", {
            name: nameParam(language, "bill.brick.add.aria", cartItem.name),
          })
          .click()
        await expect
          .poll(() => new URL(page.url()).searchParams.get("billId"))
          .not.toBeNull()
        await page
          .getByRole("button", { name: translate(language, "nav.back") })
          .click()
        await page.getByTestId("no-table-tile").waitFor()
      }

      const [firstTable, secondTable] = tableNames
      await parkCartOnTable(firstTable)
      await parkCartOnTable(secondTable)
      await parkCartOnTable(secondTable)

      // Prefix shared by every bill row's accessible name (e.g. "Bill #"),
      // distinct enough from the tile's "new bill" link not to match it.
      const billLabelPrefix = translate(language, "bill.list.label").split(
        "{number}"
      )[0]

      await expect(
        page
          .getByTestId("table-tile")
          .filter({ hasText: secondTable })
          .getByRole("link", { name: billLabelPrefix })
      ).toHaveCount(2)
      await capturePage(page, "tables", language)
    },
  },
  {
    name: "table-bill",
    async capture(page, language) {
      await completeOnboarding(page, language, { baseURL: appUrl })
      const tableName = tableNamesByLanguage[language][3]
      await addTable(page, language, { name: tableName, seatCount: "4" })
      const cart = splitCartByLanguage[language]
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }

      await gotoPosOverview(page, language)
      await page
        .getByTestId("table-tile")
        .filter({ hasText: tableName })
        .getByRole("link", { name: translate(language, "tables.tile.newBill") })
        .click()
      await page
        .getByRole("heading", { name: translate(language, "bill.title") })
        .waitFor()
      await addCart(page, language, cart)

      await page.getByTestId("bill-summary-trigger").click()
      await page.getByTestId("bill-summary-panel").waitFor()
      // The same 300ms expand transition as the bill screenshot.
      await page.waitForTimeout(400)
      await capturePage(page, "table-bill", language)
    },
  },
  {
    name: "items",
    async capture(page, language) {
      await completeOnboarding(page, language, { baseURL: appUrl })
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      // The form stays open over the list to add another item.
      await gotoPage(page, "/catalog/items", language, "catalog.items.title")
      await capturePage(page, "items", language)
    },
  },
  {
    name: "split",
    async capture(page, language) {
      await completeOnboarding(page, language, {
        baseURL: appUrl,
        sellingMode: "pos",
      })
      const cart = splitCartByLanguage[language]
      for (const item of cart) {
        await addCatalogItem(page, language, item)
      }

      await page.goto("/", { waitUntil: "domcontentloaded" })
      await startNewBill(page, language)
      await addCart(page, language, cart)

      await page
        .getByRole("button", {
          name: translate(language, "bill.split.button.aria"),
        })
        .click()
      await page.getByText(translate(language, "bill.split.title")).waitFor()
      for (const item of cart.slice(1)) {
        await page
          .getByRole("button", {
            name: nameParam(language, "bill.split.increase.aria", item.name),
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
      await completeOnboarding(page, language, { baseURL: appUrl })
      await gotoPage(
        page,
        "/settings/demo-data",
        language,
        "settings.demoData.title"
      )
      await page
        .getByRole("button", {
          name: translate(language, "settings.demoData.action"),
        })
        .click()
      await page
        .getByRole("button", {
          name: translate(language, "settings.demoData.confirm.confirm"),
        })
        .click()

      const running = page.getByRole("alertdialog", {
        name: translate(language, "demoData.running.title"),
      })
      await running.waitFor()
      const progress = demoProgressPattern(language)
      await expect
        .poll(
          async () =>
            Number(progress.exec((await running.textContent()) ?? "")?.[1]),
          { timeout: 600_000, intervals: [1000] }
        )
        .toBeGreaterThanOrEqual(statsHistoryDays)
      await running
        .getByRole("button", { name: translate(language, "demoData.stop") })
        .click()
      const finished = page.getByRole("alertdialog", {
        name: translate(language, "demoData.finished.title"),
      })
      await finished.waitFor({ timeout: 120_000 })
      await finished
        .getByRole("button", { name: translate(language, "demoData.close") })
        .click()

      await gotoPage(
        page,
        "/activity/stats?period=last7Days",
        language,
        "activity.title"
      )
      await page
        .getByText(translate(language, "stats.kpi.netRevenue"))
        .first()
        .waitFor()
      // The revenue chart draws in after the figures.
      await page.waitForTimeout(1000)
      await capturePage(page, "stats", language)

      // Lower down, the charts, with the period selector stuck above them.
      await page
        .getByText(translate(language, "stats.chart.title"))
        .first()
        .evaluate((element) => {
          // Instant: a smooth scroll would be cut short by the next one.
          element.scrollIntoView({ block: "start", behavior: "instant" })
          window.scrollBy({ top: -95, behavior: "instant" })
        })
      await page.waitForTimeout(500)
      await capturePage(page, "stats-charts", language)
    },
  },
]

const requestedScenarioNames = docEnv.PAYKY_SCREENSHOT_SCENARIOS

const selectedScenarios =
  requestedScenarioNames === undefined
    ? scenarios
    : scenarios.filter((scenario) =>
        requestedScenarioNames.includes(scenario.name)
      )

if (selectedScenarios.length === 0) {
  throw new Error(
    `No screenshot scenario matched: ${requestedScenarioNames?.join(", ") ?? ""}.`
  )
}

/** The web app's dark `--background`, behind the capture in its screenshot. */
const screenshotBackground = "#101314"

function composeScreenshot(name: ShotName, language: Language): Promise<void> {
  return composeMockup({
    rawPath: `${rawScreenshotsDirectory}/${language}/${name}.png`,
    screenshotPath: `${screenshotsDirectory}/${language}/${name}.png`,
    mockupPath: `${mockupsDirectory}/${language}/${name}.webp`,
    background: screenshotBackground,
  })
}

async function run(): Promise<void> {
  await rm(rawScreenshotsDirectory, { recursive: true, force: true })
  await Promise.all([
    mkdir(rawScreenshotsDirectory, { recursive: true }),
    mkdir(screenshotsDirectory, { recursive: true }),
    mkdir(mockupsDirectory, { recursive: true }),
  ])

  const server = spawn(
    "bun",
    [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, PAYKY_DISABLE_BASIC_SSL: "1" },
      stdio: "ignore",
    }
  )

  try {
    await waitForApp()
    const browser = await chromium.launch()

    try {
      for (const language of documentationLanguages) {
        await Promise.all([
          mkdir(`${rawScreenshotsDirectory}/${language}`, { recursive: true }),
          mkdir(`${screenshotsDirectory}/${language}`, { recursive: true }),
          mkdir(`${mockupsDirectory}/${language}`, { recursive: true }),
        ])

        for (const scenario of selectedScenarios) {
          console.info(
            `Generating ${language} documentation screenshot: ${scenario.name}`
          )
          const context = await browser.newContext({
            baseURL: appUrl,
            colorScheme: "dark",
            deviceScaleFactor,
            locale: localeByLanguage[language],
            reducedMotion: "reduce",
            timezoneId: "Europe/Prague",
            viewport: { width: pageWidth, height: pageHeight },
          })
          const page = await context.newPage()

          try {
            await scenario.capture(page, language)
          } finally {
            await context.close()
          }

          for (const shot of scenario.shots ?? [scenario.name]) {
            await composeScreenshot(shot, language)
          }
        }
      }
    } finally {
      await browser.close()
    }
  } finally {
    server.kill()
    if (server.exitCode === null) {
      await new Promise<void>((resolve) => {
        server.once("exit", () => resolve())
      })
    }
    await rm(rawScreenshotsDirectory, { recursive: true, force: true })
  }
}

await run()
