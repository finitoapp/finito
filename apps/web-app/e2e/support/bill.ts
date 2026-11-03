import type { Language } from "@payky/app-shared/i18n/resources"
import { expect, type Page } from "@playwright/test"
import { nameParam, translate } from "./i18n.ts"
import {
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./navigation.ts"

/**
 * Runner-agnostic: `bin/generate-doc-screenshots.ts` imports these helpers
 * outside the Playwright test runner, so nothing here may call `test.step(...)`
 * — it throws "test.step() can only be called from a test" there.
 */
/**
 * Switches the home screen into tables/POS mode via the home icon and
 * starts a new bill via the "no table" tile's "+" link, landing on the
 * bill page. Assumes the page is already on "/".
 */
export async function startNewBill(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "nav.pos") })
    .click()
  await page
    .getByTestId("no-table-tile")
    .getByRole("link", { name: translate(language, "tables.tile.newBill") })
    .click()
  await page
    .getByRole("heading", { name: translate(language, "bill.title") })
    .waitFor()
}

/**
 * The viewport center of a catalog brick's "+" button, for specs that drive
 * `page.mouse` directly instead of using `locator.click()`.
 */
export async function addBrickCenter(
  page: Page,
  name: string
): Promise<{ readonly x: number; readonly y: number }> {
  const box = await page
    .getByRole("button", { name: nameParam("bill.brick.add.aria", name) })
    .boundingBox()
  if (box === null) throw new Error(`No bounding box for the "${name}" brick`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * Taps a catalog brick's "+" button with a raw mouse click at its center,
 * the way a finger lands on a real terminal. Unlike `locator.click()` this
 * does not wait for the button to be enabled and does not re-resolve the
 * target, so a tap the app drops — by disabling the control between the
 * press and the release, or by remounting the grid under it — is genuinely
 * lost instead of being papered over by Playwright's actionability waiting.
 * Use it wherever a spec fires taps faster than the cart can settle.
 */
export async function tapAddBrick(page: Page, name: string): Promise<void> {
  const { x, y } = await addBrickCenter(page, name)
  await page.mouse.click(x, y)
}

/**
 * Starts a fresh bill and adds one "Coffee" ($5) brick to it (assumes a
 * catalog item named "Coffee" was already seeded via `addCatalogItem`),
 * returning its bill id read off the URL. Leaves the page on the bill's own
 * cart view. Uses `gotoPosOverview` (tolerant of already being in POS/tables
 * mode, e.g. right after a previous bill's pay cycle in the same test)
 * rather than assuming the numpad is showing.
 *
 * `billId` is in the URL from the moment the cart opens (generated up
 * front, not once the bill is lazily created), so it's no longer a signal
 * that the create-plus-add-line write has landed — waits for that to settle
 * (see `waitForLocalWriteToSettle`) before returning, so callers that hard-
 * navigate right away don't race ahead of it.
 */
export async function startBillWithCoffee(
  page: Page,
  language: Language
): Promise<string> {
  await gotoPosOverview(page, language)
  await page
    .getByTestId("no-table-tile")
    .getByRole("link", { name: translate(language, "tables.tile.newBill") })
    .click()
  await page
    .getByRole("heading", { name: translate(language, "bill.title") })
    .waitFor()
  await page
    .getByRole("button", {
      name: translate(language, "bill.brick.add.aria").replace(
        "{name}",
        "Coffee"
      ),
    })
    .click()

  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
  const billId = new URL(page.url()).searchParams.get("billId")
  if (!billId) {
    throw new Error("Could not determine bill id from URL.")
  }
  await waitForLocalWriteToSettle(page)
  return billId
}

/** Adds a catalog item through the real settings UI (used to seed items for cart specs). */
export async function addCatalogItem(
  page: Page,
  language: Language,
  input: {
    readonly name: string
    readonly price: string
    readonly categoryName?: string
    readonly scanCode?: string
    readonly internalName?: string
    readonly sku?: string
    readonly taxRateName?: string
  }
): Promise<void> {
  await gotoPage(page, "/catalog/items", language, "catalog.items.title")
  await page
    .getByRole("button", { name: translate(language, "catalog.items.add") })
    .click()
  await page
    .getByRole("heading", {
      name: translate(language, "catalog.items.form.title.create"),
    })
    .waitFor()
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.items.form.name.label"),
      exact: true,
    })
    .fill(input.name)
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.items.form.price.label"),
    })
    .fill(input.price)
  if (input.internalName !== undefined) {
    await page
      .getByRole("textbox", {
        name: translate(language, "catalog.items.form.internalName.label"),
      })
      .fill(input.internalName)
  }
  if (input.sku !== undefined) {
    await page
      .getByRole("textbox", {
        name: translate(language, "catalog.items.form.sku.label"),
      })
      .fill(input.sku)
  }
  if (input.categoryName !== undefined) {
    await page
      .getByRole("combobox", {
        name: translate(language, "catalog.items.form.category.label"),
      })
      .click()
    await page.getByRole("option", { name: input.categoryName }).click()
  }
  if (input.scanCode !== undefined) {
    await page
      .getByRole("textbox", {
        name: translate(language, "catalog.items.form.scanCode.label"),
      })
      .fill(input.scanCode)
  }
  if (input.taxRateName !== undefined) {
    await page
      .getByRole("combobox", {
        name: translate(language, "catalog.items.form.taxRate.label"),
      })
      .click()
    await page
      .getByRole("option", { name: new RegExp(input.taxRateName) })
      .click()
  }
  await page
    .getByRole("button", {
      name: translate(language, "catalog.items.form.save.create"),
    })
    .click()
  await page
    .getByRole("heading", { name: translate(language, "catalog.items.title") })
    .waitFor()
}

