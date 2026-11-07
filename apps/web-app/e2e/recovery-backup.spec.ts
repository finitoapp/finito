import { openRecoveryWords, readShownRecoveryWords } from "./support/access.ts"
import { mockDonationApis } from "./support/donation-mocks.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { toggleInlineSwitch } from "./support/inline-edit.ts"
import { gotoPage } from "./support/navigation.ts"
import {
  createPayment,
  markCashPaid,
  markCashuPaid,
  prepareCashuPayment,
} from "./support/payment.ts"

test.use({ unverifiedBackup: true })

const homeReady = (page: import("@playwright/test").Page) =>
  expect(
    page.getByRole("button", { name: translate("en", "home.pay") })
  ).toBeVisible()

test("the backup reminder waits for more than 10,000 sats in the wallet, Later puts it off, and verifying the backup ends it", async ({
  seededPage: page,
}) => {
  test.setTimeout(60_000)
  const reminder = page.getByTestId("backup-reminder")
  const backHome = async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentWait.back") })
      .click()
    await homeReady(page)
  }

  await test.step("nothing is shown before the first payment", async () => {
    await homeReady(page)
    await expect(reminder).toBeHidden()
  })

  await test.step("use the fake mint and a fixed exchange rate, and enable Cashu", async () => {
    await page.addInitScript(() => {
      window.__e2eCashuMint = true
    })
    await mockDonationApis(page)
    await gotoPage(
      page,
      "/settings/payment-accounts",
      "en",
      "settings.paymentAccounts.title"
    )
    await toggleInlineSwitch(page, "settings.cashuAccount.enabled.label")
    await page.goto("/", { waitUntil: "domcontentloaded" })
  })

  // The fake mint lives in the page: only in-app navigation from here on.
  await test.step("a cash payment leaves the wallet empty, so nothing is shown", async () => {
    await createPayment(page, "en")
    await markCashPaid(page, "en")
    await backHome()
    await expect(reminder).toBeHidden()
  })

  // At the mocked 1,500,000 a bitcoin, 100 is about 6,667 sats.
  await test.step("about 6,700 sats in the wallet are not enough", async () => {
    await createPayment(page, "en", "100")
    await prepareCashuPayment(page, "en")
    expect(await markCashuPaid(page, "en")).toBe(1)
    await backHome()
    await expect(reminder).toBeHidden()
  })

  await test.step("back on home with about 13,300 sats, the reminder appears", async () => {
    await createPayment(page, "en", "100")
    await prepareCashuPayment(page, "en")
    // The quote of the small payment's Cashu tab may still be open; paying
    // it too only adds to the balance.
    expect(await markCashuPaid(page, "en")).toBeGreaterThanOrEqual(1)
    await page
      .getByRole("button", { name: translate("en", "paymentWait.back") })
      .click()
    await expect(reminder).toBeVisible()
  })

  await test.step("Remind me next time puts it off, past a restart", async () => {
    await reminder
      .getByRole("button", {
        name: translate("en", "settings.security.reminder.later"),
      })
      .click()
    await expect(reminder).toBeHidden()
    await page.reload({ waitUntil: "domcontentloaded" })
    await homeReady(page)
    await expect(reminder).toBeHidden()
  })

  await test.step("Security only reports the backup status", async () => {
    await gotoPage(page, "/settings/security", "en", "settings.security.title")
    await expect(page.getByTestId("recovery-verify-status")).toHaveText(
      translate("en", "settings.security.verify.status.unverified")
    )
    await expect(
      page.getByRole("group", {
        name: translate("en", "settings.security.mnemonic.label"),
      })
    ).toHaveCount(0)
  })

  await test.step("a wrong word is refused, the right ones verify the backup", async () => {
    await openRecoveryWords(page, "en")
    const words = await readShownRecoveryWords(page, "en")
    await page
      .getByRole("button", {
        name: translate("en", "settings.security.backup.continue"),
      })
      .click()
    const fields = page.getByRole("textbox")
    const slots = await fields.evaluateAll((inputs) =>
      inputs.map((input) =>
        Number(/\d+/u.exec(input.getAttribute("aria-label") ?? "")?.[0])
      )
    )
    expect(slots).toHaveLength(3)

    for (let i = 0; i < 3; i++) await fields.nth(i).fill("zzz")
    await page
      .getByRole("button", {
        name: translate("en", "settings.security.verify.submit"),
      })
      .click()
    await expect(
      page.getByText(translate("en", "settings.security.verify.wrong"))
    ).toBeVisible()

    for (let i = 0; i < 3; i++) {
      await fields.nth(i).fill(words[(slots[i] ?? 1) - 1] ?? "")
    }
    await page
      .getByRole("button", {
        name: translate("en", "settings.security.verify.submit"),
      })
      .click()
    await expect(page).toHaveURL(/\/settings\/security$/u)
    await expect(page.getByTestId("recovery-verify-status")).not.toHaveText(
      translate("en", "settings.security.verify.status.unverified")
    )
  })

  await test.step("the reminder does not come back", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await homeReady(page)
    await expect(reminder).toBeHidden()
  })
})

test("skipping the verification leaves the backup unverified", async ({
  seededPage: page,
}) => {
  await openRecoveryWords(page, "en")
  await page
    .getByRole("button", {
      name: translate("en", "settings.security.verify.skip"),
    })
    .click()
  await expect(page).toHaveURL(/\/settings\/security$/u)
  await expect(page.getByTestId("recovery-verify-status")).toHaveText(
    translate("en", "settings.security.verify.status.unverified")
  )
})
