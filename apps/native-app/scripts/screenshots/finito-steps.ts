import type { Language, TranslationKey } from "@payky/app-shared/i18n/resources"
import { createBrandedResources } from "@payky/app-shared/i18n/translate"
import type {
  CartItem,
  CatalogItem,
} from "@payky/doc-mockups/screenshot-content"
import { expect, type Page } from "@playwright/test"
import { appBrand } from "../../src/core/app-brand.ts"
import type { E2eSwitchioScenario } from "../../src/e2e/e2e-switchio-presets.ts"

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
  // Starting the business creates the account whose key Settings shows.
  await reseedRandomness(page)
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
  await hamburger(page, language).click()
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

/**
 * The fake SwitchioPay of an e2e build (src/e2e/e2e-switchio-presets.ts),
 * on at every load of the page in `scenario` from the start: a reload still
 * loses its terminal (the payments it approved, its batch), so once a card
 * payment is taken a scenario moves on in-app, never by `page.goto`.
 */
export async function switchioOnEveryLoad(
  page: Page,
  scenario: E2eSwitchioScenario
): Promise<void> {
  await page.addInitScript((initial) => {
    ;(window as { __e2eSwitchioScenario?: string }).__e2eSwitchioScenario =
      initial
  }, scenario)
}

interface E2eSwitchioWindow {
  readonly __e2eSwitchio: {
    readonly setScenario: (scenario: E2eSwitchioScenario | null) => void
    readonly hold: (hold: boolean) => void
    readonly release: () => void
    readonly waiting: () => number
  }
}

/** Changes what the fake SwitchioPay answers next, keeping its terminal. */
export async function setSwitchioScenario(
  page: Page,
  scenario: E2eSwitchioScenario | null
): Promise<void> {
  await page.evaluate((next) => {
    ;(window as unknown as E2eSwitchioWindow).__e2eSwitchio.setScenario(next)
  }, scenario)
}

/**
 * Holds every SwitchioPay launch as if SwitchioPay had the screen, so the app
 * shows its waiting state, or (`false`) lets them all answer.
 */
export async function holdSwitchio(page: Page, hold = true): Promise<void> {
  await page.evaluate((next) => {
    ;(window as unknown as E2eSwitchioWindow).__e2eSwitchio.hold(next)
  }, hold)
}

/** Lets the held launches answer, by the scenario set now; still held after. */
export async function releaseSwitchio(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as E2eSwitchioWindow).__e2eSwitchio.release()
  })
}

/** Waits until a launch waits on the held SwitchioPay. */
export async function waitForSwitchioLaunch(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as E2eSwitchioWindow).__e2eSwitchio.waiting()
      )
    )
    .toBeGreaterThan(0)
}

/**
 * The app back in the foreground, as after SwitchioPay or Android had the
 * screen: React Native Web's AppState follows the page's visibility.
 */
export async function returnToForeground(page: Page): Promise<void> {
  await page.evaluate(() => {
    const visibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      })
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => state === "hidden",
      })
      document.dispatchEvent(new Event("visibilitychange"))
    }
    visibility("hidden")
    visibility("visible")
  })
}

/**
 * Back to home's keypad through the menu bar's Home, a button there, from a
 * screen the bar is on or one opened from it.
 */
export async function openHome(page: Page, language: Language): Promise<void> {
  await backToMenu(page, language)
  await page
    .getByRole("navigation", { name: translate(language, "nav.menu") })
    .getByRole("button", { name: translate(language, "nav.home") })
    .click()
  await page
    .getByRole("button", { name: translate(language, "home.pay"), exact: true })
    .waitFor()
}

/** A row of a settings list, by its title. */
export async function openSettingsRow(
  page: Page,
  language: Language,
  title: TranslationKey
): Promise<void> {
  await page.getByRole("link", { name: translate(language, title) }).click()
  await page
    .getByRole("heading", { name: translate(language, title) })
    .first()
    .waitFor()
}

