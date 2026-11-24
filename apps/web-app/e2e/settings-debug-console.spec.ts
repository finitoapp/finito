import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"

test("view, pause, and clear captured console output", async ({
  seededPage: page,
}) => {
  await test.step("open the debug console", () =>
    gotoPage(
      page,
      "/settings/debug-console",
      "en",
      "settings.debugConsole.title"
    ))

  const entries = page.getByTestId("debug-console-entries").getByRole("article")
  const pauseButton = page.getByRole("button", {
    name: translate("en", "settings.debugConsole.pause"),
  })
  const resumeButton = page.getByRole("button", {
    name: translate("en", "settings.debugConsole.resume"),
  })

  await test.step("verify entries captured during onboarding are shown", async () => {
    await expect(entries.first()).toBeVisible()
  })

  await test.step("pause then resume capturing", async () => {
    await pauseButton.click()
    await resumeButton.waitFor()
    await resumeButton.click()
    await pauseButton.waitFor()
  })

  await test.step("clear the history while updates are paused", async () => {
    // Background jobs can log again between clearing and checking the empty state.
    await pauseButton.click()
    await expect(resumeButton).toBeVisible()
    await page
      .getByRole("button", {
        name: translate("en", "settings.debugConsole.clear"),
      })
      .click()
    await expect(
      page.getByText(translate("en", "settings.debugConsole.empty"))
    ).toBeVisible()
    await expect(entries).toHaveCount(0)
  })
})

test("capture unhandled errors, then filter, copy and export the log", async ({
  seededPage: page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

  await test.step("open the debug console", () =>
    gotoPage(
      page,
      "/settings/debug-console",
      "en",
      "settings.debugConsole.title"
    ))

  const entries = page.getByTestId("debug-console-entries").getByRole("article")
  const alpha = entries.filter({ hasText: "e2e marker alpha" })
  const beta = entries.filter({ hasText: "e2e marker beta" })
  const search = page.getByRole("textbox", {
    name: translate("en", "settings.debugConsole.filter.search"),
  })

  await test.step("capture an uncaught error and an unhandled rejection", async () => {
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("e2e marker alpha")
      })
      void Promise.reject(new Error("e2e marker beta"))
    })
    // Once each: one listener per event, StrictMode notwithstanding.
    await expect(alpha).toHaveCount(1)
    await expect(beta).toHaveCount(1)
    await expect(alpha).toContainText("unhandled")
  })

  await test.step("pause, so background jobs cannot change the list", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "settings.debugConsole.pause"),
      })
      .click()
  })

  await test.step("narrow the list by text", async () => {
    await search.fill("e2e marker alpha")
    await expect(entries).toHaveCount(1)
    await expect(alpha).toBeVisible()
  })

  await test.step("copy holds what is shown, redacted log format", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "settings.debugConsole.copy"),
        exact: true,
      })
      .click()
    await expect(
      page.getByText(translate("en", "settings.debugConsole.copied"))
    ).toBeVisible()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain("App: Payky")
    expect(clipboard).toContain("Entries: 1")
    expect(clipboard).toMatch(/ERROR unhandled .*e2e marker alpha/)
    expect(clipboard).not.toContain("e2e marker beta")
  })

  await test.step("export holds every buffered entry", async () => {
    const downloadPromise = page.waitForEvent("download")
    await page
      .getByRole("button", {
        name: translate("en", "settings.debugConsole.export"),
      })
      .click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(
      /^payky-console-\d{8}-\d{6}\.txt$/
    )
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    const file = Buffer.concat(chunks).toString("utf8")
    expect(file).toContain("App: Payky")
    expect(file).toMatch(/^Version: /m)
    expect(file).toContain("e2e marker alpha")
    expect(file).toContain("e2e marker beta")
  })

  await test.step("narrow the list by level", async () => {
    await search.fill("")
    await expect(beta).toBeVisible()
    await page
      .getByRole("button", {
        name: new RegExp(
          `^${translate("en", "settings.debugConsole.filter.level.error")} \\(`
        ),
      })
      .click()
    await expect(alpha).toBeVisible()
    await expect(beta).toBeVisible()
    await expect(
      entries.locator("span", { hasText: /^(trace|debug|log|info|warn)$/ })
    ).toHaveCount(0)
  })

  await test.step("clear filters that hide every entry", async () => {
    await search.fill("no entry says this")
    await expect(
      page.getByText(translate("en", "settings.debugConsole.filter.noMatches"))
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: translate("en", "settings.debugConsole.filter.clear"),
      })
      .click()
    await expect(search).toHaveValue("")
    await expect(alpha).toBeVisible()
    await expect(beta).toBeVisible()
  })
})

test("sending the log to support says so when the support team cannot be loaded", async ({
  seededPage: page,
}) => {
  // The e2e setup has no support relays, so only the failure path runs here;
  // the message itself is covered by the unit tests (support/0005).
  await page.route("**/api/support-team", (route) =>
    route.fulfill({ status: 503, body: "" })
  )

  await test.step("open the debug console", () =>
    gotoPage(
      page,
      "/settings/debug-console",
      "en",
      "settings.debugConsole.title"
    ))

  await test.step("confirm sending the shown log", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "settings.debugConsole.sendToSupport"),
      })
      .click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toContainText(
      translate("en", "settings.debugConsole.sendToSupport.confirm.description")
    )
    await dialog
      .getByRole("button", {
        name: translate(
          "en",
          "settings.debugConsole.sendToSupport.confirm.action"
        ),
      })
      .click()
  })

  await test.step("report that it could not be sent", async () => {
    await expect(
      page.getByText(translate("en", "settings.debugConsole.sendFailed"))
    ).toBeVisible()
    await expect(page.getByText(translate("en", "app.saveFailed"))).toHaveCount(
      0
    )
  })
})
