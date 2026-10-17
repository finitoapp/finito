import { addCatalogItem, startBillWithCoffee } from "./support/bill.ts"
import {
  createAndPaySecondPayment,
  simulateBillModifiedDuringPayment,
  simulateCancelAfterClaim,
  simulateDuplicateSettlement,
} from "./support/collisions.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { translate, translateParams, translateValue } from "./support/i18n.ts"
import {
  contentNav,
  gotoPage,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import {
  overpaidByPattern,
  overpaymentCard,
  resolveOverpayment,
} from "./support/overpayment.ts"
import {
  createPayment,
  markCashPaid,
  prepareIbanPayment,
  startBillAndBeginCashPayment,
} from "./support/payment.ts"

test("a paid payment shows up in activity list and detail", async ({
  seededPage: page,
}) => {
  await test.step("create a cash payment", () => createPayment(page, "en"))
  await test.step("mark the payment as paid", () => markCashPaid(page, "en"))

  await test.step("open activity from the paid confirmation", async () => {
    await page
      .getByTestId("payment-paid-panel")
      .getByRole("button", { name: translate("en", "paymentWait.detail") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
  })

  await test.step("verify the payment detail shows paid status", async () => {
    await expect(
      page.getByText(translate("en", "payment.status.paid"), {
        exact: true,
      })
    ).toBeVisible()
  })

  await test.step("navigate to the activity list", () =>
    gotoPage(page, "/activity", "en", "activity.title"))

  await test.step("open the payment from the activity list", async () => {
    await contentNav(page, "en")
      .getByRole("link", {
        name: translate("en", "payment.status.paid"),
      })
      .first()
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(
      page.getByText(translate("en", "payment.status.paid"), {
        exact: true,
      })
    ).toBeVisible()
  })
})

test("the payment detail's bill items list includes the tip so its total matches the payment amount", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  await startBillWithCoffee(page, "en")

  await page.getByRole("button", { name: translate("en", "home.pay") }).click()
  await page
    .getByRole("heading", { name: translate("en", "paymentTip.title") })
    .waitFor()
  await page
    .getByRole("button", {
      name: translateValue("en", "settings.tips.percentages.value", 10),
    })
    .click()
  await markCashPaid(page, "en")

  await page
    .getByTestId("payment-paid-panel")
    .getByRole("button", { name: translate("en", "paymentWait.detail") })
    .click()
  await page
    .getByRole("heading", { name: translate("en", "paymentDetail.title") })
    .waitFor()

  // Coffee $5.00 + a 10% tip ($0.50) = $5.50.
  const billCard = page.locator('[data-slot="card"]', { hasText: "Coffee" })
  await expect(billCard.getByText("Coffee")).toBeVisible()
  await expect(
    billCard.getByText(translate("en", "paymentDetail.tipAmount"))
  ).toBeVisible()
  await expect(billCard.getByText("$0.50")).toBeVisible()
  await expect(billCard.getByText("$5.50")).toBeVisible()
  await page.screenshot({
    path: `${screenshotDir}/activity-payment-detail-bill-with-tip.png`,
    fullPage: true,
  })
})

test("a canceled+claimed payment collision is flagged in the activity list and detail, and can be resolved", async ({
  seededPage: page,
}) => {
  await test.step("create and claim a cash payment", async () => {
    await createPayment(page, "en")
    await markCashPaid(page, "en")
  })

  await test.step("simulate a CRDT merge race that cancels the already-claimed payment", () =>
    simulateCancelAfterClaim(page, "en"))

  await test.step("the activity list flags the collision", async () => {
    await gotoPage(page, "/activity", "en", "activity.title")
    await expect(
      page.getByText(translate("en", "paymentDetail.collision.title"))
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/activity-list-collision.png`,
      fullPage: true,
    })
  })

  await test.step("opening the payment shows the collision warning on the detail page", async () => {
    await contentNav(page, "en")
      .getByRole("link", {
        name: translate("en", "paymentDetail.collision.title"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(
      page.getByText(translate("en", "paymentDetail.collision.title"))
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-collision.png`,
      fullPage: true,
    })
  })

  await test.step("resolving the collision flips the payment's display back to paid", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "paymentDetail.collision.markPaid"),
      })
      .click()
    await expect(
      page.getByText(translate("en", "paymentDetail.collision.title"))
    ).toBeHidden()
    await expect(
      page.getByText(translate("en", "payment.status.paid"), {
        exact: true,
      })
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-resolved.png`,
      fullPage: true,
    })
  })

  await test.step("the activity list no longer flags the resolved payment", async () => {
    await gotoPage(page, "/activity", "en", "activity.title")
    await expect(
      page.getByText(translate("en", "paymentDetail.collision.title"))
    ).toBeHidden()
    await expect(
      contentNav(page, "en")
        .getByRole("link", {
          name: translate("en", "payment.status.paid"),
        })
        .first()
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/activity-list-resolved.png`,
      fullPage: true,
    })
  })
})

