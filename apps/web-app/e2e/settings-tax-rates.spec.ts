import { addTaxRate } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate } from "./support/i18n.ts"
import { pickInlineOption } from "./support/inline-edit.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"

test("create, set default, rename, archive and reactivate a tax rate", async ({
  seededPage: page,
}) => {
  await test.step("open tax rate settings and see the empty state", () =>
    gotoPage(page, "/settings/tax-rates", "en", "settings.taxRates.title"))

  await expect(
    page.getByText(translate("en", "settings.taxRates.empty"))
  ).toBeVisible()

  await test.step("add two tax rates", async () => {
    await addTaxRate(page, "en", { name: "Standard rate", rate: "21" })
    await addTaxRate(page, "en", { name: "Reduced rate", rate: "12.5" })
  })

  await test.step("both rates appear with their formatted percentage", async () => {
    await expect(page.getByText("Standard rate")).toBeVisible()
    await expect(page.getByText("21%")).toBeVisible()
    await expect(page.getByText("Reduced rate")).toBeVisible()
    await expect(page.getByText("12.5%")).toBeVisible()
  })

  await test.step("neither rate is default yet", async () => {
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Standard rate"),
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Reduced rate"),
      })
    ).toBeVisible()
  })

  await test.step("make the standard rate the default", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Standard rate"),
      })
      .click()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Standard rate"),
      })
    ).toBeVisible()
  })

  await test.step("the default choice survives a reload", async () => {
    await reloadPage(page, "en", "settings.taxRates.title")
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Standard rate"),
      })
    ).toBeVisible()
  })

  await test.step("unsetting the default leaves no rate as default", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Standard rate"),
      })
      .click()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Standard rate"),
      })
    ).toBeVisible()
  })

  await test.step("rename the reduced rate", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.rename", "Reduced rate"),
      })
      .click()
    const nameInput = page.getByRole("textbox", {
      name: nameParam("settings.taxRates.rename.input", "Reduced rate"),
    })

    // The row opened the editor, so the field holds the focus from the
    // start rather than from the first keystroke.
    await expect(nameInput).toBeFocused()
    await page
      .getByRole("heading", {
        name: translate("en", "settings.taxRates.title"),
      })
      .click()
    await expect(nameInput).toBeFocused()

    // The row closes itself once the field saves, so the renamed row text is
    // the signal rather than the field's own tick.
    await nameInput.fill("Reduced VAT rate")
    await nameInput.press("Enter")
    await expect(page.getByText("Reduced VAT rate")).toBeVisible()
  })

  await test.step("the rename survives a reload, and the rate itself is unchanged", async () => {
    await reloadPage(page, "en", "settings.taxRates.title")
    await expect(page.getByText("Reduced VAT rate")).toBeVisible()
    await expect(page.getByText("12.5%")).toBeVisible()
  })

  await test.step("archive the renamed rate after confirming", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.archive", "Reduced VAT rate"),
      })
      .click()
    await page
      .getByRole("heading", {
        name: nameParam(
          "settings.taxRates.archive.confirm.title",
          "Reduced VAT rate"
        ),
      })
      .waitFor()
    await page
      .getByRole("button", {
        name: translate("en", "settings.taxRates.archive.confirm.confirm"),
        exact: true,
      })
      .click()
  })

  await test.step("the archived rate moves to the archived section", async () => {
    await page
      .getByText(translate("en", "settings.taxRates.archived.title"))
      .waitFor()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.activate", "Reduced VAT rate"),
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.rename", "Reduced VAT rate"),
      })
    ).not.toBeVisible()
  })

  await test.step("the archived rate is gone after a reload too", async () => {
    await reloadPage(page, "en", "settings.taxRates.title")
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.activate", "Reduced VAT rate"),
      })
    ).toBeVisible()
  })

  await test.step("reactivate the rate after confirming", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.activate", "Reduced VAT rate"),
      })
      .click()
    await page
      .getByRole("heading", {
        name: nameParam(
          "settings.taxRates.activate.confirm.title",
          "Reduced VAT rate"
        ),
      })
      .waitFor()
    await page
      .getByRole("button", {
        name: translate("en", "settings.taxRates.activate.confirm.confirm"),
        exact: true,
      })
      .click()
  })

  await test.step("the rate is active again, with its rename and rate intact", async () => {
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.rename", "Reduced VAT rate"),
      })
    ).toBeVisible()
    await expect(page.getByText("12.5%")).toBeVisible()
  })
})

test("the default tax rate is preselected when adding a new item", async ({
  seededPage: page,
}) => {
  await test.step("add a default tax rate", async () => {
    await addTaxRate(page, "en", { name: "Standard rate", rate: "21" })
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Standard rate"),
      })
      .click()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Standard rate"),
      })
    ).toBeVisible()
  })

  await test.step("the new item form preselects it", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
    ).toHaveText(/Standard rate/)
  })
})

test("assign a tax rate to an item from the item form", async ({
  seededPage: page,
}) => {
  await test.step("create two tax rates", async () => {
    await addTaxRate(page, "en", { name: "Standard rate", rate: "21" })
    await addTaxRate(page, "en", { name: "Reduced rate", rate: "12" })
  })

  await test.step("create an item and assign the reduced rate", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
      .fill("Coffee")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("59")
    await page
      .getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
      .click()
    await page.getByRole("option", { name: /Reduced rate/ }).click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("the assignment survives reopening the item", async () => {
    await page.getByRole("link", { name: /Coffee/ }).click()
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
    ).toHaveText(/Reduced rate/)
  })
})

