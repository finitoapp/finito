import type { Locator, Page } from "@playwright/test"

import {
  addCatalogItem,
  addTable,
  startBillWithCoffee,
  startNewBill,
} from "./support/bill.ts"
import {
  createAndPaySecondPayment,
  simulateBillModifiedDuringPayment,
  simulateCancelAfterClaim,
  simulateDuplicateSettlement,
  startCollisionBill,
} from "./support/collisions.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { nameParam, translate, translateParams } from "./support/i18n.ts"
import {
  contentNav,
  gotoPage,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import {
  confirmRefund,
  openOverpaymentResolution,
  openOverpaymentReturn,
  overpaidByPattern,
  overpaymentCard,
  overpaymentReturnButton,
  resolveOverpayment,
  withdrawOverpaymentAnswer,
} from "./support/overpayment.ts"
import {
  markCashPaid,
  markCashPaidAndSettle,
  openRefundScreen,
  pickRefundChoice,
  prepareIbanPayment,
  refundChoiceButton,
  refundConfirmButton,
  startBillAndBeginCashPayment,
} from "./support/payment.ts"

/** Locates a bill's row in the `/activity/bills` list by its id. */
const billRow = (page: Parameters<typeof markCashPaid>[0], billId: string) =>
  contentNav(page, "en").locator(`a[href$="/${billId}"]`)

const startOverpaidBill = async (page: Page): Promise<string> => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await simulateBillModifiedDuringPayment(page, billId, "removeAll")
  await markCashPaidAndSettle(page, "en")
  return billId
}

const switchToCzech = async (page: Page): Promise<void> => {
  await gotoPage(page, "/settings/language", "en", "settings.language.title")
  const czech = page.getByRole("button", { name: "Čeština" })
  await czech.click()
  await expect(czech).toHaveAttribute("aria-pressed", "true")
  await waitForLocalWriteToSettle(page)
}

const isClipped = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element.scrollWidth > element.clientWidth)

