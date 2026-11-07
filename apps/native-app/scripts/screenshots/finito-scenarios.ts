import type { Language } from "@payky/app-shared/i18n/resources"
import type { ShotName } from "@payky/doc-mockups/compose-mockup"
import {
  billCartByLanguage,
  billCatalogByLanguage,
  paymentAmountByLanguage,
  splitCartByLanguage,
  statsHistoryDays,
  tableNamesByLanguage,
  tablesCartItemByLanguage,
} from "@payky/doc-mockups/screenshot-content"
import { expect, type Page } from "@playwright/test"
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
} from "./finito-steps.ts"

/**
 * Takes the shot `name` of the screen as it is. `prepare` brings the screen
 * into place first; a script that shoots one screen at several viewports
 * runs it again after each resize.
 */
export type Shoot = (
  name: ShotName,
  prepare?: (page: Page) => Promise<void>
) => Promise<void>

/**
 * One fresh app driven to a screen, in a phone-sized viewport, then shot.
 * The documentation screenshots and the Google Play listing shoot the same
 * scenarios, each at its own viewports.
 */
export interface ScreenshotScenario {
  readonly name: ShotName
  /** Every shot `capture` takes, when it is more than the one named after it. */
  readonly shots?: ReadonlyArray<ShotName>
  readonly capture: (
    page: Page,
    language: Language,
    shoot: Shoot
  ) => Promise<void>
}

export function scenarioShots(
  scenario: ScreenshotScenario
): ReadonlyArray<ShotName> {
  return scenario.shots ?? [scenario.name]
}

/**
 * React Native Web scrolls inside each screen's ScrollView; focusing a
 * control near the bottom can still scroll the document itself, which lifts
 * the screen and shows the menu bar laid out below it. Run before each shot.
 */
export async function resetDocumentScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.scrollingElement !== null) {
      document.scrollingElement.scrollTop = 0
    }
  })
}

export const scenarios: ReadonlyArray<ScreenshotScenario> = [
  {
    name: "home",
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      await enterAmount(page, language)
      await shoot("home")
    },
  },
  {
    name: "payment",
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      await createPayment(page, language, paymentAmountByLanguage[language])
      await expect(
        page.getByRole("button", {
          name: translate(language, "paymentWait.copyQr"),
        })
      ).toBeEnabled()
      await shoot("payment")
    },
  },
  {
    name: "paid",
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      await createPayment(page, language)
      await markCashPaid(page, language)
      await page.waitForTimeout(350)
      await shoot("paid")
    },
  },
  {
    name: "settings",
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      await openSettings(page, language)
      await shoot("settings")
    },
  },
  {
    name: "bill",
    async capture(page, language, shoot) {
      await completeOnboarding(page, language, "pos")
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      await page.goto("/")
      await startNewBill(page, language)
      await addCart(page, language, billCartByLanguage[language])
      await openBillSummary(page)
      await shoot("bill")
    },
  },
  {
    name: "tables",
    async capture(page, language, shoot) {
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
      await shoot("tables")
    },
  },
  {
    name: "table-bill",
    async capture(page, language, shoot) {
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
      await shoot("table-bill")
    },
  },
  {
    name: "items",
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      for (const item of billCatalogByLanguage[language]) {
        await addCatalogItem(page, language, item)
      }
      await shoot("items")
    },
  },
  {
    name: "split",
    async capture(page, language, shoot) {
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
      await shoot("split")
    },
  },
  {
    name: "stats",
    shots: ["stats", "stats-charts"],
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      await generateDemoData(page, language, statsHistoryDays)

      await page.goto("/activity/stats?period=last7Days")
      await page
        .getByText(translate(language, "stats.kpi.netRevenue"))
        .first()
        .waitFor()
      // The revenue chart draws in after the figures.
      await page.waitForTimeout(1000)
      await shoot("stats")

      // Lower down, the charts, scrolled to the top of the screen.
      await shoot("stats-charts", async () => {
        await page
          .getByText(translate(language, "stats.chart.title"))
          .first()
          .evaluate((element) => {
            element.scrollIntoView({ block: "start", behavior: "instant" })
          })
        await page.waitForTimeout(500)
      })
    },
  },
]
