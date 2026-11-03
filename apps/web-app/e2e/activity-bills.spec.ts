import {
  addCatalogItem,
  addTable,
  startBillWithCoffee,
  startNewBill,
} from "./support/bill.ts"
import {
  simulateBillModifiedDuringPayment,
  simulateCancelAfterClaim,
  startCollisionBill,
} from "./support/collisions.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { nameParam, translate } from "./support/i18n.ts"
import { contentNav, gotoPage } from "./support/navigation.ts"
import {
  markCashPaid,
  markCashPaidAndSettle,
  startBillAndBeginCashPayment,
} from "./support/payment.ts"

/** Locates a bill's row in the `/activity/bills` list by its id. */
const billRow = (page: Parameters<typeof markCashPaid>[0], billId: string) =>
  contentNav(page, "en").locator(`a[href$="/${billId}"]`)

test("the bills list shows an ordinary open bill with nothing paid yet", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillWithCoffee(page, "en")

  await gotoPage(page, "/activity/bills", "en", "activity.title")
  const row = billRow(page, billId)
  await expect(row).toContainText(translate("en", "bill.status.open"))
  await expect(row).not.toContainText(translate("en", "billHistory.underpaid"))
  await expect(row).not.toContainText(translate("en", "billHistory.overpaid"))
  await expect(row).not.toContainText(translate("en", "bill.collision.title"))
  await page.screenshot({
    path: `${screenshotDir}/activity-bills-list-open.png`,
    fullPage: true,
  })
})

test("the bills list shows an ordinary canceled bill, discarded before any payment", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillWithCoffee(page, "en")
  await page
    .getByRole("button", { name: translate("en", "bill.discard") })
    .click()
  await page
    .getByRole("button", {
      name: translate("en", "bill.discard.confirm.confirm"),
    })
    .click()
  await page.getByTestId("no-table-tile").waitFor()

  await gotoPage(page, "/activity/bills", "en", "activity.title")
  const row = billRow(page, billId)
  await expect(row).toContainText(translate("en", "bill.status.canceled"))
  await expect(row).not.toContainText(translate("en", "bill.collision.title"))
  await page.screenshot({
    path: `${screenshotDir}/activity-bills-list-canceled.png`,
    fullPage: true,
  })
})

test("the bills list shows an ordinary closed bill, fully paid", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await markCashPaidAndSettle(page, "en")

  await gotoPage(page, "/activity/bills", "en", "activity.title")
  const row = billRow(page, billId)
  await expect(row).toContainText(translate("en", "bill.status.closed"))
  await expect(row).not.toContainText(translate("en", "billHistory.underpaid"))
  await expect(row).not.toContainText(translate("en", "billHistory.overpaid"))
  await page.screenshot({
    path: `${screenshotDir}/activity-bills-list-closed.png`,
    fullPage: true,
  })
})

test("clicking a bill row in the list opens its detail page", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await markCashPaidAndSettle(page, "en")

  await gotoPage(page, "/activity/bills", "en", "activity.title")
  await billRow(page, billId).click()

  await page
    .getByRole("heading", { name: translate("en", "billDetail.title") })
    .waitFor()
  expect(page.url()).toContain(`/activity/bills/${billId}`)
  await expect(
    page.getByText(translate("en", "bill.status.closed"), { exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: `${screenshotDir}/activity-bill-detail.png`,
    fullPage: true,
  })
})

test("the bill detail page's back-to-bill button returns to an open bill and is hidden once it's closed", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await test.step("an open bill's detail page links back to /bill", async () => {
    const billId = await startBillWithCoffee(page, "en")

    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await page
      .getByRole("button", { name: translate("en", "billDetail.backToBill") })
      .click()

    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    expect(new URL(page.url()).searchParams.get("billId")).toBe(billId)
  })

  await test.step("a closed bill's detail page has no back-to-bill button", async () => {
    const billId = await startBillAndBeginCashPayment(page, "en")
    await markCashPaidAndSettle(page, "en")

    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByRole("link", { name: translate("en", "billDetail.backToBill") })
    ).toBeHidden()
  })
})

test("the bill detail page shows an invalid id or a missing bill message", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await test.step("an invalid id shows the invalid-id message", async () => {
    await gotoPage(
      page,
      "/activity/bills/not-a-real-id",
      "en",
      "billDetail.title"
    )
    await expect(
      page.getByText(translate("en", "billDetail.invalidId"))
    ).toBeVisible()
  })

  await test.step("a well-formed but unknown id shows the not-found message", async () => {
    const billId = await startBillWithCoffee(page, "en")
    // A well-formed but never-issued id: real ids encode trailing padding
    // bits in their last character, so only the first character of a known
    // valid id is swapped, keeping the rest (and its encoding) untouched.
    const missingBillId = `${billId[0] === "a" ? "b" : "a"}${billId.slice(1)}`
    await gotoPage(
      page,
      `/activity/bills/${missingBillId}`,
      "en",
      "billDetail.title"
    )
    await expect(
      page.getByText(translate("en", "billDetail.notFound"))
    ).toBeVisible()
  })
})

