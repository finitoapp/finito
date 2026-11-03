import {
  addCatalogItem,
  enterBillScanMode,
  injectScanCode,
  startNewBill,
} from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate, translateValue } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"

test("scan mode adds a known item, flags a code collision, and reports an unknown code", async ({
  seededPage: page,
}) => {
  await test.step("seed items, two of them sharing one scan code", async () => {
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      scanCode: "1111",
    })
    await addCatalogItem(page, "en", {
      name: "Tea",
      price: "3",
      scanCode: "2222",
    })
    await addCatalogItem(page, "en", {
      name: "Cocoa",
      price: "4",
      scanCode: "2222",
    })
  })

  await test.step("open a fresh cart in scan mode", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await enterBillScanMode(page, "en")
  })

  const summaryTrigger = page.getByTestId("bill-summary-trigger")
  const summaryPanel = page.getByTestId("bill-summary-panel")

  await test.step("a code matching exactly one item adds it directly", async () => {
    await injectScanCode(page, "1111")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await summaryTrigger.click()
    await expect(summaryPanel.getByText("Coffee")).toBeVisible()
  })

  await test.step("a code matching more than one item opens a collision dialog", async () => {
    await injectScanCode(page, "2222")
    await expect(
      page.getByText(translate("en", "bill.scan.collision.title"))
    ).toBeVisible()
    await page.getByRole("button", { name: /^Tea/ }).click()
    await expect(
      page.getByText(translate("en", "bill.scan.collision.title"))
    ).not.toBeVisible()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
    await expect(summaryPanel.getByText("Tea")).toBeVisible()
    await expect(summaryPanel.getByText("Cocoa")).not.toBeVisible()
  })

  await test.step("an unrecognized code reports itself as unknown without adding anything", async () => {
    await injectScanCode(page, "9999")
    const cancelButton = page.getByRole("button", {
      name: translate("en", "bill.scan.unknown.cancel"),
    })
    await expect(cancelButton).toBeVisible()
    await cancelButton.click()
    await expect(cancelButton).not.toBeVisible()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
  })
})

test("scanning an unknown code can create a new catalog item and add it to the cart", async ({
  seededPage: page,
}) => {
  await test.step("open a fresh cart in scan mode", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await enterBillScanMode(page, "en")
  })

  await test.step("an unknown code offers to add a new item", async () => {
    await injectScanCode(page, "3333")
    await page
      .getByRole("button", {
        name: translate("en", "bill.scan.unknown.create"),
      })
      .click()
  })

  await test.step("fill and save the quick-create form", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
      })
      .fill("Muffin")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("2.5")
    await page
      .getByRole("button", { name: translate("en", "bill.scan.create.save") })
      .click()
  })

  await test.step("the new item is added to the cart", async () => {
    const summaryTrigger = page.getByTestId("bill-summary-trigger")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await summaryTrigger.click()
    await expect(
      page.getByTestId("bill-summary-panel").getByText("Muffin")
    ).toBeVisible()
  })

  await test.step("the new item was also saved to the catalog with its scan code", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page.getByRole("link", { name: "Muffin" }).click()
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.scanCode.label"),
      })
    ).toHaveValue("3333")
  })
})

test("an opted-in device prefills a scanned retail barcode from Open Food Facts", async ({
  seededPage: page,
}) => {
  const lookedUpUrls: string[] = []
  await page.route("https://world.openfoodfacts.org/**", (route) => {
    lookedUpUrls.push(route.request().url())
    return route.fulfill({
      json: {
        status: 1,
        product: {
          product_name: "Coca-Cola Original",
          brands: "Coca-Cola",
          quantity: "330 ml",
        },
      },
    })
  })

  await test.step("a device that has not opted in sends nothing", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await enterBillScanMode(page, "en")
    await injectScanCode(page, "5449000000996")
    await page
      .getByRole("button", {
        name: translate("en", "bill.scan.unknown.cancel"),
      })
      .click()
    expect(lookedUpUrls).toEqual([])
  })

  await test.step("opt in to product lookup", async () => {
    await gotoPage(
      page,
      "/settings/about/privacy",
      "en",
      "settings.about.privacy.title"
    )
    await page
      .locator('[data-slot="card"]')
      .filter({
        hasText: translate("en", "settings.privacy.productLookup.title"),
      })
      .getByRole("button", {
        name: translate("en", "settings.privacy.productLookup.enable"),
      })
      .click()
  })

  await test.step("an internal code is never looked up", async () => {
    // Scan mode is remembered from the first visit, so it is still on.
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await injectScanCode(page, "3333")
    await page
      .getByRole("button", {
        name: translate("en", "bill.scan.unknown.cancel"),
      })
      .click()
    expect(lookedUpUrls).toEqual([])
  })

  await test.step("the unknown-code dialog already names the product", async () => {
    await injectScanCode(page, "5449000000996")
    const dialog = page.getByRole("alertdialog")
    await expect(
      dialog.getByText(translate("en", "bill.scan.unknown.match"))
    ).toBeVisible()
    await expect(dialog.getByText("Coca-Cola Original")).toBeVisible()
    await expect(dialog.getByText("Coca-Cola, 330 ml")).toBeVisible()
  })

  await test.step("a retail barcode opens the form prefilled", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "bill.scan.unknown.create"),
      })
      .click()
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.name.label"),
      })
    ).toHaveValue("Coca-Cola Original")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.description.label"),
      })
    ).toHaveValue("Coca-Cola, 330 ml")
    await expect(
      page
        .getByRole("dialog")
        .getByText(
          translate("en", "bill.scan.lookup.source").replace(
            "{source}",
            "Open Food Facts"
          )
        )
    ).toBeVisible()
    expect(lookedUpUrls).toHaveLength(1)
  })

  await test.step("saving adds the prefilled item to the cart", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("1.5")
    await page
      .getByRole("button", { name: translate("en", "bill.scan.create.save") })
      .click()
    const summaryTrigger = page.getByTestId("bill-summary-trigger")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await summaryTrigger.click()
    await expect(
      page.getByTestId("bill-summary-panel").getByText("Coca-Cola Original")
    ).toBeVisible()
  })
})
