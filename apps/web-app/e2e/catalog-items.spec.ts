import { turnOnAccessControl } from "./support/access.ts"
import {
  addCatalogCategory,
  addCatalogItem,
  startNewBill,
} from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate, translateValue } from "./support/i18n.ts"
import { fillInlineField, pickInlineOption } from "./support/inline-edit.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"

test("create, edit and delete a catalog item", async ({ seededPage: page }) => {
  await test.step("open item settings and see the empty state", () =>
    gotoPage(page, "/catalog/items", "en", "catalog.items.title"))

  await expect(
    page.getByText(translate("en", "catalog.items.empty.title"))
  ).toBeVisible()

  await test.step("go to the add item form", async () => {
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.items.form.title.create"),
      })
      .waitFor()
  })

  await test.step("fill in and save a new item", async () => {
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
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.scanCode.label"),
      })
      .fill("8594001234567")
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  const itemRow = page.getByRole("link", { name: "Coffee" })

  await test.step("verify the item appears in the list", async () => {
    await expect(itemRow).toBeVisible()
    await expect(itemRow).toContainText("59")
  })

  await test.step("edit the item's name and price", async () => {
    await itemRow.click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.items.form.title.edit"),
      })
      .waitFor()

    const nameInput = page.getByRole("textbox", {
      name: translate("en", "catalog.items.form.name.label"),
      exact: true,
    })
    await expect(nameInput).toHaveValue("Coffee")

    await fillInlineField(page, nameInput, "Espresso")
    await fillInlineField(
      page,
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      }),
      "69"
    )
  })

  await test.step("an optional field round-trips through set and not set", async () => {
    const skuInput = page.getByRole("textbox", {
      name: translate("en", "catalog.items.form.sku.label"),
    })
    await fillInlineField(page, skuInput, "COF-001")
    await fillInlineField(page, skuInput, "")
  })

  await test.step("the currency select saves as soon as it is picked", async () => {
    await pickInlineOption(page, "catalog.items.form.currency.label", "EUR")
  })

  await test.step("the scan button is still reachable next to the field", async () => {
    await expect(
      page.getByRole("button", {
        name: translate("en", "catalog.items.form.scanCode.scan.aria"),
      })
    ).toBeVisible()
  })

  await test.step("verify the edits persist after reload", async () => {
    await reloadPage(page, "en", "catalog.items.form.title.edit")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
    ).toHaveValue("Espresso")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.sku.label"),
      })
    ).toHaveValue("")
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "catalog.items.form.currency.label"),
      })
    ).toContainText("EUR")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.scanCode.label"),
      })
    ).toHaveValue("8594001234567")
  })

  await test.step("delete the item and confirm", async () => {
    await page
      .getByRole("button", { name: translate("en", "catalog.items.delete") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.delete.confirm.confirm"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("verify the list is empty again", async () => {
    await expect(
      page.getByText(translate("en", "catalog.items.empty.title"))
    ).toBeVisible()
  })
})

test("search filters the items list", async ({ seededPage: page }) => {
  await test.step("add two items", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await addCatalogItem(page, "en", { name: "Tea", price: "3" })
  })

  const searchInput = page.getByRole("textbox", {
    name: translate("en", "catalog.items.search"),
  })
  const coffeeRow = page.getByRole("link", { name: "Coffee" })
  const teaRow = page.getByRole("link", { name: "Tea" })

  await test.step("typing filters the list to matching items", async () => {
    await searchInput.fill("Cof")
    await expect(coffeeRow).toBeVisible()
    await expect(teaRow).not.toBeVisible()
  })

  await test.step("no match shows the empty-search message", async () => {
    await searchInput.fill("nonexistent")
    await expect(
      page.getByText(translate("en", "catalog.items.emptySearch"))
    ).toBeVisible()
  })

  await test.step("clearing the search restores the full list", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.search.clear.aria"),
      })
      .click()
    await expect(searchInput).toHaveValue("")
    await expect(coffeeRow).toBeVisible()
    await expect(teaRow).toBeVisible()
  })
})

test("filters the items list by category", async ({ seededPage: page }) => {
  await test.step("create a category and items in and out of it", async () => {
    await addCatalogCategory(page, "en", "Drinks")
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      categoryName: "Drinks",
    })
    await addCatalogItem(page, "en", { name: "Sandwich", price: "6" })
  })

  const coffeeRow = page.getByRole("link", { name: "Coffee" })
  const sandwichRow = page.getByRole("link", { name: "Sandwich" })

  await test.step("both items are visible with the 'all' filter", async () => {
    await expect(coffeeRow).toBeVisible()
    await expect(sandwichRow).toBeVisible()
  })

  await test.step("the 'Drinks' filter only shows the categorized item", async () => {
    await page.getByRole("button", { name: "Drinks" }).click()
    await expect(coffeeRow).toBeVisible()
    await expect(sandwichRow).not.toBeVisible()
  })

  await test.step("the 'Uncategorized' filter only shows the other item", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.category.uncategorized"),
      })
      .click()
    await expect(sandwichRow).toBeVisible()
    await expect(coffeeRow).not.toBeVisible()
  })

  await test.step("the 'All' filter shows both items again", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.category.all"),
      })
      .click()
    await expect(coffeeRow).toBeVisible()
    await expect(sandwichRow).toBeVisible()
  })
})

