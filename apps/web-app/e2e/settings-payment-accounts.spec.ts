import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { Page } from "@playwright/test"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate } from "./support/i18n.ts"
import {
  expandAdvancedOptions,
  pickInlineOption,
  toggleInlineSwitch,
} from "./support/inline-edit.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"

const en = (key: TranslationKey) => translate("en", key)

const methodRows = (page: Page) =>
  page
    .getByRole("list")
    .filter({ hasText: en("settings.paymentAccounts.method.spark") })
    .getByRole("listitem")

const methodRow = (page: Page, titleKey: TranslationKey) =>
  methodRows(page).filter({ hasText: en(titleKey) })

const defaultBadge = (page: Page, titleKey: TranslationKey) =>
  methodRow(page, titleKey).getByText(en("settings.paymentAccounts.default"), {
    exact: true,
  })

const reorderGrip = (page: Page, titleKey: TranslationKey) =>
  page.getByRole("button", {
    name: nameParam("settings.paymentAccounts.reorder.aria", en(titleKey)),
  })

/** Drags a method's grip to the top edge of the list, as a finger or mouse would, in steps so motion sees the movement. */
async function dragMethodToTop(page: Page, titleKey: TranslationKey) {
  const grip = await reorderGrip(page, titleKey).boundingBox()
  const list = await methodRows(page).first().boundingBox()
  if (grip === null || list === null) throw new Error("rows not laid out")
  const x = grip.x + grip.width / 2
  await page.mouse.move(x, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, list.y + 2, { steps: 12 })
  await page.mouse.up()
}

const openOverview = (page: Page) =>
  gotoPage(
    page,
    "/settings/payment-accounts",
    "en",
    "settings.paymentAccounts.title"
  )

test("reorder payment methods and let the first available one be the default", async ({
  seededPage: page,
}) => {
  await test.step("open payment accounts settings", () => openOverview(page))

  // The seed makes the cash register the default, so it leads the list.
  await test.step("the default method comes first", async () => {
    await expect(methodRows(page).first()).toContainText(
      en("settings.paymentAccounts.method.cashRegister")
    )
    await expect(
      defaultBadge(page, "settings.paymentAccounts.method.cashRegister")
    ).toBeVisible()
  })

  await test.step("drag the bank transfer to the top", async () => {
    await dragMethodToTop(page, "settings.paymentAccounts.method.iban")
    await expect(methodRows(page).first()).toContainText(
      en("settings.paymentAccounts.method.iban")
    )
    await expect(
      defaultBadge(page, "settings.paymentAccounts.method.iban")
    ).toBeVisible()
  })

  await test.step("the arrow keys move a focused grip too", async () => {
    const grip = reorderGrip(page, "settings.paymentAccounts.method.iban")
    await grip.focus()
    await page.keyboard.press("ArrowDown")
    await expect(methodRows(page).first()).toContainText(
      en("settings.paymentAccounts.method.cashRegister")
    )
    await grip.focus()
    await page.keyboard.press("ArrowUp")
    await expect(methodRows(page).first()).toContainText(
      en("settings.paymentAccounts.method.iban")
    )
  })

  await test.step("turning the first method off hands the default to the next available one", async () => {
    await toggleInlineSwitch(page, "settings.fiatBankAccount.enabled.label")
    await expect(
      defaultBadge(page, "settings.paymentAccounts.method.cashRegister")
    ).toBeVisible()
    await expect(
      defaultBadge(page, "settings.paymentAccounts.method.iban")
    ).toHaveCount(0)
  })

  await test.step("the order and the disabled method persist after reload", async () => {
    await reloadPage(page, "en", "settings.paymentAccounts.title")
    await expect(methodRows(page).first()).toContainText(
      en("settings.paymentAccounts.method.iban")
    )
    await expect(
      page.getByRole("switch", {
        name: en("settings.fiatBankAccount.enabled.label"),
      })
    ).not.toBeChecked()
    await expect(
      defaultBadge(page, "settings.paymentAccounts.method.cashRegister")
    ).toBeVisible()
  })
})

test("edit the fiat bank account on its own page", async ({
  seededPage: page,
}) => {
  await test.step("open the bank transfer details", async () => {
    await openOverview(page)
    await methodRow(page, "settings.paymentAccounts.method.iban")
      .getByRole("link")
      .click()
    await expect(
      page.getByRole("heading", {
        name: en("settings.paymentAccounts.method.iban"),
      })
    ).toBeVisible()
  })

  await test.step("change the bank account currency", async () => {
    await expandAdvancedOptions(
      page,
      "settings.fiatBankAccount.form.title",
      "settings.fiatBankAccount.advanced"
    )
    await pickInlineOption(
      page,
      "settings.fiatBankAccount.currency.label",
      en("settings.fiat.eur.title")
    )
  })

  // The seed runs the app in USD, so an EUR bank account is no longer
  // offered, and the overview says why instead of dropping it silently.
  await test.step("the overview flags the currency mismatch", async () => {
    await openOverview(page)
    await expect(
      methodRow(page, "settings.paymentAccounts.method.iban")
    ).toContainText(
      en("settings.paymentAccounts.status.currencyMismatch")
        .replace("{currency}", "EUR")
        .replace("{appCurrency}", "USD")
    )
    await expect(
      defaultBadge(page, "settings.paymentAccounts.method.iban")
    ).toHaveCount(0)
  })
})
