import { addCatalogCategory, pickCategory } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate } from "./support/i18n.ts"
import { fillInlineField } from "./support/inline-edit.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"

test("create, edit and delete a catalog category", async ({
  seededPage: page,
}) => {
  await test.step("open category settings and see the empty state", () =>
    gotoPage(page, "/catalog/categories", "en", "catalog.categories.title"))

  await expect(
    page.getByText(translate("en", "catalog.categories.empty.title"))
  ).toBeVisible()

  await test.step("go to the add category form", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.categories.add"),
      })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.categories.form.title.create"),
      })
      .waitFor()
  })

  await test.step("fill in and save a new category", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.categories.form.name.label"),
      })
      .fill("Drinks")
    await page
      .getByRole("button", {
        name: translate("en", "catalog.categories.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.categories.title"),
      })
      .waitFor()
  })

  const categoryRow = page.getByRole("link", { name: "Drinks" })

  await test.step("verify the category appears in the list", async () => {
    await expect(categoryRow).toBeVisible()
  })

  await test.step("edit the category's name", async () => {
    await categoryRow.click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.categories.form.title.edit"),
      })
      .waitFor()

    const nameInput = page.getByRole("textbox", {
      name: translate("en", "catalog.categories.form.name.label"),
    })
    await expect(nameInput).toHaveValue("Drinks")

    await fillInlineField(page, nameInput, "Beverages")
  })

  await test.step("verify the edit persists after reload", async () => {
    await reloadPage(page, "en", "catalog.categories.form.title.edit")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.categories.form.name.label"),
      })
    ).toHaveValue("Beverages")
  })

  await test.step("delete the category and confirm", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.categories.delete"),
      })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.categories.delete.confirm.confirm"),
      })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.categories.title"),
      })
      .waitFor()
  })

  await test.step("verify the list is empty again", async () => {
    await expect(
      page.getByText(translate("en", "catalog.categories.empty.title"))
    ).toBeVisible()
  })
})

test("search filters the categories list", async ({ seededPage: page }) => {
  await test.step("add two categories", async () => {
    await addCatalogCategory(page, "en", "Drinks")
    await addCatalogCategory(page, "en", "Snacks")
  })

  const searchInput = page.getByRole("textbox", {
    name: translate("en", "catalog.categories.search"),
  })
  const drinksRow = page.getByRole("link", { name: "Drinks" })
  const snacksRow = page.getByRole("link", { name: "Snacks" })

  await test.step("typing filters the list to matching categories", async () => {
    await searchInput.fill("Dri")
    await expect(drinksRow).toBeVisible()
    await expect(snacksRow).not.toBeVisible()
  })

  await test.step("no match shows the empty-search message", async () => {
    await searchInput.fill("nonexistent")
    await expect(
      page.getByText(translate("en", "catalog.categories.emptySearch"))
    ).toBeVisible()
  })

  await test.step("clearing the search restores the full list", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.categories.search.clear.aria"),
      })
      .click()
    await expect(searchInput).toHaveValue("")
    await expect(drinksRow).toBeVisible()
    await expect(snacksRow).toBeVisible()
  })
})

test("assign a category to an item from the item form", async ({
  seededPage: page,
}) => {
  await test.step("create a category", () =>
    addCatalogCategory(page, "en", "Drinks"))

  await test.step("create an item and assign the category", async () => {
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
    await pickCategory(page, "en", "Drinks")
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("verify the category name shows under the item", async () => {
    const itemRow = page.getByRole("link", { name: /Coffee/ })
    await expect(itemRow).toContainText("Drinks")
  })
})

test("a category typed in the item form's combobox is added with the item", async ({
  seededPage: page,
}) => {
  await test.step("create a category", () =>
    addCatalogCategory(page, "en", "Drinks"))

  const categoryCombobox = page.getByRole("combobox", {
    name: translate("en", "catalog.items.form.category.label"),
    exact: true,
  })
  const search = page.getByRole("combobox", {
    name: translate("en", "catalog.items.form.category.search"),
  })

  await test.step("the search filters the categories and offers the typed name", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await categoryCombobox.click()
    await search.fill("dri")
    await expect(page.getByRole("option", { name: "Drinks" })).toBeVisible()
    await expect(
      page.getByRole("option", {
        name: nameParam("catalog.items.form.category.add", "dri"),
      })
    ).toBeVisible()
    // A name a category already spells is not offered a second time.
    await search.fill(" drinks ")
    await expect(page.getByRole("option")).toHaveCount(1)
    await page.keyboard.press("Escape")
  })

  await test.step("an item saved with a new name makes that category", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
      .fill("Cake")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("89")
    await pickCategory(page, "en", "Desserts")
    await expect(categoryCombobox).toHaveText("Desserts")
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
    await expect(page.getByRole("link", { name: /Cake/ })).toContainText(
      "Desserts"
    )
  })

  await test.step("the edit form saves a picked category at once", async () => {
    await page.getByRole("link", { name: /Cake/ }).click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.items.form.title.edit"),
      })
      .waitFor()
    await pickCategory(page, "en", "Drinks")
    await expect(
      page.getByRole("status", { name: translate("en", "inlineEdit.saved") })
    ).toBeVisible()
    await reloadPage(page, "en", "catalog.items.form.title.edit")
    await expect(categoryCombobox).toHaveText("Drinks")
  })

  await test.step("both categories are listed", async () => {
    await gotoPage(
      page,
      "/catalog/categories",
      "en",
      "catalog.categories.title"
    )
    await expect(page.getByRole("link", { name: "Drinks" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Desserts" })).toBeVisible()
  })
})
