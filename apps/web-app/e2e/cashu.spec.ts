import { createTestInvoice } from "@payky/core/modules/shared/lightning-invoice-test-fixtures"
import type { Page } from "@playwright/test"
import { openSettingsEntry } from "./support/access.ts"
import { mockDonationApis } from "./support/donation-mocks.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { toggleInlineSwitch } from "./support/inline-edit.ts"
import { gotoPage, openMenuTabFromHome } from "./support/navigation.ts"
import {
  createPayment,
  markCashuPaid,
  prepareCashuPayment,
} from "./support/payment.ts"

test("enable Cashu, take a payment over the mint's invoice and see it settle", async ({
  seededPage: page,
}) => {
  // The Cashu job polls a fresh quote every 5 s.
  test.setTimeout(60_000)

  await test.step("use the fake mint and a fixed exchange rate", async () => {
    await page.addInitScript(() => {
      window.__e2eCashuMint = true
    })
    await mockDonationApis(page)
  })

  await test.step("enable Cashu in the payment methods", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts",
      "en",
      "settings.paymentAccounts.title"
    )
    await toggleInlineSwitch(page, "settings.cashuAccount.enabled.label")
  })

  await test.step("create a payment", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await createPayment(page, "en")
  })

  await test.step("open the Cashu tab and wait for the QR", () =>
    prepareCashuPayment(page, "en"))

  await test.step("the customer pays the mint's invoice and the payment settles", async () => {
    expect(await markCashuPaid(page, "en")).toBe(1)
  })
})

test("the mints screen lists the default mint with its balance", async ({
  seededPage: page,
}) => {
  await test.step("use the fake mint", async () => {
    await page.addInitScript(() => {
      window.__e2eCashuMint = true
    })
  })

  await test.step("enable Cashu", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts",
      "en",
      "settings.paymentAccounts.title"
    )
    await toggleInlineSwitch(page, "settings.cashuAccount.enabled.label")
  })

  await test.step("open the mints", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/cashu/mints",
      "en",
      "settings.cashuMints.title"
    )
    await expect(page.getByText("cashu.cz")).toBeVisible()
    await expect(
      page.getByText(translate("en", "settings.cashuMints.default"))
    ).toBeVisible()
  })
})

/** A 50-sat mainnet invoice valid for an hour. */
const invoice50 = () =>
  createTestInvoice({
    hrp: "lnbc500n",
    timestamp: Math.floor(Date.now() / 1000),
    expirySeconds: 3600,
  })

const fundCashuWallet = async (page: Page) => {
  await test.step("use the fake mint and a fixed exchange rate", async () => {
    await page.addInitScript(() => {
      window.__e2eCashuMint = true
    })
    await mockDonationApis(page)
  })

  await test.step("enable Cashu", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts",
      "en",
      "settings.paymentAccounts.title"
    )
    await toggleInlineSwitch(page, "settings.cashuAccount.enabled.label")
  })

  await test.step("take a Cashu payment so the mint holds ecash", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await createPayment(page, "en")
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.cashu") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "paymentWait.copyQr") })
      .locator("svg.size-full")
      .waitFor()
    await page.waitForFunction(
      () => typeof window.__e2eCashuPayQuotes === "function"
    )
    expect(await page.evaluate(() => window.__e2eCashuPayQuotes?.())).toBe(1)
    await expect(
      page
        .getByTestId("payment-paid-panel")
        .getByText(translate("en", "paymentWait.paid"))
    ).toBeVisible({ timeout: 30_000 })
  })
}

/** The fake mint lives in the page: only in-app navigation from the paid payment. */
const walkToNewCashuWithdrawal = (page: Page) =>
  test.step("walk to a new Cashu withdrawal", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentWait.back") })
      .click()
    await openMenuTabFromHome(page, "en", "nav.settings")
    await openSettingsEntry(page, "en", "settings.paymentAccounts.title")
    await page
      .getByRole("link", {
        name: new RegExp(
          translate("en", "settings.paymentAccounts.method.cashu")
        ),
      })
      .first()
      .click()
    await openSettingsEntry(page, "en", "settings.cashuAccount.withdraw")
    await expect(
      page.getByText(translate("en", "withdraw.history.empty"))
    ).toBeVisible()
    await page
      .getByRole("button", { name: translate("en", "withdraw.history.new") })
      .click()
  })

test("withdraw from a mint to a Lightning invoice and follow it on its detail", async ({
  seededPage: page,
}) => {
  test.setTimeout(60_000)
  await fundCashuWallet(page)

  await walkToNewCashuWithdrawal(page)

  const destination = page.getByLabel(
    translate("en", "withdraw.destination.label")
  )
  await test.step("an on-chain address is refused while typing", async () => {
    await destination.fill("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")
    await expect(
      page.getByText(translate("en", "withdraw.cashu.error.onchain"))
    ).toBeVisible()
  })

  await test.step("an invoice sets the amount; review the mint's fees", async () => {
    await destination.fill(invoice50())
    await expect(
      page.getByLabel(translate("en", "withdraw.amount.label"), { exact: true })
    ).toHaveValue("50")
    await expect(
      page.getByLabel(translate("en", "withdraw.amount.label"), { exact: true })
    ).toBeDisabled()
    await page
      .getByRole("button", { name: translate("en", "withdraw.continue") })
      .click()
    await expect(
      page.getByText(translate("en", "withdraw.review.title"))
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "withdraw.cashu.review.feeReserve"))
    ).toBeVisible()
  })

  await test.step("confirming pays it and opens its detail", async () => {
    await page
      .getByRole("button", { name: translate("en", "withdraw.review.confirm") })
      .click()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "withdraw.detail.title"),
      })
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "withdraw.status.done"))
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "withdraw.kind.cashu"))
    ).toBeVisible()
  })
})

test("withdraw all from a mint to a Lightning address", async ({
  seededPage: page,
}) => {
  test.setTimeout(60_000)
  await fundCashuWallet(page)
  await walkToNewCashuWithdrawal(page)

  await test.step("a Lightning address offers withdraw all", async () => {
    await page
      .getByLabel(translate("en", "withdraw.destination.label"))
      .fill("donate@payky.me")
    await expect(
      page.getByText(
        translate("en", "withdraw.destination.kind.lightningAddress"),
        { exact: true }
      )
    ).toBeVisible()
    await page
      .getByRole("checkbox", { name: translate("en", "withdraw.all.label") })
      .check()
    await expect(
      page.getByLabel(translate("en", "withdraw.amount.label"), { exact: true })
    ).toBeDisabled()
    await page
      .getByRole("button", { name: translate("en", "withdraw.continue") })
      .click()
    await expect(
      page.getByText(translate("en", "withdraw.review.title"))
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "withdraw.cashu.review.feeReserve"))
    ).toBeVisible()
  })

  await test.step("confirming pays it and opens its detail", async () => {
    await page
      .getByRole("button", { name: translate("en", "withdraw.review.confirm") })
      .click()
    await expect(
      page.getByText(translate("en", "withdraw.status.done"))
    ).toBeVisible()
  })
})
