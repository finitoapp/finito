import { paykyBrand } from "@payky/app-shared/brand"
import { createDefaultEvoluTransportUrls } from "@payky/core/evolu/device-account"
import { expect, test } from "./support/fixtures.ts"
import { translate, translateParams } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"

test("a demo account generates from today back until stopped, with its relays locked off", async ({
  seededPage: page,
}) => {
  // Stopping waits for today to be generated, which late in the day is
  // dozens of guests.
  test.setTimeout(120_000)

  await test.step("create the demo account behind the warning", async () => {
    await gotoPage(page, "/settings/demo-data", "en", "settings.demoData.title")
    await expect(
      page.getByText(translate("en", "settings.demoData.warning.relays"))
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: translate("en", "settings.demoData.action"),
      })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.demoData.confirm.confirm"),
      })
      .click()
  })

  await test.step("stop after the day in progress", async () => {
    await expect(
      page.getByRole("alertdialog", {
        name: translate("en", "demoData.running.title"),
      })
    ).toBeVisible()
    await page
      .getByRole("button", { name: translate("en", "demoData.stop") })
      .click()
    // Today is finished first, which can take a while late in the day.
    await expect(
      page.getByRole("alertdialog", {
        name: translate("en", "demoData.finished.title"),
      })
    ).toBeVisible({ timeout: 60_000 })
    await page
      .getByRole("button", { name: translate("en", "demoData.close") })
      .click()
  })

  await test.step("its relays are off and cannot be switched on", async () => {
    await gotoPage(page, "/settings/security", "en", "settings.security.title")
    await expect(
      page.getByText(translate("en", "settings.security.transports.demo"))
    ).toBeVisible()
    for (const url of createDefaultEvoluTransportUrls(
      paykyBrand.liveRelayHost
    )) {
      const toggle = page.getByRole("switch", {
        name: translateParams("en", "settings.security.transports.toggle", {
          url,
        }),
        exact: true,
      })
      await expect(toggle).not.toBeChecked()
      await expect(toggle).toBeDisabled()
    }
  })
})