test("switching the default tax rate between two existing rates", async ({
  seededPage: page,
}) => {
  await test.step("create two rates, A as default", async () => {
    await addTaxRate(page, "en", { name: "Rate A", rate: "21" })
    await addTaxRate(page, "en", { name: "Rate B", rate: "12" })
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Rate A"),
      })
      .click()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Rate A"),
      })
    ).toBeVisible()
  })

  await test.step("making B the default unsets A", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Rate B"),
      })
      .click()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Rate B"),
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Rate A"),
      })
    ).toBeVisible()
  })

  await test.step("the swap survives a reload", async () => {
    await reloadPage(page, "en", "settings.taxRates.title")
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.unset", "Rate B"),
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: nameParam("settings.taxRates.default.set", "Rate A"),
      })
    ).toBeVisible()
  })
})

test("clearing an item's tax rate assignment", async ({ seededPage: page }) => {
  await test.step("create a tax rate and an item using it", async () => {
    await addTaxRate(page, "en", { name: "Standard rate", rate: "21" })
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
      .fill("Coffee")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("59")
    await page
      .getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
      .click()
    await page.getByRole("option", { name: /Standard rate/ }).click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("clear the assignment back to no tax rate", async () => {
    await page.getByRole("link", { name: /Coffee/ }).click()
    await pickInlineOption(
      page,
      "catalog.items.form.taxRate.label",
      translate("en", "catalog.items.form.taxRate.none")
    )
  })

  await test.step("the cleared assignment survives reopening the item", async () => {
    await reloadPage(page, "en", "catalog.items.form.title.edit")
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
    ).toContainText(translate("en", "catalog.items.form.taxRate.none"))
  })
})

test("renaming a tax rate updates its already-assigned item", async ({
  seededPage: page,
}) => {
  await test.step("create a rate and an item using it", async () => {
    await addTaxRate(page, "en", { name: "Standard rate", rate: "21" })
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
      .fill("Coffee")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("59")
    await page
      .getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
      .click()
    await page.getByRole("option", { name: /Standard rate/ }).click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("rename the rate in settings", async () => {
    await gotoPage(page, "/settings/tax-rates", "en", "settings.taxRates.title")
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.rename", "Standard rate"),
      })
      .click()
    const nameInput = page.getByRole("textbox", {
      name: nameParam("settings.taxRates.rename.input", "Standard rate"),
    })
    await nameInput.fill("Basic rate")
    await nameInput.press("Enter")
    await expect(page.getByText("Basic rate")).toBeVisible()
  })

  await test.step("the item now shows the renamed rate", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page.getByRole("link", { name: /Coffee/ }).click()
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
    ).toHaveText(/Basic rate/)
  })
})

test("an archived tax rate stays assigned to its item but is not offered for a new item", async ({
  seededPage: page,
}) => {
  await test.step("create a rate and an item using it", async () => {
    await addTaxRate(page, "en", { name: "Standard rate", rate: "21" })
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
      .fill("Coffee")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("59")
    await page
      .getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
      .click()
    await page.getByRole("option", { name: /Standard rate/ }).click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("archive the rate", async () => {
    await gotoPage(page, "/settings/tax-rates", "en", "settings.taxRates.title")
    await page
      .getByRole("button", {
        name: nameParam("settings.taxRates.archive", "Standard rate"),
      })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.taxRates.archive.confirm.confirm"),
        exact: true,
      })
      .click()
    await page
      .getByText(translate("en", "settings.taxRates.archived.title"))
      .waitFor()
  })

  await test.step("the existing item still shows it, marked as archived", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page.getByRole("link", { name: /Coffee/ }).click()
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
    ).toHaveText(
      new RegExp(
        `Standard rate.*${translate("en", "settings.taxRates.archived.title")}`
      )
    )
  })

  await test.step("a new item does not offer the archived rate", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("combobox", {
        name: translate("en", "catalog.items.form.taxRate.label"),
      })
      .click()
    await expect(
      page.getByRole("option", { name: /Standard rate/ })
    ).not.toBeVisible()
  })
})

test("validates the name and rate fields when adding a tax rate", async ({
  seededPage: page,
}) => {
  await test.step("open tax rate settings", () =>
    gotoPage(page, "/settings/tax-rates", "en", "settings.taxRates.title"))

  await test.step("an out-of-range rate is rejected", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "settings.taxRates.name.label"),
        exact: true,
      })
      .fill("Broken rate")
    await page
      .getByRole("textbox", {
        name: translate("en", "settings.taxRates.rate.label"),
      })
      .fill("150")
    await page
      .getByRole("button", { name: translate("en", "settings.taxRates.add") })
      .click()
    await expect(
      page.getByText(translate("en", "settings.taxRates.rate.invalid"))
    ).toBeVisible()
    await expect(page.getByText("Broken rate")).not.toBeVisible()
  })

  await test.step("a blank name is rejected", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "settings.taxRates.name.label"),
        exact: true,
      })
      .fill("")
    await page
      .getByRole("textbox", {
        name: translate("en", "settings.taxRates.rate.label"),
      })
      .fill("21")
    await page
      .getByRole("button", { name: translate("en", "settings.taxRates.add") })
      .click()
    await expect(
      page.getByText(translate("en", "settings.taxRates.name.invalid"))
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "settings.taxRates.empty"))
    ).toBeVisible()
  })
})
