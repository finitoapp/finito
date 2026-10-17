import { addCatalogItem, addTable } from "./support/bill.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { nameParam, translate, translateParams } from "./support/i18n.ts"
import {
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import {
  confirmRefund,
  openOverpaymentReturn,
  overpaymentCard,
} from "./support/overpayment.ts"
import {
  payAllOfTheBeer,
  routeFakeNostrRelays,
  seedPizzaAndBeerBill,
} from "./support/self-pay.ts"

test("shows a free table, starts a cart from it, then shows it occupied", async ({
  seededPage: page,
}) => {
  await test.step("seed a table and a catalog item", async () => {
    await addTable(page, "en", { name: "Table A", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  })

  const tableTile = page
    .getByTestId("table-tile")
    .filter({ hasText: "Table A" })
  const newBillLink = tableTile.getByRole("link", {
    name: translate("en", "tables.tile.newBill"),
  })
  const billRows = tableTile.getByRole("link", { name: /^Bill #/ })
  let billId: string | null = null

  await test.step("open the POS overview and see the table is free", async () => {
    await gotoPosOverview(page, "en")
    await expect(tableTile).toBeVisible()
    await expect(tableTile).toContainText(translate("en", "tables.tile.free"))
    await expect(billRows).toHaveCount(0)
  })

  await test.step("tap 'new bill' on the free table and add an item", async () => {
    await newBillLink.click()
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBeNull()
    billId = new URL(page.url()).searchParams.get("billId")
    await expect(
      page.getByRole("button", { name: translate("en", "bill.table.aria") })
    ).toContainText("Table A")
    // `billId` is in the URL before the add-item tap now (generated up
    // front, not once the bill is lazily created), so the poll above no
    // longer proves the create-plus-table-assign write has landed — the
    // hard nav below could otherwise race ahead of it.
    await waitForLocalWriteToSettle(page)
  })

  await test.step("back on the overview, the table now shows as occupied with its one bill", async () => {
    await gotoPosOverview(page, "en")
    await expect(tableTile).toBeVisible()
    await expect(tableTile).not.toContainText(
      translate("en", "tables.tile.free")
    )
    await expect(billRows).toHaveCount(1)
    await expect(newBillLink).toBeVisible()
  })

  await test.step("tapping the tile's bill resumes its cart", async () => {
    await billRows.click()
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .toBe(billId)
  })
})

test("shows only the free 'no table' tile when there are no tables or open bills yet", async ({
  seededPage: page,
}) => {
  await gotoPosOverview(page, "en")
  await expect(page.getByTestId("no-table-tile")).toContainText(
    translate("en", "home.pos.noTable.empty")
  )
  await expect(page.getByTestId("table-tile")).toHaveCount(0)
})

test("lists a bill without a table inside the 'no table' tile, alongside table tiles", async ({
  seededPage: page,
}) => {
  await test.step("seed a table and a catalog item", async () => {
    await addTable(page, "en", { name: "Table A", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  })

  let billId: string | null = null

  await test.step("start a bill without assigning a table", async () => {
    await gotoPosOverview(page, "en")
    await page
      .getByTestId("no-table-tile")
      .getByRole("link", { name: translate("en", "tables.tile.newBill") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBeNull()
    billId = new URL(page.url()).searchParams.get("billId")
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
    await page.getByTestId("no-table-tile").waitFor()
  })

  const tableTile = page
    .getByTestId("table-tile")
    .filter({ hasText: "Table A" })
  const noTableTile = page.getByTestId("no-table-tile")
  const unassignedBillRow = noTableTile.getByRole("link", { name: /^Bill #/ })

  await test.step("the overview shows Table A free and the bill listed inside the 'no table' tile", async () => {
    await expect(tableTile).toContainText(translate("en", "tables.tile.free"))
    await expect(unassignedBillRow).toHaveCount(1)
  })

  await test.step("tapping the unassigned bill's row resumes it", async () => {
    await unassignedBillRow.click()
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .toBe(billId)
  })
})

test("a table with multiple open bills lists each one, and each links straight to it", async ({
  seededPage: page,
}) => {
  const parkCart = async (tableName: string | null) => {
    // Client-side nav clicks throughout (starting the cart via the "no
    // table" tile's "+" link and closing it via the header back button),
    // not gotoPosOverview/page.goto: this runs several times in a row and a
    // hard reload re-inits Evolu's OPFS SQLite WASM each time, which gets
    // slow enough after a few carts to time out.
    await page
      .getByTestId("no-table-tile")
      .getByRole("link", { name: translate("en", "tables.tile.newBill") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()

    if (tableName !== null) {
      await page
        .getByRole("button", { name: translate("en", "bill.table.aria") })
        .click()
      const dialog = page.getByRole("dialog", {
        name: translate("en", "bill.table.dialog.title"),
      })
      await dialog.getByRole("button", { name: tableName }).click()
      await expect(dialog).not.toBeVisible()
    }

    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBeNull()
    const billId = new URL(page.url()).searchParams.get("billId")
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
    await page.getByTestId("no-table-tile").waitFor()
    return billId
  }

  await test.step("seed two tables and a catalog item", async () => {
    await addTable(page, "en", { name: "Table B", seatCount: "2" })
    await addTable(page, "en", { name: "Table C", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  })

  await test.step("go to the POS overview", async () => {
    await gotoPosOverview(page, "en")
  })

  const tableBBillIds: (string | null)[] = []

  await test.step("park two carts on Table B and one on Table C", async () => {
    tableBBillIds.push(await parkCart("Table B"))
    tableBBillIds.push(await parkCart("Table B"))
    await parkCart("Table C")
  })

  const tableBTile = page
    .getByTestId("table-tile")
    .filter({ hasText: "Table B" })
  const tableCTile = page
    .getByTestId("table-tile")
    .filter({ hasText: "Table C" })
  const tableBBillRows = tableBTile.getByRole("link", { name: /^Bill #/ })
  const tableCBillRows = tableCTile.getByRole("link", { name: /^Bill #/ })
  const newBillLinkName = translate("en", "tables.tile.newBill")

  await test.step("Table B's tile lists both of its bills plus a 'new bill' link, Table C's lists its one", async () => {
    await expect(tableBBillRows).toHaveCount(2)
    await expect(tableCBillRows).toHaveCount(1)
    await expect(
      tableBTile.getByRole("link", { name: newBillLinkName })
    ).toBeVisible()
    await expect(
      tableCTile.getByRole("link", { name: newBillLinkName })
    ).toBeVisible()
  })

  await test.step("tapping one of Table B's bills opens that exact bill", async () => {
    await tableBBillRows.first().click()
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    expect(tableBBillIds).toContain(
      new URL(page.url()).searchParams.get("billId")
    )
  })

  await test.step("Table B's 'new bill' link starts another bill on the same table", async () => {
    await gotoPosOverview(page, "en")
    await tableBTile.getByRole("link", { name: newBillLinkName }).click()
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await expect(
      page.getByRole("button", { name: translate("en", "bill.table.aria") })
    ).toContainText("Table B")
  })
})

test("a self-paid bill whose lines staff remove leaves the overview and its overpayment goes back", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress, billId } = await seedPizzaAndBeerBill(page, "Table 9")
  const tableTile = page
    .getByTestId("table-tile")
    .filter({ hasText: "Table 9" })

  await test.step("a guest pays the beer and the table reads partly paid", async () => {
    const guest = await context.newPage()
    await guest.goto(guestAddress)
    await payAllOfTheBeer(page, guest)
    await guest.close()
    await gotoPosOverview(page, "en")
    await expect(tableTile).toContainText(
      translate("en", "tables.tile.partiallyPaid"),
      { timeout: 30_000 }
    )
  })

  await test.step("staff remove every line after the question", async () => {
    await page.goto(`/bill?billId=${billId}`)
    await page.getByTestId("bill-summary-trigger").click()
    await page
      .getByTestId("bill-summary-panel")
      .getByRole("button", { name: translate("en", "bill.summary.clear") })
      .click()
    const question = page.getByRole("alertdialog")
    await expect(question).toContainText(
      translateParams("en", "bill.cover.overpaid.title", { amount: "$45.00" })
    )
    await question
      .getByRole("button", { name: translate("en", "bill.cover.confirm") })
      .click()
    await page.waitForURL(/\/activity\/bills\//u)
  })

  await test.step("the card offers the three ways", async () => {
    const card = overpaymentCard(page)
    await expect(card).toContainText("$45.00")
    for (const key of [
      "overpayment.action.return",
      "overpayment.action.tip",
      "overpayment.action.keep",
    ] as const) {
      await expect(
        card.getByRole("button", { name: translate("en", key) })
      ).toBeVisible()
    }
    await page.screenshot({
      path: `${screenshotDir}/iam-231-overpaid-after-removal.png`,
      fullPage: true,
    })
  })

  await test.step("the bill leaves the tables overview", async () => {
    await gotoPosOverview(page, "en")
    await expect(tableTile).toContainText(translate("en", "tables.tile.free"))
    await expect(tableTile).not.toContainText(
      translate("en", "tables.tile.partiallyPaid")
    )
  })

  await test.step("returning the money clears it", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    const dialog = await openOverpaymentReturn(page, "en")
    await expect(
      dialog.getByLabel(translate("en", "refund.dialog.amount.label"))
    ).toHaveValue(/^45([.,]00)?$/u)
    await confirmRefund(dialog)
    await expect(overpaymentCard(page)).toContainText(
      translate("en", "overpayment.resolved.title")
    )
    await page.screenshot({
      path: `${screenshotDir}/iam-231-overpayment-returned.png`,
      fullPage: true,
    })
  })
})