/** Settings › Payment methods, from the settings. */
export async function openPaymentMethods(
  page: Page,
  language: Language
): Promise<void> {
  await openSettingsRow(page, language, "settings.paymentAccounts.title")
  await page
    .getByRole("switch", {
      name: translate(language, "settings.cardSwitchioAccount.enabled.label"),
    })
    .waitFor()
}

/** Back one screen through the header's back button. */
export async function goBack(page: Page, language: Language): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "nav.back") })
    .last()
    .click()
}

/**
 * Turns the "Payment card" method on in Settings › Payment methods (if it
 * is not on yet) and
 * drags it to the top of the list, so the payment screen opens on it, as the
 * Maestro `enable-card` subflow (which leaves the order alone). Starts and
 * ends on the payment methods.
 */
export async function enableCardPayments(
  page: Page,
  language: Language
): Promise<void> {
  const enabled = page.getByRole("switch", {
    name: translate(language, "settings.cardSwitchioAccount.enabled.label"),
  })
  await expect(enabled).toBeEnabled()
  if (!(await enabled.isChecked())) await enabled.click()
  await expect(enabled).toBeChecked()

  const card = translate(
    language,
    "settings.paymentAccounts.method.cardSwitchio"
  )
  const grip = page.getByRole("button", {
    name: translate(language, "settings.paymentAccounts.reorder.aria", {
      name: card,
    }),
  })
  const firstGrip = page
    .getByRole("button", {
      name: new RegExp(
        `^${escapeRegExp(
          translate(language, "settings.paymentAccounts.reorder.aria", {
            name: "\u0000",
          })
        ).replace("\u0000", ".+")}$`,
        "u"
      ),
    })
    .first()
  const from = await grip.boundingBox()
  const to = await firstGrip.boundingBox()
  if (from === null || to === null) throw new Error("No grip to drag.")
  const x = from.x + from.width / 2
  await page.mouse.move(x, from.y + from.height / 2)
  await page.mouse.down()
  const targetY = to.y + to.height / 4
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(
      x,
      from.y +
        from.height / 2 +
        ((targetY - from.y - from.height / 2) * step) / 10
    )
  }
  await page.mouse.up()
  await expect(firstGrip).toHaveAccessibleName(
    translate(language, "settings.paymentAccounts.reorder.aria", { name: card })
  )
  // The badge moves with the stored order; let the rows settle.
  await page.waitForTimeout(500)
}

/**
 * From home's keypad: `amount`, the tip (`tip` is a preset's label, none
 * without), and the card tab ready to pay. `shoot` takes the screens on the
 * way.
 */
export async function startCardPayment(
  page: Page,
  language: Language,
  {
    amount,
    tip,
    onKeypad,
    onTip,
  }: {
    readonly amount: string
    readonly tip?: string
    readonly onKeypad?: () => Promise<void>
    readonly onTip?: () => Promise<void>
  }
): Promise<void> {
  await enterAmount(page, language, amount)
  await onKeypad?.()
  await page
    .getByRole("button", { name: translate(language, "home.pay"), exact: true })
    .click()
  const none = page.getByRole("radio", {
    name: new RegExp(
      `^${escapeRegExp(translate(language, "paymentTip.none"))}`
    ),
  })
  await none.waitFor()
  await onTip?.()
  // Choosing the tip creates the payment, whose id the card screens show.
  await reseedRandomness(page)
  await (tip === undefined
    ? none
    : page.getByRole("radio", {
        name: new RegExp(`^${escapeRegExp(tip)}`, "u"),
      })
  ).click()
  const cardTab = page.getByRole("tab", {
    name: translate(language, "paymentWait.method.card"),
  })
  await cardTab.click()
  await expect(cardTab).toHaveAttribute("aria-selected", "true")
  await page
    .getByRole("button", {
      name: translate(language, "paymentWait.cardPaid.action"),
    })
    .waitFor()
}