const expectReadableTarget = async (target: Locator): Promise<void> => {
  await expect(target).toBeVisible()
  expect(await isClipped(target)).toBe(false)
  expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
}

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

  await test.step("the detail page shows the overpayment card", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(overpaymentCard(page)).toContainText(overpaidByPattern("en"))
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

test("the bill detail's overpayment card returns, tips, keeps and withdraws money paid above the bill", async ({
  seededPage: page,
}) => {
  test.slow()
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await simulateBillModifiedDuringPayment(page, billId, "removeAll")
  await markCashPaidAndSettle(page, "en")
  await gotoPage(page, "/activity/bills", "en", "activity.title")
  await expect(billRow(page, billId)).toContainText(
    translate("en", "billHistory.overpaid")
  )
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  const card = overpaymentCard(page)
  await expect(card).toContainText(/5[.,]00/u)

  await test.step("a tip the guest left counts against the overpayment", async () => {
    await resolveOverpayment(page, "en", { kind: "tip", amount: "2" })
    await expect(card).toContainText(overpaidByPattern("en"))
    await expect(card).toContainText(/3[.,]00/u)
  })

  await test.step("withdrawing the tip leaves the money unresolved again", async () => {
    await withdrawOverpaymentAnswer(page, "en", "overpayment.breakdown.tip")
    await expect(card).toContainText(
      translate("en", "overpayment.breakdown.withdrawn")
    )
    await expect(card).toContainText(/5[.,]00/u)
  })

  await test.step("keeping part of it lowers what is unresolved", async () => {
    await resolveOverpayment(page, "en", { kind: "kept", amount: "1" })
    await expect(card).toContainText(/4[.,]00/u)
  })

  await test.step("returning the rest resolves it, prefilled as a return", async () => {
    const screen = await openOverpaymentReturn(page, "en")
    await expect(
      screen.getByLabel(translate("en", "refund.dialog.amount.label"))
    ).toHaveValue(/^4([.,]00)?$/u)
    await expect(refundChoiceButton(page, "en", "overpayment")).toBeChecked()
    await confirmRefund(screen)
    await expect(card).toContainText(
      translate("en", "overpayment.resolved.title")
    )
    await page.screenshot({
      path: `${screenshotDir}/activity-bill-detail-overpayment-resolved.png`,
      fullPage: true,
    })
  })

  await test.step("the resolved breakdown adds up, the withdrawn tip struck from it", async () => {
    await expect(card).toContainText(
      translateParams("en", "overpayment.resolved.total", { amount: "$5.00" })
    )
    await expect(
      card
        .getByTestId("overpayment-answer")
        .filter({ hasText: translate("en", "overpayment.breakdown.withdrawn") })
        .getByText("$2.00", { exact: true })
    ).toHaveCSS("text-decoration-line", "line-through")
  })

  await test.step("Resolved bill in the history", async () => {
    await expect(
      card
        .getByTestId("overpayment-answer")
        .filter({ hasText: translate("en", "overpayment.breakdown.return") })
    ).toContainText(/4[.,]00/u)
    await gotoPage(page, "/activity/bills", "en", "activity.title")
    await expect(billRow(page, billId)).not.toContainText(
      translate("en", "billHistory.overpaid")
    )
  })
})

test("returning an overpayment skips a payment that was refunded in full", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await createAndPaySecondPayment(page, billId)
  await markCashPaidAndSettle(page, "en")
  await page
    .getByTestId("payment-paid-panel")
    .getByRole("button", { name: translate("en", "paymentWait.detail") })
    .click()
  await page
    .getByRole("heading", { name: translate("en", "paymentDetail.title") })
    .waitFor()
  const firstPaymentPath = new URL(page.url()).pathname

  await test.step("one of the two payments is refunded in full as goods", async () => {
    await gotoPage(page, firstPaymentPath, "en", "paymentDetail.title")
    await openRefundScreen(page, "en")
    await pickRefundChoice(page, "en", "part")
    await page
      .getByLabel(translate("en", "refund.dialog.amount.label"))
      .fill("5")
    await confirmRefund(page.locator("main"))
  })

  await test.step("the return goes straight to the payment that holds the 5.00", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(overpaymentCard(page)).toContainText(/5[.,]00/u)
    const screen = await openOverpaymentReturn(page, "en")
    await expect(
      screen.getByLabel(translate("en", "refund.dialog.amount.label"))
    ).toHaveValue(/^5([.,]00)?$/u)
  })
})

test("two payments of the same share are told apart by number, method and what can be resolved from each", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await createAndPaySecondPayment(page, billId)
  await markCashPaidAndSettle(page, "en")
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  const optionOf = (number: number) =>
    translateParams("en", "overpayment.dialog.paymentOption", {
      number,
      method: translate("en", "paymentDetail.paymentMethod.cash"),
      amount: "$5.00",
    })

  await test.step("the bill's payment rows show each payment's number", async () => {
    for (const number of [1, 2]) {
      await expect(
        page.getByRole("link").filter({
          hasText: translateParams("en", "billDetail.payments.numberedAmount", {
            number,
            amount: "$5.00",
          }),
        })
      ).toBeVisible()
    }
  })

  await test.step("Return it names both payments", async () => {
    await overpaymentReturnButton(page, "en").click()
    const dialog = page.getByRole("dialog")
    for (const number of [1, 2]) {
      await expect(
        dialog.getByRole("button", { name: optionOf(number), exact: true })
      ).toBeVisible()
    }
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })

  await test.step("Keep it names both payments", async () => {
    await overpaymentCard(page)
      .getByRole("button", { name: translate("en", "overpayment.action.keep") })
      .click()
    const dialog = page.getByRole("dialog")
    for (const number of [1, 2]) {
      await expect(
        dialog.getByRole("button", { name: optionOf(number), exact: true })
      ).toBeVisible()
    }
  })
})