test("search matches internal name, SKU and scan code", async ({
  seededPage: page,
}) => {
  await test.step("add items with distinct internal name, SKU and scan code", async () => {
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      internalName: "Espresso Blend",
      sku: "COF-001",
      scanCode: "8594001234567",
    })
    await addCatalogItem(page, "en", { name: "Tea", price: "3" })
  })

  const searchInput = page.getByRole("textbox", {
    name: translate("en", "catalog.items.search"),
  })
  const coffeeRow = page.getByRole("link", { name: "Espresso Blend" })
  const teaRow = page.getByRole("link", { name: "Tea" })

  await test.step("matches by internal name", async () => {
    await searchInput.fill("Espresso")
    await expect(coffeeRow).toBeVisible()
    await expect(teaRow).not.toBeVisible()
  })

  await test.step("matches by SKU", async () => {
    await searchInput.fill("COF-001")
    await expect(coffeeRow).toBeVisible()
    await expect(teaRow).not.toBeVisible()
  })

  await test.step("matches by scan code", async () => {
    await searchInput.fill("8594001234567")
    await expect(coffeeRow).toBeVisible()
    await expect(teaRow).not.toBeVisible()
  })

  await test.step("still matches by the public name even when an internal name is set", async () => {
    await searchInput.fill("Coffee")
    await expect(coffeeRow).toBeVisible()
    await expect(teaRow).not.toBeVisible()
  })
})

test("shows a non-blocking warning for a duplicate scan code but still saves", async ({
  seededPage: page,
}) => {
  // `scanCode` uniqueness can't be enforced (CRDT/multi-device), so a
  // collision is a heads-up next to the field, not a validation error that
  // blocks saving — see `findCatalogItemsByScanCode`.
  await test.step("seed an item with a scan code", async () => {
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      scanCode: "8594001234567",
    })
  })

  await test.step("start a second item with the same scan code", async () => {
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.items.form.title.create"),
      })
      .waitFor()
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
      .fill("Cocoa")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("4")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.scanCode.label"),
      })
      .fill("8594001234567")
  })

  await test.step("the warning names the other item, and saving still succeeds", async () => {
    await expect(
      page.getByText(
        nameParam("catalog.items.form.scanCode.duplicate", "Coffee")
      )
    ).toBeVisible()

    await page
      .getByRole("button", {
        name: translate("en", "catalog.items.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.items.title") })
      .waitFor()
  })

  await test.step("both items exist in the list", async () => {
    await expect(page.getByRole("link", { name: "Coffee" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Cocoa" })).toBeVisible()
  })
})

test("a discount created with the Discount switch has no VAT rate and takes its amount off a bill", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await test.step("the Discount switch hides the VAT rate picker", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page
      .getByRole("button", { name: translate("en", "catalog.items.add") })
      .click()
    const taxRate = page.getByRole("combobox", {
      name: translate("en", "catalog.items.form.taxRate.label"),
    })
    await expect(taxRate).toBeVisible()
    await page
      .getByRole("switch", {
        name: translate("en", "catalog.items.form.discount.label"),
      })
      .click()
    await expect(taxRate).toHaveCount(0)
  })

  await addCatalogItem(page, "en", {
    name: "Loyalty",
    price: "1",
    discount: true,
  })

  await test.step("on a bill with goods it shows below zero and lowers the total", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    const summaryTrigger = page.getByTestId("bill-summary-trigger")
    await page
      .getByRole("button", { name: nameParam("bill.brick.add.aria", "Coffee") })
      .click()
    await expect(summaryTrigger).toContainText("$5.00")
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Loyalty"),
      })
      .click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
    await expect(summaryTrigger).toContainText("$4.00")

    await summaryTrigger.click()
    await expect(page.getByTestId("bill-summary-panel")).toContainText("-$1.00")
  })
})

test("a Basic device opening the catalog gets the PIN prompt", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  await test.step("the catalog asks for the PIN", async () => {
    await page.goto("/catalog/items", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", {
        name: translate("en", "access.pin.why.route").replace(
          "{permission}",
          translate("en", "access.permission.catalog")
        ),
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "catalog.items.title"),
        exact: true,
      })
    ).toHaveCount(0)
  })
})
