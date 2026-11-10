import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { fillInlineField } from "./support/inline-edit.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"
import { seedActiveFioPlugin } from "./support/self-pay.ts"

test("save Fio settings and add a token, in either order", async ({
  seededPage: page,
}) => {
  // Its two moving parts are exactly the
  // ones that used to be wrong: the token was written by the settings form
  // (so every save duplicated it), and everything was gated on whether the
  // `fioPlugin` row existed yet.

  // Errors this page has nothing to do with. Both only get their turn to be
  // logged when the run is slow, which is why they failed the full suite and
  // never this spec on its own. Every other console error, and every
  // pageerror, still fails the test below.
  const unrelatedConsoleErrors = [
    // Adding a token below arms the FIO sync job, which then calls the real
    // API with this test's bogus token and logs the failure through
    // `app-background-jobs.tsx`'s `onError` — this test's own doing.
    "Background job failed.",
    // Chromium itself, not the app: the e2e server is HTTPS with a
    // self-signed certificate on purpose, and `ignoreHTTPSErrors` does not
    // cover a worker script fetch (Evolu spawns a database worker and a
    // shared worker per client). Cosmetic — the page works, as the
    // assertions above it check.
    "An SSL certificate error occurred when fetching the script.",
  ]
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    if (unrelatedConsoleErrors.some((unrelated) => text.includes(unrelated))) {
      return
    }
    consoleErrors.push(text)
  })
  page.on("pageerror", (error) => consoleErrors.push(String(error)))

  const intervalField = page.getByRole("textbox", {
    name: translate("en", "settings.fioPlugin.interval.label"),
  })
  const tokenField = page.getByLabel(
    translate("en", "settings.fioPlugin.token.label")
  )
  const tokenRows = page.locator("li", {
    hasText: translate("en", "settings.fioPlugin.tokens.item"),
  })

  await test.step("open with no plugin row saved yet", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/iban/fio-plugin",
      "en",
      "settings.fioPlugin.title"
    )

    // The plugin id is fixed, so the settings are editable straight away
    // rather than through a create-then-edit flow, and so are the tokens.
    await expect(intervalField).toBeVisible()
    await expect(tokenField).toBeVisible()
  })

  await test.step("add a token before the plugin exists", async () => {
    await tokenField.fill("e2e-fio-token")
    await page
      .getByRole("button", {
        name: translate("en", "settings.fioPlugin.tokens.add.submit"),
      })
      .click()
    await expect(tokenRows).toHaveCount(1)
  })

  await test.step("save a setting without touching the token", async () => {
    await fillInlineField(page, intervalField, "45")
    // The token is neither duplicated nor rewritten by an unrelated save.
    await expect(tokenRows).toHaveCount(1)
  })

  await test.step("the setting survives a reload", async () => {
    await reloadPage(page, "en", "settings.fioPlugin.title")
    await expect(intervalField).toHaveValue("45")
  })

  expect(consoleErrors).toEqual([])
})

test("a browser saving the interval keeps the plugin on for the devices that sync Fio", async ({
  seededPage: page,
}) => {
  const intervalField = page.getByRole("textbox", {
    name: translate("en", "settings.fioPlugin.interval.label"),
  })
  const pluginIsActive = () =>
    page.evaluate(async () => (await window.__e2eReadFioPlugin?.())?.isActive)

  await test.step("a device that syncs Fio switched the plugin on", async () => {
    await seedActiveFioPlugin(page)
    await gotoPage(
      page,
      "/settings/payment-accounts/iban/fio-plugin",
      "en",
      "settings.fioPlugin.title"
    )
    await expect.poll(pluginIsActive).toBe(true)
  })

  await test.step("the browser saves the interval and the plugin stays on", async () => {
    await fillInlineField(page, intervalField, "45")
    await reloadPage(page, "en", "settings.fioPlugin.title")
    await expect(intervalField).toHaveValue("45")
    await expect.poll(pluginIsActive).toBe(true)
  })
})
