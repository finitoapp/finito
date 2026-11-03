import {
  addCatalogItem,
  startNewBill,
  typeHardwareScan,
} from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate, translateValue } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"

test("a hardware scan adds the item to the bill outside scan mode", async ({
  seededPage: page,
}) => {
  await test.step("seed an item with a scan code", async () => {
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      scanCode: "12345678",
    })
  })

  await test.step("open a fresh cart in grid mode", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const summaryTrigger = page.getByTestId("bill-summary-trigger")

  await test.step("a scan adds the item and says so", async () => {
    await typeHardwareScan(page, "12345678")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await expect(
      page.getByText(nameParam("bill.scan.added", "Coffee"))
    ).toBeVisible()
  })

  await test.step("a scan into the focused search field leaves the search as it was", async () => {
    const search = page.getByRole("textbox", {
      name: translate("en", "bill.search"),
    })
    await search.fill("Cof")
    await typeHardwareScan(page, "12345678")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
    await expect(search).toHaveValue("Cof")
  })
})

test("a hardware scan on the home keypad opens a new bill instead of charging", async ({
  seededPage: page,
}) => {
  await test.step("seed an item with a scan code", async () => {
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      scanCode: "12345678",
    })
  })

  await test.step("scan on the keypad", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await page
      .getByRole("button", { name: translate("en", "nav.numpad") })
      .waitFor()
    await typeHardwareScan(page, "12345678")
  })

  await test.step("a new bill holds the scanned item and no payment was made", async () => {
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await expect(page).toHaveURL(/\/bill\?/)
    await expect(page).not.toHaveURL(/scan=/)
  })
})

test("a hardware scan on the home screen with an unknown code offers to create the item", async ({
  seededPage: page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page
    .getByRole("button", { name: translate("en", "nav.numpad") })
    .waitFor()
  await typeHardwareScan(page, "99998888")
  await expect(
    page.getByRole("button", {
      name: translate("en", "bill.scan.unknown.create"),
    })
  ).toBeVisible()
})

test("a hardware scan fills the item form and finds items from the list", async ({
  seededPage: page,
}) => {
  await test.step("a scan fills the new item's scan code without submitting", async () => {
    await gotoPage(
      page,
      "/catalog/items/new",
      "en",
      "catalog.items.form.title.create"
    )
    const scanCode = page.getByRole("textbox", {
      name: translate("en", "catalog.items.form.scanCode.label"),
    })
    await scanCode.click()
    await typeHardwareScan(page, "55556666")
    await expect(scanCode).toHaveValue("55556666")
    await expect(
      page.getByRole("heading", {
        name: translate("en", "catalog.items.form.title.create"),
      })
    ).toBeVisible()
  })

  await test.step("a known code on the list opens that item", async () => {
    await addCatalogItem(page, "en", {
      name: "Tea",
      price: "3",
      scanCode: "77778888",
    })
    await page.getByRole("link", { name: /^Tea/ }).waitFor()
    await typeHardwareScan(page, "77778888")
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.items.form.title.edit"),
      })
      .waitFor()
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
        exact: true,
      })
    ).toHaveValue("Tea")
  })

  await test.step("an unknown code on the list opens a new item carrying it", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    // The heading renders before the list, whose body holds the scanner
    // listener; a scan typed in between reaches no one.
    await page.getByRole("link", { name: /^Tea/ }).waitFor()
    await typeHardwareScan(page, "11112222")
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.items.form.title.create"),
      })
      .waitFor()
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.scanCode.label"),
      })
    ).toHaveValue("11112222")
  })
})
