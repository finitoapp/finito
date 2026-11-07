import { addCatalogItem, addTable } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate, translateParams } from "./support/i18n.ts"
import { toggleInlineSwitch } from "./support/inline-edit.ts"
import { gotoPage, gotoPosOverview, reloadPage } from "./support/navigation.ts"
import {
  enableTableSelfPay,
  receiveMenuOrder,
  routeFakeNostrRelays,
  seedActiveFioPlugin,
  seedMenu,
} from "./support/self-pay.ts"

test("an item goes into the menu, sells out and comes back", async ({
  seededPage: page,
}) => {
  const itemRow = page.getByRole("link", { name: /Goulash/ })
  const editHeading = page.getByRole("heading", {
    name: translate("en", "catalog.items.form.title.edit"),
  })
  const inMenu = page.getByRole("switch", {
    name: translate("en", "catalog.items.form.inMenu.label"),
  })
  const soldOut = page.getByRole("switch", {
    name: translate("en", "catalog.items.form.soldOut.label"),
  })

  await test.step("add an item", () =>
    addCatalogItem(page, "en", { name: "Goulash", price: "189" }))

  await test.step("a new item is not in the menu", async () => {
    await expect(itemRow).not.toContainText(
      translate("en", "catalog.items.inMenu")
    )
    await itemRow.click()
    await editHeading.waitFor()
    await expect(inMenu).not.toBeChecked()
    await expect(soldOut).toHaveCount(0)
  })

  await test.step("put it in the menu and mark it sold out", async () => {
    await toggleInlineSwitch(page, "catalog.items.form.inMenu.label")
    await toggleInlineSwitch(page, "catalog.items.form.soldOut.label")
  })

  await test.step("the list marks it sold out", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await expect(itemRow).toContainText(
      translate("en", "catalog.items.soldOut")
    )
  })

  await test.step("mark it available again", async () => {
    await itemRow.click()
    await editHeading.waitFor()
    await expect(inMenu).toBeChecked()
    await expect(soldOut).toBeChecked()
    await toggleInlineSwitch(page, "catalog.items.form.soldOut.label")
  })

  await test.step("the list marks it in the menu", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await expect(itemRow).toContainText(translate("en", "catalog.items.inMenu"))
    await expect(itemRow).not.toContainText(
      translate("en", "catalog.items.soldOut")
    )
  })
})

test("ordering is switched on with nothing in the menu, on this device", async ({
  seededPage: page,
  context,
}) => {
  await routeFakeNostrRelays(context)
  const payBill = page.getByRole("switch", {
    name: translate("en", "catalog.tables.selfPayOptions.payBill"),
  })
  const order = page.getByRole("switch", {
    name: translate("en", "catalog.tables.selfPayOptions.order"),
  })
  const orderDevice = page.getByRole("combobox", {
    name: translate("en", "catalog.tables.selfPayOptions.orderDevice.label"),
  })
  const thisDevice = translateParams(
    "en",
    "catalog.tables.selfPayOptions.orderDevice.this",
    { name: "" }
  ).trim()

  await test.step("switch self-pay on for a table", async () => {
    await addTable(page, "en", { name: "Table 3", seatCount: "4" })
    await enableTableSelfPay(page, "en", "Table 3")
    await gotoPage(page, "/catalog/tables", "en", "catalog.tables.title")
  })

  await test.step("guests pay bills and order nothing until it is switched on", async () => {
    await expect(payBill).toBeChecked()
    await expect(order).not.toBeChecked()
    await expect(orderDevice).toHaveCount(0)
  })

  await test.step("switch ordering on", () =>
    toggleInlineSwitch(page, "catalog.tables.selfPayOptions.order"))

  await test.step("the card says guests cannot order from an empty menu", async () => {
    await expect(
      page.getByText(
        translate("en", "catalog.tables.selfPayOptions.menu.empty.title")
      )
    ).toBeVisible()
  })

  await test.step("this device takes the orders", async () => {
    await expect(orderDevice).toContainText(thisDevice)
    await orderDevice.click()
    await expect(page.getByRole("option")).toHaveCount(1)
    await page.getByRole("option", { name: thisDevice }).click()
    await expect(orderDevice).toContainText(thisDevice)
  })

  await test.step("an item in the menu clears the warning", async () => {
    await seedMenu(page, { items: [{ name: "Coffee", amount: 6500 }] })
    await expect(
      page.getByText(
        translateParams("en", "catalog.tables.selfPayOptions.menu.visible", {
          count: 1,
        })
      )
    ).toBeVisible()
    await expect(
      page.getByText(
        translate("en", "catalog.tables.selfPayOptions.menu.empty.title")
      )
    ).toHaveCount(0)
  })

  await test.step("switch bill paying off and keep it after a reload", async () => {
    await toggleInlineSwitch(page, "catalog.tables.selfPayOptions.payBill")
    await reloadPage(page, "en", "catalog.tables.title")
    await expect(payBill).not.toBeChecked()
    await expect(order).toBeChecked()
  })
})