/**
 * Pauses the page's installed clock at the next whole hour plus a minute per
 * tap: always ahead of the page's time, and the same on every run.
 */
async function pauseClockForTap(page: Page, taps: number): Promise<void> {
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(
    Math.ceil(now / 3_600_000) * 3_600_000 + taps * 60_000
  )
}

/** How many ids each page has reseeded for, for `reseedRandomness`. */
const reseeds = new WeakMap<Page, number>()

/**
 * Starts the page's seeded randomness (the terminal screenshots' init
 * script) afresh before a step that mints an id the screen shows, so the id
 * does not depend on how much was drawn before. A page without seeded
 * randomness is left alone.
 */
async function reseedRandomness(page: Page): Promise<void> {
  const count = (reseeds.get(page) ?? 0) + 1
  reseeds.set(page, count)
  await page.evaluate((name) => {
    const reseed = (
      globalThis as { __screenshotReseed?: (name: string) => void }
    ).__screenshotReseed
    reseed?.(name)
  }, String(count))
}

/** How many card taps each page has made, for `tapPayByCard`'s moment. */
const cardTaps = new WeakMap<Page, number>()

/**
 * Taps "Pay with payment card" on the card tab, on a page whose clock is
 * installed (the terminal screenshots), with the clock paused at a fixed
 * moment, a minute apart per tap, so the attempt's request id — the payment's
 * id and the time of the tap — comes out the same on every run.
 */
export async function tapPayByCard(
  page: Page,
  language: Language
): Promise<void> {
  const button = page.getByRole("button", {
    name: translate(language, "paymentWait.cardPaid.action"),
  })
  const taps = (cardTaps.get(page) ?? 0) + 1
  cardTaps.set(page, taps)
  await pauseClockForTap(page, taps)
  await reseedRandomness(page)
  await button.click()
  // The attempt is written within the tap's own work; then time runs again.
  await page.waitForTimeout(300)
  await page.clock.resume()
}

/** Waits for the paid screen. */
export async function waitForPaid(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("heading", { name: translate(language, "paymentWait.paid") })
    .waitFor()
}

/** A card payment from home's keypad, approved, ending on the paid screen. */
export async function payByCard(
  page: Page,
  language: Language,
  options: { readonly amount: string; readonly tip?: string }
): Promise<void> {
  await startCardPayment(page, language, options)
  await tapPayByCard(page, language)
  await waitForPaid(page, language)
}

/** The paid screen's way to the payment's detail. */
export async function openPaymentDetail(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "paymentWait.detail") })
    .click()
  await waitForPaymentDetail(page, language)
}

async function waitForPaymentDetail(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("heading", { name: translate(language, "paymentDetail.title") })
    .first()
    .waitFor()
  await page.getByTestId("payment-detail-card").waitFor()
}

/** Home's hamburger, named after the notifications while one is unread. */
function hamburger(page: Page, language: Language) {
  return page.getByRole("button", {
    name: new RegExp(
      `^(${escapeRegExp(translate(language, "nav.menu"))}|${escapeRegExp(translate(language, "nav.notificationsUnread"))})$`,
      "u"
    ),
  })
}

/** Back through the screens until the menu bar shows. */
export async function backToMenu(
  page: Page,
  language: Language
): Promise<void> {
  const menu = page.getByRole("navigation", {
    name: translate(language, "nav.menu"),
  })
  // A screen still sliding away may hide the bar for a moment.
  const shown = () =>
    menu.waitFor({ timeout: 1500 }).then(
      () => true,
      () => false
    )
  for (let step = 0; step < 5 && !(await shown()); step += 1) {
    await goBack(page, language)
  }
  await menu.waitFor()
}

