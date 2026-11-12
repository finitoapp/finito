import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import {
  qerkoLegalEntityName,
  qerkoLocationName,
  qerkoPairingCode,
  routeFakeQerko,
} from "./support/qerko-mocks.ts"

const t = (key: Parameters<typeof translate>[1]) => translate("en", key)

test("pair Qerko payments: the right code leads on to the location, and finishing turns the method on", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)

  await test.step("the company and the code", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/qerko-payment",
      "en",
      "settings.qerkoPayment.title"
    )
    await page
      .getByLabel(
        t("settings.qerkoTerminal.company.identificationNumber.label")
      )
      .fill("12345678")
    await page
      .getByRole("button", { name: t("settings.qerkoTerminal.requestCode") })
      .click()
    await page
      .getByLabel(t("settings.qerkoTerminal.code.label"))
      .pressSequentially(qerkoPairingCode)
    await page
      .getByRole("button", { name: t("settings.qerkoTerminal.code.confirm") })
      .click()
  })

  await test.step("the wizard goes on to the location, not back to the company", async () => {
    // Confirming saves the key, which turns this screen into its paired view;
    // the wizard has to stay up, on its last step.
    await expect(
      page.getByText(t("settings.qerkoPayment.location.title"))
    ).toBeVisible()
    await expect(page.getByText(qerkoLocationName)).toBeVisible()
    await expect(
      page.getByLabel(
        t("settings.qerkoTerminal.company.identificationNumber.label")
      )
    ).toHaveCount(0)
  })

  await test.step("finishing pairs the location and turns the method on", async () => {
    // Serving the payments here would open Qerko's websocket, which the fake
    // does not answer.
    await page
      .getByRole("switch", {
        name: t("settings.qerkoPayment.confirm.thisDevice"),
      })
      .click()
    await page
      .getByRole("button", { name: t("settings.qerkoPayment.confirm.finish") })
      .click()
    await expect(
      page.getByText(t("settings.qerkoPayment.paired.success.title"))
    ).toBeVisible()
    await expect(page.getByText(new RegExp(qerkoLegalEntityName))).toBeVisible()
    expect(qerko.pairedLocationId).toBe("loc-1")
  })
})