test("the bill detail page shows the total, items, table, and linked payment", async ({
  seededPage: page,
}) => {
  await addTable(page, "en", { name: "Patio 1", seatCount: "4" })
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await startNewBill(page, "en")
  await page
    .getByRole("button", { name: translate("en", "bill.table.aria") })
    .click()
  const tableDialog = page.getByRole("dialog", {
    name: translate("en", "bill.table.dialog.title"),
  })
  await tableDialog.getByRole("button", { name: "Patio 1" }).click()
  await expect(tableDialog).not.toBeVisible()

  await page
    .getByRole("button", { name: nameParam("bill.brick.add.aria", "Coffee") })
    .click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
  const billId = new URL(page.url()).searchParams.get("billId") ?? ""

  await page.getByRole("button", { name: translate("en", "home.pay") }).click()
  await page
    .getByRole("button", { name: translate("en", "paymentTip.none") })
    .click()
  await markCashPaidAndSettle(page, "en")

  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")

  await expect(
    page.getByText(translate("en", "bill.status.closed"), { exact: true })
  ).toBeVisible()
  await expect(page.locator("strong", { hasText: "$5.00" })).toBeVisible()
  await expect(page.getByText("Coffee")).toBeVisible()
  await expect(page.getByText("Patio 1")).toBeVisible()
  await expect(
    page
      .getByRole("link")
      .filter({ hasText: translate("en", "payment.status.paid") })
  ).toBeVisible()
  await page.screenshot({
    path: `${screenshotDir}/activity-bill-detail-full.png`,
    fullPage: true,
  })
})

test("the bills list and detail page show an underpaid bill when another device grew the total while the payment was in flight", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await simulateBillModifiedDuringPayment(page, billId, "add")
  await markCashPaidAndSettle(page, "en")

  await test.step("the bills list flags it as underpaid", async () => {
    await gotoPage(page, "/activity/bills", "en", "activity.title")
    const row = billRow(page, billId)
    await expect(row).toContainText(translate("en", "bill.status.open"))
    await expect(row).toContainText(translate("en", "billHistory.underpaid"))
    await page.screenshot({
      path: `${screenshotDir}/activity-bills-list-underpaid.png`,
      fullPage: true,
    })
  })

  await test.step("the detail page shows the underpaid coverage message", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByText(
        translate("en", "paymentDetail.bill.coverage.underpaid.title")
      )
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/activity-bill-detail-underpaid.png`,
      fullPage: true,
    })
  })
})

test("the bills list and detail page show an overpaid bill when another device shrank the total while the payment was in flight", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await simulateBillModifiedDuringPayment(page, billId, "removeAll")
  await markCashPaidAndSettle(page, "en")

  await test.step("the bills list flags it as overpaid", async () => {
    await gotoPage(page, "/activity/bills", "en", "activity.title")
    const row = billRow(page, billId)
    await expect(row).toContainText(translate("en", "bill.status.closed"))
    await expect(row).toContainText(translate("en", "billHistory.overpaid"))
    await page.screenshot({
      path: `${screenshotDir}/activity-bills-list-overpaid.png`,
      fullPage: true,
    })
  })

  await test.step("the detail page shows the overpaid coverage message", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByText(
        translate("en", "paymentDetail.bill.coverage.overpaid.title")
      )
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/activity-bill-detail-overpaid.png`,
      fullPage: true,
    })
  })
})

/**
 * The list row and the general shape of the collision message are already
 * covered by `bill.spec.ts`'s "...is flagged as a collision on every
 * surface..." test (which shares this same `startCollisionBill` setup) —
 * this one is only about the detail page's *own* resolve button, one of
 * three independent surfaces that can resolve the collision (see
 * `bill.spec.ts`'s two collision tests for the other two).
 */
test("the bill detail page's own collision message resolves directly", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const { billId } = await startCollisionBill(page, "en")

  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  await expect(
    page.getByText(translate("en", "bill.collision.title"))
  ).toBeVisible()

  await page
    .getByRole("button", {
      name: translate("en", "bill.collision.markClosed"),
    })
    .click()
  await expect(
    page.getByText(translate("en", "bill.collision.title"))
  ).toBeHidden()
  await expect(
    page.getByText(translate("en", "bill.status.closed"), { exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: `${screenshotDir}/activity-bill-detail-collision-resolved.png`,
    fullPage: true,
  })
})

/**
 * A distinct scenario from `startCollisionBill` (which cancels the *bill*
 * via `cancelBillDirectly`): this cancels an individual, already-claimed
 * *payment* via `simulateCancelAfterClaim`. `activity.spec.ts` already
 * covers that scenario thoroughly for the payment list/detail, but its
 * setup uses the numpad `createPayment` flow, whose payment has no
 * `billId` — there's no bill detail page for that test to check. This test
 * exists only to check the one thing that needs a bill-backed payment: the
 * warning icon on the bill detail's own payments list.
 */
test("a payment individually canceled after being claimed shows a warning icon in the bill detail's payments list", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await markCashPaid(page, "en")
  await simulateCancelAfterClaim(page, "en")

  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")

  await expect(
    page
      .getByRole("link")
      .filter({ hasText: translate("en", "payment.status.canceled") })
  ).toBeVisible()
  await page.screenshot({
    path: `${screenshotDir}/activity-bill-detail-payment-collision.png`,
    fullPage: true,
  })
})
