import type { Language, TranslationKey } from "@payky/app-shared/i18n/resources"
import { createBrandedResources } from "@payky/app-shared/i18n/translate"
import type {
  CartItem,
  CatalogItem,
} from "@payky/doc-mockups/screenshot-content"
import { expect, type Page } from "@playwright/test"
import { appBrand } from "../../src/core/app-brand.ts"

const resources = {
  en: createBrandedResources("en", appBrand),
  cs: createBrandedResources("cs", appBrand),
  sk: createBrandedResources("sk", appBrand),
}

/**
 * Playwright steps over Finito's web export for its screenshots
 * (finito-scenarios.ts): web's `e2e/support` helpers, as the Maestro
 * subflows in `e2e/subflows` drive the same screens.
 */

/** The copy as Finito shows it, its `{name}`-style params filled from `params`. */
export function translate(
  language: Language,
  key: TranslationKey,
  params: Readonly<Record<string, string | number>> = {}
): string {
  return resources[language][key].replace(/\{(\w+)\}/gu, (all, name: string) =>
    name in params ? String(params[name]) : all
  )
}

/** Onboarding through its screens, as the Maestro `complete-onboarding` subflow. */
export async function completeOnboarding(
  page: Page,
  language: Language,
  mode: "numpad" | "pos" = "numpad"
): Promise<void> {
  await page.goto("/")
  await page
    .getByRole("button", {
      name: translate(language, "onboarding.welcome.new"),
    })
    .click()
  await page
    .getByRole("textbox", {
      name: translate(language, "onboarding.setup.account.label"),
    })
    .fill("CZ6508000000192000145399")
  await page
    .getByRole("button", { name: translate(language, "onboarding.continue") })
    .click()
  await page
    .getByRole("radio", {
      name: translate(
        language,
        mode === "numpad"
          ? "onboarding.selling.numpad.title"
          : "onboarding.selling.pos.title"
      ),
    })
    .click()
  await page
    .getByRole("button", { name: translate(language, "onboarding.finish") })
    .click()
  await page
    .getByRole("button", { name: translate(language, "nav.menu") })
    .waitFor()
}

/** A catalog item through its form, as the `add-catalog-item` subflow. */
export async function addCatalogItem(
  page: Page,
  language: Language,
  item: CatalogItem
): Promise<void> {
  await page.goto("/settings/items")
  const add = page
    .getByRole("button", { name: translate(language, "catalog.items.add") })
    .first()
  await add.click()
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.items.form.name.label"),
      exact: true,
    })
    .fill(item.name)
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.items.form.price.label"),
      exact: true,
    })
    .fill(item.price)
  await page
    .getByRole("button", {
      name: translate(language, "catalog.items.form.save.create"),
    })
    .click()
  await page
    .getByRole("link", { name: new RegExp(`^${escapeRegExp(item.name)} `) })
    .waitFor()
}

/** A four-seat table through its form, as the `add-table` subflow. */
export async function addTable(
  page: Page,
  language: Language,
  name: string
): Promise<void> {
  await page.goto("/settings/tables")
  await page
    .getByRole("button", { name: translate(language, "catalog.tables.add") })
    .first()
    .click()
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.tables.form.name.label"),
      exact: true,
    })
    .fill(name)
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.tables.form.seatCount.label"),
      exact: true,
    })
    .fill("4")
  await page
    .getByRole("button", {
      name: translate(language, "catalog.tables.form.save.create"),
    })
    .click()
  await page
    .getByRole("link", { name: new RegExp(`^${escapeRegExp(name)} `) })
    .waitFor()
}

/** Taps `amount` on home's keypad, as the `enter-amount` subflow. */
export async function enterAmount(
  page: Page,
  language: Language,
  amount = "5.9"
): Promise<void> {
  for (const key of amount) {
    await page
      .getByRole("button", {
        name: key === "." ? translate(language, "home.keypad.decimal") : key,
        exact: true,
      })
      .click()
  }
}

/** From home's keypad to the payment's QR, the tip skipped. */
export async function createPayment(
  page: Page,
  language: Language,
  amount?: string
): Promise<void> {
  await enterAmount(page, language, amount)
  await page
    .getByRole("button", { name: translate(language, "home.pay") })
    .click()
  await page
    .getByRole("radio", {
      name: new RegExp(
        `^${escapeRegExp(translate(language, "paymentTip.none"))}`
      ),
    })
    .click()
  await page
    .getByRole("tab", { name: translate(language, "paymentWait.method.iban") })
    .waitFor()
}

