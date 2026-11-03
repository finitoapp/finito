import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createTestInvoice } from "@payky/core/modules/shared/lightning-invoice-test-fixtures"
import type { Page } from "@playwright/test"
import {
  openSettingsEntry,
  ownerPin,
  pinPrompt,
  turnOnAccessControl,
  typePin,
} from "./support/access.ts"
import { injectScanCode } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import { seedOnboarding } from "./support/onboarding.ts"

const en = (key: TranslationKey) => translate("en", key)

/**
 * A funded wallet the withdrawal flow can quote and pay from, answered in the
 * page through `window.__e2eSparkWallet` (`createE2eSparkWalletDep`).
 */
const fakeSparkWallet = (page: Page) =>
  page.addInitScript(() => {
    window.__e2eSparkWallet = {
      getBalance: async () => ({ availableSats: 100_000 }),
      getLightningSendFeeEstimate: async () => 10,
      getIdentityPublicKey: async () => `03${"cd".repeat(32)}`,
      payLightningInvoice: async () => ({ kind: "sent" }),
      getTransfer: async () => false,
    }
  })

/** A 1 000-sat mainnet invoice issued at `issuedAt`, valid for an hour. */
const invoiceIssuedAt = (issuedAt: number) =>
  createTestInvoice({
    hrp: "lnbc10u",
    timestamp: Math.floor(issuedAt / 1000),
    expirySeconds: 3600,
  })

const reviewInvoice = async (page: Page, invoice: string) => {
  await page.getByLabel(en("withdraw.destination.label")).fill(invoice)
  await page.getByRole("button", { name: en("withdraw.continue") }).click()
  await expect(page.getByText(en("withdraw.review.title"))).toBeVisible()
}

const confirmButton = (page: Page) =>
  page.getByRole("button", { name: en("withdraw.review.confirm") })

test("confirming a withdrawal asks for the PIN even during a PIN session", async ({
  page,
}) => {
  await fakeSparkWallet(page)
  await seedOnboarding(page, "en", { spark: true })

  await test.step("turn access control on from the settings list; the wizard leaves a PIN session", async () => {
    await gotoPage(page, "/settings", "en", "settings.title")
    await openSettingsEntry(page, "en", "access.title")
    await turnOnAccessControl(page, "en", { navigate: false })
  })

  await test.step("walk to a new withdrawal inside the session", async () => {
    await page.getByRole("button", { name: en("nav.back") }).click()
    await openSettingsEntry(page, "en", "settings.paymentAccounts.title")
    // The settings row just left lists "Bitcoin" among its methods, so the
    // link below would match it until the payment accounts screen is in.
    await page
      .getByRole("heading", { name: en("settings.paymentAccounts.title") })
      .waitFor()
    await page
      .getByRole("link", {
        name: new RegExp(en("settings.paymentAccounts.method.spark")),
      })
      .first()
      .click()
    await openSettingsEntry(page, "en", "settings.withdrawals.title")
    await page.getByRole("button", { name: en("withdraw.history.new") }).click()
  })

  const invoice = invoiceIssuedAt(Date.now())
  await test.step("review a Lightning invoice", () =>
    reviewInvoice(page, invoice))

  await test.step("going back keeps what was typed", async () => {
    await page
      .locator('[data-slot="card"]')
      .getByRole("button", { name: en("withdraw.review.back") })
      .click()
    await expect(page.getByLabel(en("withdraw.destination.label"))).toHaveValue(
      invoice
    )
    await page.getByRole("button", { name: en("withdraw.continue") }).click()
    await expect(page.getByText(en("withdraw.review.title"))).toBeVisible()
  })

  await test.step("confirming asks for the PIN although the session runs, naming the amount", async () => {
    await confirmButton(page).click()
    const prompt = pinPrompt(page, "en", "access.action.withdraw")
    await expect(prompt).toBeVisible()
    await expect(prompt.getByTestId("pin-prompt-detail")).toContainText("1,000")
    await typePin(page, "en", ownerPin)
  })

  await test.step("the withdrawal's detail opens", async () => {
    await expect(
      page.getByText(en("withdraw.detail.pending.ownDevice"))
    ).toBeVisible()
  })
})

test("an invoice expiring during PIN entry leaves the review with an error and a new estimate", async ({
  page,
}) => {
  const start = Date.now()
  await page.clock.install({ time: start })
  await fakeSparkWallet(page)
  await seedOnboarding(page, "en", { spark: true })
  await turnOnAccessControl(page, "en", { preset: "owner" })

  await test.step("review a Lightning invoice", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/spark/withdrawals/new",
      "en",
      "withdraw.form.title"
    )
    await reviewInvoice(page, invoiceIssuedAt(start))
  })

  await test.step("the invoice expires while the PIN is being typed", async () => {
    await confirmButton(page).click()
    await expect(pinPrompt(page, "en", "access.action.withdraw")).toBeVisible()
    await page.clock.fastForward("02:00:00")
    await typePin(page, "en", ownerPin)
  })

  await test.step("the review stays, with the error and a new estimate", async () => {
    await expect(
      page.getByText(en("withdraw.error.lightningInvoiceExpired"))
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: en("withdraw.review.newQuote") })
    ).toBeVisible()
    await expect(page.getByText(en("withdraw.review.title"))).toBeVisible()
  })
})

test("scanning a destination fills it in and closes the scanner", async ({
  page,
}) => {
  await fakeSparkWallet(page)
  await seedOnboarding(page, "en", { spark: true })
  await gotoPage(
    page,
    "/settings/payment-accounts/spark/withdrawals/new",
    "en",
    "withdraw.form.title"
  )
  const invoice = invoiceIssuedAt(Date.now())

  await test.step("open the scanner", async () => {
    await page
      .getByRole("button", { name: en("withdraw.destination.scan") })
      .click()
    await expect(
      page.getByRole("dialog", { name: en("withdraw.scan.title") })
    ).toBeVisible()
  })

  await test.step("a scanned code lands in the destination", async () => {
    await injectScanCode(page, invoice)
    await expect(
      page.getByRole("dialog", { name: en("withdraw.scan.title") })
    ).toBeHidden()
    await expect(page.getByLabel(en("withdraw.destination.label"))).toHaveValue(
      invoice
    )
  })
})