test("a duplicate-settlement payment collision is flagged in the payment detail and can be resolved", async ({
  seededPage: page,
}) => {
  await test.step("create and claim a cash payment, also preparing IBAN as an offered method", async () => {
    await createPayment(page, "en")
    // Visiting the IBAN tab is what actually prepares it (`preparePaymentMethod`
    // is lazy, per-tab) — needed so `simulateDuplicateSettlement` below has
    // IBAN details to settle against. Switch back to the cash tab afterward,
    // since `markCashPaid`'s button only renders while it's active.
    await prepareIbanPayment(page, "en")
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
      .click()
    await markCashPaid(page, "en")
  })

  await test.step("simulate a second offline device settling the same payment via IBAN", () =>
    simulateDuplicateSettlement(page))

  await test.step("opening the payment detail shows the duplicate-settlement warning", async () => {
    await page
      .getByTestId("payment-paid-panel")
      .getByRole("button", { name: translate("en", "paymentWait.detail") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(overpaymentCard(page)).toContainText(overpaidByPattern("en"))
    await expect(overpaymentCard(page)).toContainText("$5.90")
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-excess-collision.png`,
      fullPage: true,
    })
  })

  await test.step("keeping the second settlement resolves it", async () => {
    await resolveOverpayment(page, "en", { kind: "kept", amount: "5.9" })
    await expect(overpaymentCard(page)).toContainText(
      translate("en", "overpayment.resolved.title")
    )
  })
})

test("the payment detail shows the bill's coverage as underpaid or overpaid when another device edits it mid-payment", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await test.step("underpaid: another device adds an item while the payment is in flight", async () => {
    const billId = await startBillAndBeginCashPayment(page, "en")

    // Simulates a CRDT merge race, not a real second payment: while this
    // device's $5 payment is in flight, another (still offline) device adds
    // an item to the same bill, growing its total past that payment's
    // already-fixed amount. See docs/bill-payment-states.md's "Bill payment
    // coverage" section.
    await simulateBillModifiedDuringPayment(page, billId, "add")
    await markCashPaid(page, "en")

    await page
      .getByTestId("payment-paid-panel")
      .getByRole("button", { name: translate("en", "paymentWait.detail") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(
      page.getByText(
        translate("en", "paymentDetail.bill.coverage.underpaid.title")
      )
    ).toBeVisible()
    await expect(
      page.getByText(
        translate("en", "paymentDetail.bill.coverage.changesTitle")
      )
    ).toBeVisible()
    await expect(page.getByText("+ 1 × e2e: concurrent addition")).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-bill-underpaid.png`,
      fullPage: true,
    })
  })

  await test.step("overpaid: another device removes the item while the payment is in flight", async () => {
    const billId = await startBillAndBeginCashPayment(page, "en")

    // Same race, opposite direction: the other device removes the bill's
    // only item, shrinking its total below the payment's already-fixed
    // amount.
    await simulateBillModifiedDuringPayment(page, billId, "removeAll")
    await markCashPaid(page, "en")

    await page
      .getByTestId("payment-paid-panel")
      .getByRole("button", { name: translate("en", "paymentWait.detail") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(
      page.getByText(
        translateParams("en", "overpayment.title", { amount: "$5.00" })
      )
    ).toBeVisible()
    await expect(
      page.getByText(
        translate("en", "paymentDetail.bill.coverage.changesTitle")
      )
    ).toBeVisible()
    await expect(
      page.locator("span", { hasText: "− 1 × Coffee" })
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-bill-overpaid.png`,
      fullPage: true,
    })
  })
})

test("a payment with both a cancellation collision and an overpaid bill shows both issues on its list row", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await test.step("set up a payment that ends up both canceled+claimed and tied to an overpaid bill", async () => {
    const billId = await startBillAndBeginCashPayment(page, "en")
    await simulateBillModifiedDuringPayment(page, billId, "removeAll")
    await markCashPaid(page, "en")
    await simulateCancelAfterClaim(page, "en")
  })

  await test.step("the activity list shows both issues on the same row", async () => {
    await gotoPage(page, "/activity", "en", "activity.title")
    const row = contentNav(page, "en").getByRole("link")
    await expect(row).toHaveCount(1)
    await expect(
      row.getByText(translate("en", "paymentDetail.collision.title"))
    ).toBeVisible()
    await expect(
      row.getByText(translate("en", "paymentHistory.billOverpaid"))
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/activity-list-multiple-issues.png`,
      fullPage: true,
    })
  })
})

test("a bill overpaid by two separately paid payments is flagged on the payment detail", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await test.step("create two independent payments before settling either", async () => {
    const billId = await startBillAndBeginCashPayment(page, "en")

    // A second payment is allowed while the first is still pending, as a
    // concurrent device could create it before either claim arrives.
    await createAndPaySecondPayment(page, billId)
    await markCashPaid(page, "en")
  })

  await test.step("the payment detail shows the bill as overpaid by the combined total", async () => {
    await page
      .getByTestId("payment-paid-panel")
      .getByRole("button", { name: translate("en", "paymentWait.detail") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    const overpaidAlert = page.getByRole("alert").filter({
      hasText: translateParams("en", "overpayment.title", { amount: "$5.00" }),
    })
    await expect(overpaidAlert).toBeVisible()
    await expect(overpaidAlert).toContainText("$5.00")
    await expect(overpaidAlert).toContainText("$10.00")

    await page.screenshot({
      path: `${screenshotDir}/payment-detail-bill-overpaid-two-payments.png`,
      fullPage: true,
    })
  })
})

test("after part of an overpayment is kept, the payment detail shows what is left and leads to resolving it on the bill", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startBillAndBeginCashPayment(page, "en")
  await simulateBillModifiedDuringPayment(page, billId, "removeAll")
  await markCashPaid(page, "en")
  await waitForLocalWriteToSettle(page)

  await test.step("keep 2.00 of the 5.00 on the bill", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await resolveOverpayment(page, "en", { kind: "kept", amount: "2" })
    await expect(overpaymentCard(page)).toContainText(
      translateParams("en", "overpayment.title", { amount: "$3.00" })
    )
  })

  await test.step("the payment opened from the Payments list reads overpaid by 3.00", async () => {
    await gotoPage(page, "/activity", "en", "activity.title")
    await page
      .getByRole("link")
      .filter({
        hasText: translateParams("en", "bill.list.label", { number: 1 }),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(
      page.getByRole("alert").filter({
        hasText: translateParams("en", "overpayment.title", {
          amount: "$3.00",
        }),
      })
    ).toBeVisible()
  })

  await test.step("Resolve on the bill is at least 44 px tall and opens the bill's overpayment card", async () => {
    const resolveOnBill = page.getByRole("button", {
      name: translate("en", "overpayment.resolveOnBill"),
    })
    expect(
      (await resolveOnBill.boundingBox())?.height ?? 0
    ).toBeGreaterThanOrEqual(44)
    await resolveOnBill.click()
    await page
      .getByRole("heading", { name: translate("en", "billDetail.title") })
      .waitFor()
    await expect(overpaymentCard(page)).toContainText(
      translateParams("en", "overpayment.title", { amount: "$3.00" })
    )
  })
})

test("the activity list flags a duplicate settlement of a bill payment as its bill overpaid", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  await startBillAndBeginCashPayment(page, "en")
  // Visiting the IBAN tab is what actually prepares it (`preparePaymentMethod`
  // is lazy, per-tab) — needed so `simulateDuplicateSettlement` below has
  // IBAN details to settle against. Switch back to the cash tab afterward,
  // since `markCashPaid`'s button only renders while it's active.
  await prepareIbanPayment(page, "en")
  await page
    .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
    .click()
  await markCashPaid(page, "en")
  await simulateDuplicateSettlement(page)
  // Settle wait covers both fire-and-forget writes above before the hard
  // navigation below — see `waitForLocalWriteToSettle`.
  await waitForLocalWriteToSettle(page)

  await gotoPage(page, "/activity", "en", "activity.title")
  const row = contentNav(page, "en").getByRole("link")
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(
    translate("en", "paymentHistory.billOverpaid")
  )
  await expect(row).not.toContainText(
    translate("en", "paymentDetail.excessCollision.title")
  )
  await page.screenshot({
    path: `${screenshotDir}/activity-list-duplicate-settlement-bill-overpaid.png`,
    fullPage: true,
  })
})

test("the activity list flags a bill overpaid by two separate payments without flagging either as a duplicate settlement", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })

  const billId = await startBillAndBeginCashPayment(page, "en")
  await createAndPaySecondPayment(page, billId)
  await markCashPaid(page, "en")
  // Settle wait covers both fire-and-forget writes above before the hard
  // navigation below — see `waitForLocalWriteToSettle`.
  await waitForLocalWriteToSettle(page)

  await gotoPage(page, "/activity", "en", "activity.title")
  const rows = contentNav(page, "en").getByRole("link")
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText(
    translate("en", "paymentHistory.billOverpaid")
  )
  await expect(rows.nth(1)).toContainText(
    translate("en", "paymentHistory.billOverpaid")
  )
  await expect(
    page.getByText(translate("en", "paymentDetail.excessCollision.title"))
  ).toHaveCount(0)
  await page.screenshot({
    path: `${screenshotDir}/activity-list-bill-overpaid-two-payments.png`,
    fullPage: true,
  })
})
