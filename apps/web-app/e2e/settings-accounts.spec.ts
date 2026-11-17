import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import {
  completeOnboardingDefaults,
  seedOnboarding,
} from "./support/onboarding.ts"

test("create, switch, and remove a device account", async ({
  seededPage: page,
}) => {
  // Creating and switching accounts spins up a brand new local database each
  // time, which is slower than a plain settings save.
  test.setTimeout(60_000)

  await test.step("open device accounts settings", () =>
    gotoPage(page, "/settings/accounts", "en", "settings.accounts.title"))

  // Adding opens onboarding's welcome in a new, empty account (account/0011).
  await test.step("add a second account", () =>
    page
      .getByRole("button", {
        name: translate("en", "settings.accounts.add.title"),
      })
      .click())

  await test.step("complete onboarding for the new account", () =>
    completeOnboardingDefaults(page, "en"))

  const accountRows = page.getByTestId("account-list").getByRole("listitem")
  // accountListQuery orders by createdAt ascending, so the first-created
  // account is always the first row regardless of which one is active.
  const [firstCreatedRow, secondCreatedRow] = [
    accountRows.nth(0),
    accountRows.nth(1),
  ]

  await test.step("verify both accounts are listed with the new one active", async () => {
    await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
    await expect(accountRows).toHaveCount(2)
    await expect(
      firstCreatedRow.getByRole("button", {
        name: translate("en", "settings.accounts.list.switch"),
      })
    ).toBeVisible()
    await expect(
      secondCreatedRow.getByText(
        translate("en", "settings.accounts.list.active")
      )
    ).toBeVisible()
  })

  await test.step("switch back to the first-created account", async () => {
    await firstCreatedRow
      .getByRole("button", {
        name: translate("en", "settings.accounts.list.switch"),
      })
      .click()
    await expect(
      firstCreatedRow.getByText(
        translate("en", "settings.accounts.list.active")
      )
    ).toBeVisible()
    await expect(
      secondCreatedRow.getByRole("button", {
        name: translate("en", "settings.accounts.list.switch"),
      })
    ).toBeVisible()
  })

  const removeButton = secondCreatedRow.getByRole("button", {
    name: translate("en", "settings.accounts.list.remove"),
  })

  await test.step("canceling the remove confirmation keeps the account", async () => {
    await removeButton.click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.remove.confirm.cancel"),
      })
      .click()
    await expect(accountRows).toHaveCount(2)
  })

  await test.step("remove the now non-active second account", async () => {
    // Confirmed, not one-tap: removal is a soft delete no query ever shows
    // again, and an account created here has never synced anywhere.
    await removeButton.click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.remove.confirm.confirm"),
      })
      .click()
    await expect(accountRows).toHaveCount(1)
  })
})

test("canceling setup from onboarding discards the new account and switches back", async ({
  seededPage: page,
}) => {
  test.setTimeout(60_000)

  await test.step("add a second account", async () => {
    await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.add.title"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "onboarding.title") })
      .waitFor()
  })

  await test.step("cancel setup instead of completing onboarding", async () => {
    await page
      .getByRole("button", { name: translate("en", "onboarding.cancelSetup") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "onboarding.cancelSetup.confirm.confirm"),
      })
      .click()
  })

  await test.step("lands back on the terminal home screen for the original account", async () => {
    await page
      .getByRole("button", { name: translate("en", "nav.menu") })
      .waitFor()
  })

  await test.step("the discarded account no longer appears in the account list", async () => {
    await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
    await expect(
      page.getByTestId("account-list").getByRole("listitem")
    ).toHaveCount(1)
  })
})

test("removing the only copy of an unverified account offers the backup first", async ({
  page,
}) => {
  await seedOnboarding(page, "en", { unverifiedBackup: true })
  await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
  const accountRows = page.getByTestId("account-list").getByRole("listitem")

  await test.step("the removal becomes a trip to the backup, and nothing is removed", async () => {
    await accountRows
      .first()
      .getByRole("button", {
        name: translate("en", "settings.accounts.list.remove"),
      })
      .click()
    await expect(
      page.getByText(
        translate("en", "settings.accounts.remove.backupFirst.title")
      )
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.remove.backupFirst.confirm"),
      })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "settings.security.mnemonic.title"),
      })
      .waitFor()
    await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
    await expect(accountRows).toHaveCount(1)
  })
})

test("removing the only account leaves for onboarding's welcome", async ({
  seededPage: page,
}) => {
  test.setTimeout(60_000)
  await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
  const accountRows = page.getByTestId("account-list").getByRole("listitem")

  await test.step("a backed-up account is removed after a confirmation", async () => {
    await accountRows
      .first()
      .getByRole("button", {
        name: translate("en", "settings.accounts.list.remove"),
      })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.remove.confirm.confirm"),
      })
      .click()
  })

  await test.step("a new, empty account starts on the welcome screen", () =>
    page
      .getByRole("heading", { name: translate("en", "onboarding.title") })
      .waitFor())
})