/** The payment's cash tab, marked paid, as the `mark-cash-paid` subflow. */
export async function markCashPaid(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("tab", { name: translate(language, "paymentWait.method.cash") })
    .click()
  await page
    .getByRole("button", {
      name: translate(language, "paymentWait.cashPaid.action"),
    })
    .click()
  await page
    .getByRole("heading", { name: translate(language, "paymentWait.paid") })
    .waitFor()
}

/** Home → the menu → its Settings tab, as the `open-menu-tab` subflow. */
export async function openSettings(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "nav.menu") })
    .click()
  await page
    .getByRole("tab", { name: translate(language, "nav.settings") })
    .click()
  await page
    .getByRole("heading", { name: translate(language, "settings.title") })
    .waitFor()
}

/** A new bill without a table, from the bills home, as the `new-bill` subflow. */
export async function startNewBill(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByTestId("no-table-tile")
    .getByRole("button", { name: translate(language, "tables.tile.newBill") })
    .click()
  await waitForBill(page, language)
}

/** A new bill at `tableName`, from its tile on the bills home. */
export async function startTableBill(
  page: Page,
  language: Language,
  tableName: string
): Promise<void> {
  await page
    .getByTestId("table-tile")
    .filter({ hasText: tableName })
    .getByRole("button", { name: translate(language, "tables.tile.newBill") })
    .click()
  await waitForBill(page, language)
}

async function waitForBill(page: Page, language: Language): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "bill.table.aria") })
    .waitFor()
}

/** Taps each item's brick its quantity's times and waits for the bill to exist. */
export async function addCart(
  page: Page,
  language: Language,
  cart: ReadonlyArray<CartItem>
): Promise<void> {
  for (const item of cart) {
    const add = page.getByRole("button", {
      name: translate(language, "bill.brick.add.aria", { name: item.name }),
    })
    for (let count = 0; count < item.quantity; count += 1) await add.click()
  }
  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
}

/** Opens the bill's summary and lets it finish expanding. */
export async function openBillSummary(page: Page): Promise<void> {
  await page.getByTestId("bill-summary-trigger").click()
  await page.getByTestId("bill-summary-panel").waitFor()
  await page.waitForTimeout(400)
}

/** Seats the open bill at `tableName` through its table dialog. */
export async function assignTable(
  page: Page,
  language: Language,
  tableName: string
): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "bill.table.aria") })
    .click()
  const dialog = page.getByRole("dialog")
  await dialog
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(tableName)} `) })
    .click()
  await expect(dialog).toBeHidden()
}

/** Back from the bill to the bills home. */
export async function leaveBill(page: Page, language: Language): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "nav.back") })
    .first()
    .click()
  await page.getByTestId("no-table-tile").waitFor()
}

/** Matches `demoData.running.progress`, capturing `{done}`. */
function demoProgressPattern(language: Language): RegExp {
  const [before = "", after = ""] = escapeRegExp(
    translate(language, "demoData.running.progress")
  ).split("\\{done\\}")
  return new RegExp(
    `${before}(\\d+)${after.replace("\\{total\\}", "\\d+")}`,
    "u"
  )
}

/**
 * A demo account through Settings › Demo data, its generation stopped once
 * `days` days of history exist, as web's stats screenshot does.
 */
export async function generateDemoData(
  page: Page,
  language: Language,
  days: number
): Promise<void> {
  await page.goto("/settings/demo-data")
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
  const running = alertDialog(
    page,
    translate(language, "demoData.running.title")
  )
  await running.waitFor()
  const progress = demoProgressPattern(language)
  await expect
    .poll(
      async () =>
        Number(progress.exec((await running.textContent()) ?? "")?.[1]),
      { timeout: 900_000, intervals: [1000] }
    )
    .toBeGreaterThanOrEqual(days)
  await running
    .getByRole("button", { name: translate(language, "demoData.stop") })
    .click()
  const finished = alertDialog(
    page,
    translate(language, "demoData.finished.title")
  )
  await finished.waitFor({ timeout: 180_000 })
  await finished
    .getByRole("button", { name: translate(language, "demoData.close") })
    .click()
}

/** The kit's alert dialog carries its title as a heading, not as its name. */
function alertDialog(page: Page, title: string) {
  return page
    .getByRole("alertdialog")
    .filter({ has: page.getByRole("heading", { name: title }) })
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
