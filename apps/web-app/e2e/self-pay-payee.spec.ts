import { addCatalogItem, addTable } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate, translateParams } from "./support/i18n.ts"
import { gotoPage, waitForLocalWriteToSettle } from "./support/navigation.ts"
import {
  enableTableSelfPay,
  openTableBill,
  routeFakeNostrRelays,
  seedActiveFioPlugin,
} from "./support/self-pay.ts"

test("a guest sees no payee until the owner names one for guests", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const payTotal = translateParams("en", "selfPay.pay.total", {
    amount: "$12.00",
  })
  const payee = (name: string) =>
    translateParams("en", "selfPay.payee", { payee: name })
  let guestAddress = ""

  await test.step("the owner opens a bill on a self-pay table", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 7", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Salad", price: "12" })
    guestAddress = await enableTableSelfPay(page, "en", "Table 7")
    await openTableBill(page, "en", { table: "Table 7", items: ["Salad"] })
  })

  const guest = await context.newPage()

  await test.step("without a name for guests the page names no payee", async () => {
    await guest.goto(guestAddress)
    await expect(guest.getByRole("button", { name: payTotal })).toBeVisible({
      timeout: 45_000,
    })
    await expect(
      guest.getByText(
        new RegExp(translate("en", "selfPay.payee").replace("{payee}", ".*"))
      )
    ).toHaveCount(0)
  })

  await test.step("the owner names the café for guests", async () => {
    await gotoPage(page, "/catalog/tables", "en", "catalog.tables.title")
    const name = page.getByLabel(
      translate("en", "catalog.tables.selfPayGuestName.label")
    )
    await name.fill("Kavárna U Lípy")
    await name.press("Enter")
    await waitForLocalWriteToSettle(page)
  })

  await test.step("the guest page names it as the payee", async () => {
    await expect(async () => {
      await guest.reload()
      await expect(guest.getByText(payee("Kavárna U Lípy"))).toBeVisible({
        timeout: 5_000,
      })
    }).toPass({ timeout: 45_000 })
  })
})