/** Toggles bill scan mode on via its icon next to the search input. Assumes the page is already on the bill cart view. */
export async function enterBillScanMode(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "bill.scan.toggle.aria") })
    .click()
}

/**
 * Simulates the camera decoding `rawValue` via `window.__e2eInjectScanCode`
 * (see src/components/scan-code-scanner.tsx) — there is no real camera or
 * barcode to scan in a test run. Assumes a `ScanCodeScanner` is currently
 * mounted (e.g. bill scan mode is on, via `enterBillScanMode`).
 */
export async function injectScanCode(
  page: Page,
  rawValue: string
): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__e2eInjectScanCode === "function"
  )
  await page.evaluate((value) => window.__e2eInjectScanCode?.(value), rawValue)
}

/** Adds a catalog category through the real settings UI (used to seed categories for bill filter specs). */
export async function addCatalogCategory(
  page: Page,
  language: Language,
  name: string
): Promise<void> {
  await gotoPage(
    page,
    "/catalog/categories",
    language,
    "catalog.categories.title"
  )
  await page
    .getByRole("button", {
      name: translate(language, "catalog.categories.add"),
    })
    .click()
  await page
    .getByRole("heading", {
      name: translate(language, "catalog.categories.form.title.create"),
    })
    .waitFor()
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.categories.form.name.label"),
    })
    .fill(name)
  await page
    .getByRole("button", {
      name: translate(language, "catalog.categories.form.save.create"),
    })
    .click()
  await page
    .getByRole("heading", {
      name: translate(language, "catalog.categories.title"),
    })
    .waitFor()
}

/** Adds a tax rate through the real settings UI (used to seed tax rates for bill/payment recap specs). */
export async function addTaxRate(
  page: Page,
  language: Language,
  input: { readonly name: string; readonly rate: string }
): Promise<void> {
  await gotoPage(
    page,
    "/settings/tax-rates",
    language,
    "settings.taxRates.title"
  )
  await page
    .getByRole("textbox", {
      name: translate(language, "settings.taxRates.name.label"),
      exact: true,
    })
    .fill(input.name)
  await page
    .getByRole("textbox", {
      name: translate(language, "settings.taxRates.rate.label"),
    })
    .fill(input.rate)
  await page
    .getByRole("button", { name: translate(language, "settings.taxRates.add") })
    .click()
  // Unlike the item/table/category forms, adding a rate stays on the page,
  // so there is no navigation to wait on — and every caller's next step is a
  // hard `page.goto`, which reads a stale snapshot if it overtakes the
  // write. The rendered row is that signal: it comes from Evolu's own query
  // subscription, so the write has reached the database by then. Cheaper and
  // firmer than `waitForLocalWriteToSettle`'s fixed wait.
  await expect(page.getByText(input.name, { exact: true })).toBeVisible()
}

/** Adds a table through the real settings UI (used to seed tables for bill/floor-view specs). */
export async function addTable(
  page: Page,
  language: Language,
  input: { readonly name: string; readonly seatCount: string }
): Promise<void> {
  await gotoPage(page, "/catalog/tables", language, "catalog.tables.title")
  await page
    .getByRole("button", { name: translate(language, "catalog.tables.add") })
    .click()
  await page
    .getByRole("heading", {
      name: translate(language, "catalog.tables.form.title.create"),
    })
    .waitFor()
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.tables.form.name.label"),
    })
    .fill(input.name)
  await page
    .getByRole("textbox", {
      name: translate(language, "catalog.tables.form.seatCount.label"),
    })
    .fill(input.seatCount)
  await page
    .getByRole("button", {
      name: translate(language, "catalog.tables.form.save.create"),
    })
    .click()
  await page
    .getByRole("heading", {
      name: translate(language, "catalog.tables.title"),
    })
    .waitFor()
}

/**
 * Types `code` the way a keyboard-wedge (HID) barcode scanner does: every
 * character back to back, then Enter — fast enough for
 * `src/hooks/use-hardware-scanner.ts` to tell it apart from typing.
 */
export async function typeHardwareScan(
  page: Page,
  code: string
): Promise<void> {
  await page.keyboard.type(code)
  await page.keyboard.press("Enter")
}