test("It's a tip and Keep it each say what they mean, in full on a 320 px phone in Czech", async ({
  seededPage: page,
}) => {
  const billId = await startOverpaidBill(page)
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")

  await test.step("It's a tip says the guest left it on purpose", async () => {
    const dialog = await openOverpaymentResolution(page, "en", "tip")
    await expect(dialog).toContainText(
      translate("en", "overpayment.dialog.tip.consequence")
    )
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })

  await test.step("Keep it says the money stays with the business", async () => {
    const dialog = await openOverpaymentResolution(page, "en", "kept")
    await expect(dialog).toContainText(
      translate("en", "overpayment.dialog.keep.consequence")
    )
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })

  await test.step("in Czech at 320 px both lines read in full", async () => {
    await switchToCzech(page)
    await page.setViewportSize({ width: 320, height: 640 })
    await gotoPage(page, `/activity/bills/${billId}`, "cs", "billDetail.title")
    for (const kind of ["tip", "kept"] as const) {
      const dialog = await openOverpaymentResolution(page, "cs", kind)
      const consequence = dialog.getByText(
        translate(
          "cs",
          kind === "tip"
            ? "overpayment.dialog.tip.consequence"
            : "overpayment.dialog.keep.consequence"
        )
      )
      await expect(consequence).toBeVisible()
      expect(await isClipped(consequence)).toBe(false)
      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden()
    }
  })
})

test("returning an overpayment says how much is above the bill, warns about goods, and reads as a returned overpayment", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await prepareIbanPayment(page, "en")
  await page
    .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
    .click()
  await markCashPaid(page, "en")
  await simulateDuplicateSettlement(page)
  await waitForLocalWriteToSettle(page)
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  const returned = translateParams("en", "refund.state.overpayment", {
    amount: "$4.00",
  })
  const screen = page.locator("main")
  const amount = screen.getByLabel(
    translate("en", "refund.dialog.amount.label")
  )

  await test.step("Return it states the overpayment", async () => {
    await openOverpaymentReturn(page, "en")
    await expect(screen).toContainText(
      translateParams("en", "overpayment.title", { amount: "$5.00" })
    )
  })

  await test.step("an amount above what the payment received is refused", async () => {
    await amount.fill("11")
    await expect(
      screen.getByText(
        translateParams("en", "refund.dialog.amount.invalid", {
          amount: "$10.00",
        })
      )
    ).toBeVisible()
    await expect(refundConfirmButton(page)).toBeDisabled()
  })

  await test.step("an amount above the overpayment warns about the part refunded as goods", async () => {
    const goodsPart = screen.getByText(
      translateParams("en", "refund.dialog.goodsPart", { amount: "$2.00" })
    )
    await amount.fill("7")
    await expect(goodsPart).toBeVisible()
    await amount.fill("4")
    await expect(goodsPart).toBeHidden()
    await confirmRefund(screen)
  })

  await test.step("the payment row's badge reads as a returned overpayment", async () => {
    await expect(page.getByRole("link").getByTestId("refund-badge")).toHaveText(
      returned
    )
  })

  await test.step("the payment's refunds list it as a returned overpayment", async () => {
    await page.getByRole("link").filter({ hasText: returned }).click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    const refunds = page.getByTestId("payment-detail-refunds")
    await expect(refunds.getByTestId("refund-badge")).toHaveText(returned)
    const refund = refunds.getByTestId("payment-detail-refund")
    await expect(refund).toContainText(
      translate("en", "paymentDetail.refunds.overpayment")
    )
    await expect(refund).toContainText("$4.00")
  })

  await test.step("a refund that also gave goods back names only its overpayment part", async () => {
    await openRefundScreen(page, "en")
    await expect(screen).toContainText(
      translateParams("en", "overpayment.title", { amount: "$1.00" })
    )
    await amount.fill("3")
    await confirmRefund(screen)
    const refunds = page.getByTestId("payment-detail-refunds")
    await expect(
      refunds.getByTestId("payment-detail-refund").filter({ hasText: "$3.00" })
    ).toContainText(
      translateParams("en", "paymentDetail.refunds.overpaymentIncluded", {
        amount: "$1.00",
      })
    )
    await expect(refunds.getByTestId("refund-badge")).toHaveText([
      translateParams("en", "refund.state.overpayment", { amount: "$5.00" }),
      translateParams("en", "refund.state.partial", { amount: "$2.00" }),
    ])
  })
})

