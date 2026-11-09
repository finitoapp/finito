import type { Page } from "@playwright/test"
import { openRecoveryWords, readShownRecoveryWords } from "./support/access.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import { createPayment, markCashPaidAndSettle } from "./support/payment.ts"

test.use({ unverifiedBackup: true })

const homeReady = (page: Page) =>
  expect(
    page.getByRole("button", { name: translate("en", "home.pay") })
  ).toBeVisible()

/** Home's bell, by the label it has with (`lit`) or without the dot. */
const bell = (page: Page, lit: boolean) =>
  page.getByRole("button", {
    name: translate(
      "en",
      lit ? "nav.notificationsUnread" : "nav.notifications"
    ),
    exact: true,
  })

const dot = (page: Page) => page.getByTestId("notification-dot")

const reminderCard = (page: Page) =>
  page.getByTestId("notification-recoveryPhraseBackup")

/** The account's first paid payment, then back on home. */
const payOnce = async (page: Page) => {
  await createPayment(page, "en")
  await markCashPaidAndSettle(page, "en")
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await homeReady(page)
}

const expectNoReminder = async (page: Page) => {
  await homeReady(page)
  await expect(bell(page, false)).toBeVisible()
  await expect(dot(page)).toHaveCount(0)
}

test("the backup reminder waits for the first payment and Later puts it off", async ({
  seededPage: page,
}) => {
  await test.step("nothing is lit before the first payment", async () => {
    await expectNoReminder(page)
  })

  await test.step("after a paid payment the bell lights up, with no dialog", async () => {
    await payOnce(page)
    await expect(bell(page, true)).toBeVisible()
    await expect(dot(page)).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  await test.step("the bell opens the reminder's card", async () => {
    await bell(page, true).click()
    await expect(reminderCard(page)).toBeVisible()
  })

  await test.step("Later hides the card and the dot, past a restart", async () => {
    await reminderCard(page)
      .getByRole("button", {
        name: translate("en", "notifications.recoveryBackup.later"),
      })
      .click()
    await expect(reminderCard(page)).toHaveCount(0)
    await expect(
      page.getByText(translate("en", "notifications.empty.title"))
    ).toBeVisible()
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expectNoReminder(page)
    await page.reload({ waitUntil: "domcontentloaded" })
    await expectNoReminder(page)
  })
})

test("Back up on the reminder opens the backup and leaves the reminder on", async ({
  seededPage: page,
}) => {
  await test.step("a paid payment lights the bell", async () => {
    await payOnce(page)
    await expect(dot(page)).toBeVisible()
  })

  await test.step("Back up opens the backup screen", async () => {
    await bell(page, true).click()
    await reminderCard(page)
      .getByRole("button", {
        name: translate("en", "notifications.recoveryBackup.action"),
      })
      .click()
    await expect(page).toHaveURL(/\/settings\/security\/backup$/u)
    await expect(
      page.getByRole("heading", {
        name: translate("en", "settings.security.mnemonic.title"),
      })
    ).toBeVisible()
  })

  await test.step("an unfinished backup leaves the bell lit", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(dot(page)).toBeVisible()
  })
})

test("verifying the backup ends the reminder", async ({ seededPage: page }) => {
  await test.step("a paid payment lights the bell", async () => {
    await payOnce(page)
    await expect(dot(page)).toBeVisible()
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

  await test.step("no dot on the bell and Notifications is empty", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expectNoReminder(page)
    await bell(page, false).click()
    await expect(
      page.getByText(translate("en", "notifications.empty.title"))
    ).toBeVisible()
    await expect(reminderCard(page)).toHaveCount(0)
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