/** The newest payment in Activity, from home or a screen the bar is on. */
export async function openNewestPayment(
  page: Page,
  language: Language
): Promise<void> {
  const menu = hamburger(page, language)
  if (await menu.isVisible()) await menu.click()
  await page
    .getByRole("tab", { name: translate(language, "nav.activity") })
    .click()
  // Rows are named "Payment #N, <amount>, <status>", the newest first.
  const [numbered = ""] = translate(language, "paymentDetail.number").split(
    "{number}"
  )
  await page
    .getByRole("link", {
      name: new RegExp(`^${escapeRegExp(numbered)}\\d+, `, "u"),
    })
    .first()
    .click()
  await waitForPaymentDetail(page, language)
}

/** The payment detail's "Refund money", to the refund screen. */
export async function openRefund(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", {
      name: translate(language, "paymentDetail.refunds.action"),
    })
    .click()
  await page
    .getByRole("radio", {
      name: new RegExp(
        `^${escapeRegExp(translate(language, "refund.dialog.method.cardSwitchio"))}`
      ),
    })
    .waitFor()
}

/** Picks what the refund screen refunds. */
export async function chooseRefund(
  page: Page,
  language: Language,
  choice: "whole" | "part" | "tip"
): Promise<void> {
  await page
    .getByRole("radio", {
      name: new RegExp(
        `^${escapeRegExp(translate(language, `refund.page.choice.${choice}`))}`
      ),
    })
    .click()
}

/** The refund screen's confirm, "Refund {amount}". */
export function refundConfirmButton(page: Page, language: Language) {
  const [before = "", after = ""] = translate(
    language,
    "refund.dialog.confirm"
  ).split("{amount}")
  return page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(before)}.+${escapeRegExp(after)}$`, "u"),
  })
}

/**
 * Confirms the refund screen. The terminal screenshots draw the refund's
 * request id from a fresh stream, so its detail shows the same id each run.
 */
export async function confirmRefund(
  page: Page,
  language: Language
): Promise<void> {
  await reseedRandomness(page)
  await refundConfirmButton(page, language).click()
}

/**
 * Settings › Terminal closures › Run the closure, confirmed, from the
 * settings; `onConfirm` sees the confirmation first. Ends on the closure's
 * detail.
 */
export async function runClosure(
  page: Page,
  language: Language,
  {
    onPage,
    onConfirm,
  }: {
    readonly onPage?: () => Promise<void>
    readonly onConfirm?: () => Promise<void>
  } = {}
): Promise<void> {
  await openSettingsRow(page, language, "settings.cardClosure.title")
  await onPage?.()
  await startClosure(page, language)
  await onConfirm?.()
  await confirmClosure(page, language)
  await page
    .getByRole("heading", {
      name: translate(language, "settings.cardClosure.detail.title"),
    })
    .first()
    .waitFor()
}

/** The closure screen's "Run the closure", up to its confirmation. */
export async function startClosure(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", {
      name: translate(language, "settings.cardClosure.action"),
    })
    .click()
  await alertDialog(
    page,
    translate(language, "settings.cardClosure.confirm.title")
  ).waitFor()
}

/** Confirms the closure in its dialog. */
export async function confirmClosure(
  page: Page,
  language: Language
): Promise<void> {
  const dialog = alertDialog(
    page,
    translate(language, "settings.cardClosure.confirm.title")
  )
  await dialog
    .getByRole("button", {
      name: translate(language, "settings.cardClosure.action"),
    })
    .click()
  await expect(dialog).toBeHidden()
}

/** Scrolls the screen so `text` sits at `block` of the viewport. */
export async function scrollTo(
  page: Page,
  locator: ReturnType<Page["getByText"]>,
  block: ScrollLogicalPosition = "center"
): Promise<void> {
  await locator.evaluate((element, position) => {
    element.scrollIntoView({ block: position, behavior: "instant" })
  }, block)
  await page.waitForTimeout(300)
}

/** The kit's alert dialog carries its title as a heading, not as its name. */
export function alertDialog(page: Page, title: string) {
  return page
    .getByRole("alertdialog")
    .filter({ has: page.getByRole("heading", { name: title }) })
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
