import type { Language, TranslationKey } from "@payky/app-shared/i18n/resources"
import type { Page } from "@playwright/test"
import { translate } from "./i18n.ts"

/**
 * Runner-agnostic: `bin/generate-doc-screenshots.ts` imports these helpers
 * outside the Playwright test runner, so nothing here may call `test.step(...)`
 * — it throws "test.step() can only be called from a test" there.
 */
/**
 * Navigates to `path` and waits for a heading with `headingKey`'s text, the
 * pattern almost every spec starts with. `path` is a pathname (e.g.
 * "/settings/theme").
 */
export async function gotoPage(
  page: Page,
  path: string,
  language: Language,
  headingKey: TranslationKey
): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page
    .getByRole("heading", { name: translate(language, headingKey) })
    .waitFor()
}

/**
 * Reloads the current page and waits for a heading with `headingKey`'s
 * text again, the pattern every "verify X persists after reload" step uses.
 */
export async function reloadPage(
  page: Page,
  language: Language,
  headingKey: TranslationKey
): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" })
  await page
    .getByRole("heading", { name: translate(language, headingKey) })
    .waitFor()
}

/**
 * Home's hamburger, the way into the menu section (navigation/0001). Its
 * presence is also the sign that home has rendered.
 */
export const menuButton = (page: Page, language: Language) =>
  page.getByRole("button", { name: translate(language, "nav.menu") })

/** The menu section's tab key, by its bar label. */
export type MenuTabLabelKey = "nav.activity" | "nav.catalog" | "nav.settings"

/**
 * The page's own navigation lists (the history rows, the settings groups),
 * leaving out the menu section's bar and sidebar, which are `nav`s too.
 */
export const contentNav = (page: Page, language: Language) =>
  page.locator(`nav:not([aria-label="${translate(language, "nav.menu")}"])`)

/**
 * The menu's Home entry, ahead of its tabs, which leaves the section the way
 * it was entered (navigation/0001).
 */
export const menuHome = (page: Page, language: Language) =>
  page
    .getByRole("navigation", { name: translate(language, "nav.menu") })
    .getByRole("button", { name: translate(language, "nav.home") })

/**
 * Switches to a tab of the menu section through its bar (a phone, on a
 * tab's root screen) or its sidebar (a large monitor).
 */
export async function openMenuTab(
  page: Page,
  language: Language,
  labelKey: MenuTabLabelKey
): Promise<void> {
  await page
    .getByRole("navigation", { name: translate(language, "nav.menu") })
    .getByRole("link", { name: translate(language, labelKey), exact: true })
    .click()
}

/**
 * From home: the hamburger, which opens Activity, then the tab. A
 * client-side walk, so a PIN session survives it.
 */
export async function openMenuTabFromHome(
  page: Page,
  language: Language,
  labelKey: MenuTabLabelKey
): Promise<void> {
  await menuButton(page, language).click()
  if (labelKey !== "nav.activity") {
    await openMenuTab(page, language, labelKey)
  }
}

/**
 * Navigates to "/" and ensures the home screen is showing tables/POS mode,
 * switching it via the home icon if it isn't already (the choice persists
 * across navigations, so this is a no-op once a test has switched once).
 * Waits for the "no table" tile, so the grid is ready to interact with.
 */
export async function gotoPosOverview(
  page: Page,
  language: Language
): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const noTableTile = page.getByTestId("no-table-tile")
  const switchToPos = page.getByRole("button", {
    name: translate(language, "nav.pos"),
  })
  await noTableTile.or(switchToPos).first().waitFor()
  if (await switchToPos.isVisible()) {
    await switchToPos.click()
  }
  await noTableTile.waitFor()
}

/**
 * A local write made through the real domain action layer (e.g.
 * `markCashPaid`) or through one of the `window.__e2e*` bridges is
 * fire-and-forget from Evolu's own perspective — the write is queued
 * against the local SQLite database, and a hard navigation or a fresh page
 * load can otherwise race ahead of it actually landing and read a stale
 * snapshot. Give it a moment to settle before navigating away or reloading.
 * See `markCashPaidAndSettle` and `simulateCancelAfterClaim` for the two
 * call shapes this covers.
 */
export async function waitForLocalWriteToSettle(page: Page): Promise<void> {
  await page.waitForTimeout(1000)
}

export async function switchToCzech(page: Page): Promise<void> {
  await gotoPage(page, "/settings/language", "en", "settings.language.title")
  await page.getByRole("button", { name: "Čeština" }).click()
  await page.getByRole("button", { name: "Čeština", pressed: true }).waitFor()
  await waitForLocalWriteToSettle(page)
}