test("an unresolved overpayment is shown above the bill's lines", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await prepareIbanPayment(page, "en")
  await page
    .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
    .click()
  await markCashPaid(page, "en")
  await simulateDuplicateSettlement(page)
  await waitForLocalWriteToSettle(page)
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  const card = overpaymentCard(page)
  await expect(card).toContainText(overpaidByPattern("en"))

  const cardBox = await card.boundingBox()
  const firstLineBox = await page
    .getByText("Coffee", { exact: true })
    .boundingBox()
  expect(cardBox).not.toBeNull()
  expect(firstLineBox).not.toBeNull()
  expect((cardBox?.y ?? 0) + (cardBox?.height ?? 0)).toBeLessThanOrEqual(
    firstLineBox?.y ?? 0
  )
})

test("resolving an overpayment fits a 320 px phone in Czech", async ({
  seededPage: page,
}) => {
  const billId = await startOverpaidBill(page)
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  await resolveOverpayment(page, "en", { kind: "kept", amount: "1" })
  await switchToCzech(page)
  await page.setViewportSize({ width: 320, height: 640 })
  await gotoPage(page, `/activity/bills/${billId}`, "cs", "billDetail.title")
  const card = overpaymentCard(page)

  await test.step("Return, tip, keep and withdraw read in full and are at least 44 px tall", async () => {
    for (const key of [
      "overpayment.action.return",
      "overpayment.action.tip",
      "overpayment.action.keep",
      "overpayment.withdraw",
    ] as const) {
      await expectReadableTarget(
        card.getByRole("button", { name: translate("cs", key), exact: true })
      )
    }
  })
})

test("the amount to keep is checked when the field is left, and the error is read with the field", async ({
  seededPage: page,
}) => {
  const billId = await startOverpaidBill(page)
  await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  await resolveOverpayment(page, "en", { kind: "kept", amount: "2" })
  await expect(overpaymentCard(page)).toContainText(/3[.,]00/u)
  const dialog = await openOverpaymentResolution(page, "en", "kept")
  const amount = dialog.getByLabel(translate("en", "overpayment.dialog.amount"))
  const tooMuch = translateParams("en", "overpayment.dialog.amount.aboveKeep", {
    amount: "$3.00",
  })

  await test.step("9.00 is reported only once the field is left", async () => {
    await amount.fill("9.00")
    await expect(dialog.getByText(tooMuch)).toBeHidden()
    await expect(amount).toHaveAttribute("aria-invalid", "false")
    await amount.blur()
    await expect(dialog.getByText(tooMuch)).toBeVisible()
    await expect(amount).toHaveAttribute("aria-invalid", "true")
    await expect(amount).toHaveAccessibleDescription(tooMuch)
  })

  await test.step("an empty amount leaves the amount out of the button", async () => {
    await amount.fill("")
    await expect(
      dialog.getByRole("button", {
        name: translate("en", "overpayment.dialog.confirmEmpty.keep"),
        exact: true,
      })
    ).toBeDisabled()
  })
})

test("a goodwill refund on an overpaid bill leaves the overpayment for the tip", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await prepareIbanPayment(page, "en")
  await page
    .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
    .click()
  await markCashPaid(page, "en")
  await simulateDuplicateSettlement(page)
  let paymentPath = ""

  await test.step("Goodwill refund on an overpaid bill", async () => {
    await page
      .getByTestId("payment-paid-panel")
      .getByRole("button", { name: translate("en", "paymentWait.detail") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    paymentPath = new URL(page.url()).pathname
    await openRefundScreen(page, "en")
    await pickRefundChoice(page, "en", "part")
    await page
      .getByLabel(translate("en", "refund.dialog.amount.label"))
      .fill("1")
    await confirmRefund(page.locator("main"))
  })

  await test.step("the whole overpayment is still there for the tip", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(overpaymentCard(page)).toContainText(/5[.,]00/u)
    await resolveOverpayment(page, "en", { kind: "tip", amount: "5" })
    await expect(overpaymentCard(page)).toContainText(
      translate("en", "overpayment.resolved.title")
    )
  })

  await test.step("Tip confirmed", async () => {
    await gotoPage(page, paymentPath, "en", "paymentDetail.title")
    await expect(
      page.getByText(
        translateParams("en", "paymentDetail.overpaymentTip", {
          amount: "$5.00",
        })
      )
    ).toBeVisible()
  })
})