test("a paid order is announced, listed to serve and served", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const nothingToServe = page.getByText(translate("en", "orders.empty"))

  await test.step("seed a table with self-pay and a menu", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 3", seatCount: "4" })
    await enableTableSelfPay(page, "en", "Table 3")
    await seedMenu(page, {
      items: [
        { name: "Svíčková na smetaně", internalName: "SVÍČK", amount: 21900 },
        { name: "Coffee", amount: 6500 },
      ],
    })
  })

  await test.step("open To serve from the floor", async () => {
    await gotoPosOverview(page, "en")
    await page
      .getByRole("link", { name: new RegExp(translate("en", "nav.orders")) })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "orders.title") })
      .waitFor()
    await expect(nothingToServe).toBeVisible()
  })

  await test.step("a guest pays an order with a note", () =>
    receiveMenuOrder(page, {
      table: "Table 3",
      items: [
        { name: "Svíčková na smetaně", quantity: 1 },
        { name: "Coffee", quantity: 2 },
      ],
      note: "bez cukru",
      amount: 35000,
    }))

  await test.step("the till announces it", async () => {
    await expect(
      page.getByText(
        translateParams("en", "orders.announced", {
          number: 1,
          table: "Table 3",
        })
      )
    ).toBeVisible()
  })

  await test.step("To serve shows it by internal names, with the note", async () => {
    await expect(orderCard).toHaveCount(1)
    await expect(orderCard).toContainText(
      translateParams("en", "orders.number", { number: 1 })
    )
    await expect(orderCard).toContainText("Table 3")
    await expect(orderCard).toContainText(
      translateParams("en", "orders.line", { name: "SVÍČK", quantity: 1 })
    )
    await expect(orderCard).toContainText(
      translateParams("en", "orders.line", { name: "Coffee", quantity: 2 })
    )
    await expect(orderCard).not.toContainText("Svíčková na smetaně")
    await expect(orderCard).toContainText(
      translateParams("en", "orders.note", { note: "bez cukru" })
    )
    await expect(orderCard).toContainText(translate("en", "orders.paid"))
    await expect(orderCard).not.toContainText(
      translate("en", "orders.notFullyPaid")
    )
  })

  await test.step("Accept marks it as being prepared and only then offers Served", async () => {
    const served = orderCard.getByRole("button", {
      name: translate("en", "orders.served"),
    })
    await expect(served).toHaveCount(0)
    await orderCard
      .getByRole("button", { name: translate("en", "orders.accept") })
      .click()
    await expect(orderCard).toContainText(translate("en", "orders.preparing"))
    await expect(served).toBeVisible()
  })

  await test.step("Served takes it off the list", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.served") })
      .click()
    await expect(orderCard).toHaveCount(0)
    await expect(nothingToServe).toBeVisible()
  })

  await test.step("an order paid in part says so", async () => {
    await receiveMenuOrder(page, {
      table: "Table 3",
      items: [{ name: "Coffee", quantity: 1 }],
      amount: 3000,
    })
    await expect(orderCard).toHaveCount(1)
    await expect(orderCard).toContainText(
      translateParams("en", "orders.number", { number: 2 })
    )
    await expect(orderCard).toContainText(
      translate("en", "orders.notFullyPaid")
    )
  })
})
