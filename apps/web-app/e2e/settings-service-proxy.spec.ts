import {
  ownerPin,
  pinPrompt,
  turnOnAccessControl,
  typePin,
} from "./support/access.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"

test("allowing the service proxy in privacy settings hides the Fio browser warning", async ({
  seededPage: page,
}) => {
  // A browser reaches Fio only through the service proxy, so its settings
  // warn until the device allows it, and the warning leads to where it does.
  const fioWarning = page.getByText(
    translate("en", "settings.fioPlugin.nativeRuntimeWarning.title")
  )
  const serviceProxyCard = page.locator('[data-slot="card"]', {
    hasText: translate("en", "settings.privacy.serviceProxy.title"),
  })

  await test.step("the Fio settings warn without the proxy", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/iban/fio-plugin",
      "en",
      "settings.fioPlugin.title"
    )
    await expect(fioWarning).toBeVisible()
  })

  await test.step("the warning leads to the privacy settings", async () => {
    // A router link, drawn as a `Button` (role `button`).
    await page
      .getByRole("button", {
        name: translate(
          "en",
          "settings.privacy.serviceProxy.openPrivacySettings"
        ),
      })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "settings.about.privacy.title"),
      })
      .waitFor()
    await expect(
      serviceProxyCard.getByText(
        translate("en", "settings.privacy.serviceProxy.disabled"),
        { exact: true }
      )
    ).toBeVisible()
  })

  await test.step("allow the proxy", async () => {
    await serviceProxyCard
      .getByRole("button", {
        name: translate("en", "settings.privacy.serviceProxy.enable"),
      })
      .click()
    await expect(
      serviceProxyCard.getByText(
        translate("en", "settings.privacy.serviceProxy.enabled"),
        { exact: true }
      )
    ).toBeVisible()
  })

  await test.step("the Fio settings no longer warn", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/iban/fio-plugin",
      "en",
      "settings.fioPlugin.title"
    )
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "settings.fioPlugin.interval.label"),
      })
    ).toBeVisible()
    await expect(fioWarning).toHaveCount(0)
  })
})

test("turning the service proxy on or off asks a Basic device for the owner PIN", async ({
  seededPage: page,
}) => {
  const serviceProxyCard = page.locator('[data-slot="card"]', {
    hasText: translate("en", "settings.privacy.serviceProxy.title"),
  })
  const status = (key: "enabled" | "disabled") =>
    serviceProxyCard.getByText(
      translate("en", `settings.privacy.serviceProxy.${key}`),
      { exact: true }
    )
  const toggle = (key: "enable" | "disable") =>
    serviceProxyCard
      .getByRole("button", {
        name: translate("en", `settings.privacy.serviceProxy.${key}`),
      })
      .click()
  const prompt = pinPrompt(page, "en", "access.action.serviceProxy")

  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  await test.step("the privacy page opens without the PIN", async () => {
    await gotoPage(
      page,
      "/settings/about/privacy",
      "en",
      "settings.about.privacy.title"
    )
    await expect(status("disabled")).toBeVisible()
  })

  await test.step("turning it on asks; cancelling leaves it off", async () => {
    await toggle("enable")
    await expect(prompt).toBeVisible()
    await prompt
      .getByRole("button", { name: translate("en", "access.pin.cancel") })
      .click()
    await expect(prompt).toBeHidden()
    await expect(status("disabled")).toBeVisible()
  })

  await test.step("with the PIN it turns on", async () => {
    await toggle("enable")
    await expect(prompt).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(status("enabled")).toBeVisible()
  })

  await test.step("turning it off asks again: the prompt started no session", async () => {
    await toggle("disable")
    await expect(prompt).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(status("disabled")).toBeVisible()
  })
})
