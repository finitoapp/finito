import { openRecoveryWords, readShownRecoveryWords } from "./support/access.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import { createPayment, markCashPaidAndSettle } from "./support/payment.ts"

test.use({ unverifiedBackup: true })

const homeReady = (page: import("@playwright/test").Page) =>
  expect(
    page.getByRole("button", { name: translate("en", "home.pay") })
  ).toBeVisible()

test("the backup reminder waits for the first payment, Later puts it off, and verifying the backup ends it", async ({
  seededPage: page,
}) => {
  const reminder = page.getByTestId("backup-reminder")

  await test.step("nothing is shown before the first payment", async () => {
    await homeReady(page)
    await expect(reminder).toBeHidden()
  })

  await test.step("back on home after a paid payment, the reminder appears", async () => {
    await createPayment(page, "en")
    await markCashPaidAndSettle(page, "en")
    await page.goto("/", { waitUntil: "domcontentloaded" })
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
