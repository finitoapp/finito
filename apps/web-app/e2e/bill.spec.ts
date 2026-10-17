import {
  addBrickCenter,
  addCatalogCategory,
  addCatalogItem,
  addTable,
  startNewBill,
  tapAddBrick,
} from "./support/bill.ts"
import { startCollisionBill } from "./support/collisions.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import {
  nameParam,
  translate,
  translateParams,
  translateValue,
} from "./support/i18n.ts"
import { fillInlineField } from "./support/inline-edit.ts"
import {
  contentNav,
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import { overpaymentCard, startPartlyPaidBill } from "./support/overpayment.ts"
import {
  createPayment,
  markCashPaid,
  startBillAndBeginCashPayment,
} from "./support/payment.ts"

test("build a cart, save it, resume it, and discard it", async ({
  seededPage: page,
}) => {
  await test.step("add a catalog item", () =>
    addCatalogItem(page, "en", { name: "Coffee", price: "5" }))

  await test.step("open the cart from the home icon", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const addCoffee = page.getByRole("button", {
    name: nameParam("bill.brick.add.aria", "Coffee"),
  })
  const removeCoffee = page.getByRole("button", {
    name: nameParam("bill.brick.remove.aria", "Coffee"),
  })
  const summaryTrigger = page.getByTestId("bill-summary-trigger")

  await test.step("search filters the item grid", async () => {
    const searchInput = page.getByRole("textbox", {
      name: translate("en", "bill.search"),
    })
    await searchInput.fill("nonexistent")
    await expect(
      page.getByText(translate("en", "bill.emptySearch"))
    ).toBeVisible()
    await searchInput.fill("")
    await expect(addCoffee).toBeVisible()
  })

  await test.step("adding and removing items updates the summary", async () => {
    // Each tap's effect is asserted before the next one, so this stays a
    // flow test. Firing two and checking only the total made it depend on
    // back-to-back taps landing — which is a real question, but one the
    // "taps that land while the cart is still settling" test below owns, with
    // raw mouse input rather than `locator.click()`'s actionability waiting.
    await addCoffee.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await addCoffee.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
    await removeCoffee.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
  })

  const summaryPanel = page.getByTestId("bill-summary-panel")

  await test.step("expand the summary and undo/redo/clear", async () => {
    await summaryTrigger.click()
    await expect(summaryPanel.getByText("Coffee")).toBeVisible()

    // Scoped to the summary panel: a clear/remove below also raises an
    // undo toast whose action button shares this same accessible name.
    const undoButton = summaryPanel.getByRole("button", {
      name: translate("en", "bill.summary.undo"),
    })
    const redoButton = summaryPanel.getByRole("button", {
      name: translate("en", "bill.summary.redo"),
    })
    const clearButton = summaryPanel.getByRole("button", {
      name: translate("en", "bill.summary.clear"),
    })

    // Last action was "remove one" (quantity 1 -> 2 on undo).
    await undoButton.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
    await redoButton.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )

    await clearButton.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 0)
    )
    await undoButton.click()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
  })

  await test.step("closing the bill returns to the bills list, where the saved cart appears", async () => {
    // A tap outside the open summary only closes it.
    await page.getByTestId("bill-summary-backdrop").click()
    await expect(summaryPanel).toBeHidden()
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
    await page.getByTestId("no-table-tile").waitFor()
    const unassignedBillRow = page
      .getByTestId("no-table-tile")
      .getByRole("link", { name: /^Bill #/ })
    await expect(unassignedBillRow).toHaveCount(1)

    await unassignedBillRow.click()
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
  })

  await test.step("discard the resumed cart with confirmation", async () => {
    const discardButton = page.getByRole("button", {
      name: translate("en", "bill.discard"),
    })
    await discardButton.click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.discard.confirm.confirm"),
      })
      .click()
    await expect(page.getByTestId("no-table-tile")).toContainText(
      translate("en", "home.pos.noTable.empty")
    )
  })
})

test("the on-the-bill filter shows only the items the bill holds", async ({
  seededPage: page,
}) => {
  await test.step("add two items", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await addCatalogItem(page, "en", { name: "Tea", price: "3" })
  })

  await test.step("open the cart", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const addCoffee = page.getByRole("button", {
    name: nameParam("bill.brick.add.aria", "Coffee"),
  })
  const addTea = page.getByRole("button", {
    name: nameParam("bill.brick.add.aria", "Tea"),
  })
  const inBillFilter = page.getByRole("button", {
    name: translate("en", "bill.filter.inBill"),
  })

  await test.step("an empty bill says so", async () => {
    await inBillFilter.click()
    await expect(
      page.getByText(translate("en", "bill.filter.inBill.empty"))
    ).toBeVisible()
  })

  await test.step("only the item added is listed", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.category.all") })
      .click()
    await addCoffee.click()
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await inBillFilter.click()
    await expect(addCoffee).toBeVisible()
    await expect(addTea).toBeHidden()
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

  await test.step("open the cart", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const searchInput = page.getByRole("textbox", {
    name: translate("en", "bill.search"),
  })
  const coffeeBrick = page.getByRole("button", {
    name: nameParam("bill.brick.add.aria", "Espresso Blend"),
  })
  const teaBrick = page.getByRole("button", {
    name: nameParam("bill.brick.add.aria", "Tea"),
  })

  await test.step("matches by internal name", async () => {
    await searchInput.fill("Espresso")
    await expect(coffeeBrick).toBeVisible()
    await expect(teaBrick).not.toBeVisible()
  })

  await test.step("matches by SKU", async () => {
    await searchInput.fill("COF-001")
    await expect(coffeeBrick).toBeVisible()
    await expect(teaBrick).not.toBeVisible()
  })

  await test.step("matches by scan code", async () => {
    await searchInput.fill("8594001234567")
    await expect(coffeeBrick).toBeVisible()
    await expect(teaBrick).not.toBeVisible()
  })

  await test.step("still matches by the public name even when an internal name is set", async () => {
    await searchInput.fill("Coffee")
    await expect(coffeeBrick).toBeVisible()
    await expect(teaBrick).not.toBeVisible()
  })
})

test("discards a resumed cart from the bill page", async ({
  seededPage: page,
}) => {
  await test.step("create an item and save it in a cart", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    // Wait for the lazily-created bill's own navigation (replacing the URL
    // with its billId) to land before closing, so it can't race the back
    // navigation and leave the router on neither URL.
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBeNull()
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
    await page.getByTestId("no-table-tile").waitFor()
  })

  await test.step("resume the saved cart", async () => {
    await page
      .getByTestId("no-table-tile")
      .getByRole("link", { name: /^Bill #/ })
      .click()
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
  })

  await test.step("discard it via the discard button", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.discard") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.discard.confirm.confirm"),
      })
      .click()
    await page.getByTestId("no-table-tile").waitFor()
  })

  await test.step("the cart no longer appears in the saved carts list", async () => {
    await expect(page.getByTestId("no-table-tile")).toContainText(
      translate("en", "home.pos.noTable.empty")
    )
  })
})

test("shows the right message for a closed or missing bill", async ({
  seededPage: page,
}) => {
  let billId: string | null = null

  await test.step("create a cart and charge it with cash", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
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
      .getByRole("button", { name: translate("en", "home.pay") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "paymentTip.none") })
      .click()
    await markCashPaid(page, "en")

    // Return to the terminal through the in-app link (client-side route,
    // no full page reload) rather than an immediate page.goto: closing the
    // bill after cash payment is a fire-and-forget write kicked off by this
    // same screen, and a hard navigation right away would tear down the
    // page before that write lands.
    await page
      .getByRole("button", { name: translate("en", "paymentWait.back") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "nav.numpad") })
      .waitFor()
  })

  await test.step("the closed bill opens as its activity detail", async () => {
    await page.goto(`/bill?billId=${billId}`, {
      waitUntil: "domcontentloaded",
    })
    // The bill screen serves only an open bill (access/0002).
    await page.waitForURL(/\/activity\/bills\//u)
    await page
      .getByRole("heading", { name: translate("en", "billDetail.title") })
      .waitFor()
  })

  await test.step("a never-issued bill id opens as a fresh, empty cart", async () => {
    // A well-formed but never-issued id: real ids encode trailing padding
    // bits in their last character, so only the first character of a known
    // valid id is swapped, keeping the rest (and its encoding) untouched.
    // The bill row behind such an id is only ever written lazily on its
    // first added item (see `use-cart-bill.ts`), the same as any other
    // fresh cart's client-generated id — there's nothing that distinguishes
    // it as "invalid" ahead of that, so it opens ready to use rather than
    // showing an error.
    const missingBillId = `${billId?.[0] === "a" ? "b" : "a"}${billId?.slice(1)}`
    await gotoPage(page, `/bill?billId=${missingBillId}`, "en", "bill.title")
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
  })
})

test("decrements a saved item after its catalog snapshot changes", async ({
  seededPage: page,
}) => {
  await test.step("create an item and save it in a cart", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
  })

  await test.step("edit the catalog price", async () => {
    await gotoPage(page, "/catalog/items", "en", "catalog.items.title")
    await page.getByRole("link", { name: "Coffee" }).click()
    await fillInlineField(
      page,
      page.getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      }),
      "6"
    )
  })

  await test.step("resume the cart and remove its old snapshot", async () => {
    await gotoPosOverview(page, "en")
    await page
      .getByTestId("no-table-tile")
      .getByRole("link", { name: /^Bill #/ })
      .click()
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.remove.aria", "Coffee"),
      })
      .click()
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      translateValue("en", "bill.itemsCount", 0)
    )
  })
})

test("charges a cart and closes it once cash is paid", async ({
  seededPage: page,
}) => {
  await test.step("add a cart item and open payment", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()

    const chargeButton = page.getByRole("button", {
      name: translate("en", "home.pay"),
    })
    await expect(chargeButton).toBeInViewport()
    await chargeButton.click()
    await page
      .getByRole("heading", { name: translate("en", "paymentTip.title") })
      .waitFor()
    expect(new URL(page.url()).searchParams.get("billId")).not.toBeNull()
    await expect(page.locator("h1")).toHaveText("$5.00")
  })

  await test.step("continue with no tip and mark cash paid", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentTip.none") })
      .click()
    await markCashPaid(page, "en")

    // Return to the terminal through the in-app link (client-side route,
    // no full page reload) rather than an immediate page.goto: closing the
    // bill after cash payment is a fire-and-forget write kicked off by this
    // same screen, and a hard navigation right away would tear down the
    // page before that write lands.
    await page
      .getByRole("button", { name: translate("en", "paymentWait.back") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "nav.numpad") })
      .waitFor()
  })

  await test.step("verify the paid bill is no longer resumable", async () => {
    await gotoPosOverview(page, "en")
    await expect(page.getByTestId("no-table-tile")).toContainText(
      translate("en", "home.pos.noTable.empty")
    )
  })
})

test("the assign-table dialog shows a table as free again once its bill is settled", async ({
  seededPage: page,
}) => {
  await test.step("seed a table and a catalog item", async () => {
    await addTable(page, "en", { name: "Patio 1", seatCount: "4" })
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  })

  await test.step("start a bill on Patio 1 and pay it off", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await page
      .getByRole("button", {
        name: translate("en", "bill.table.aria"),
      })
      .click()
    const dialog = page.getByRole("dialog", {
      name: translate("en", "bill.table.dialog.title"),
    })
    await dialog.getByRole("button", { name: "Patio 1" }).click()
    await expect(dialog).not.toBeVisible()

    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await page
      .getByRole("button", { name: translate("en", "home.pay") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "paymentTip.none") })
      .click()
    await markCashPaid(page, "en")
    await page
      .getByRole("button", { name: translate("en", "paymentWait.back") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "nav.numpad") })
      .waitFor()
  })

  await test.step("Patio 1 shows as free in a new bill's assign-table dialog", async () => {
    // Paying off the first bill already left the home screen in tables/POS
    // mode, so `startNewBill`'s own unconditional "switch to POS" click
    // would find nothing to click — go through `gotoPosOverview` instead,
    // which tolerates already being there.
    await gotoPosOverview(page, "en")
    await page
      .getByTestId("no-table-tile")
      .getByRole("link", { name: translate("en", "tables.tile.newBill") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await page
      .getByRole("button", { name: translate("en", "bill.table.aria") })
      .click()
    const dialog = page.getByRole("dialog", {
      name: translate("en", "bill.table.dialog.title"),
    })
    const patioTile = dialog.getByRole("button", { name: "Patio 1" })
    await expect(patioTile).toContainText(translate("en", "tables.tile.free"))
  })
})

test("locks a bill while its payment is pending, and unlocks it once that payment is canceled", async ({
  seededPage: page,
}) => {
  let billId = ""
  let paymentPageUrl = ""

  await test.step("add a cart item and start a payment", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    billId = await startBillAndBeginCashPayment(page, "en")
    paymentPageUrl = page.url()
  })

  await test.step("the bill shows as locked while the payment is pending", async () => {
    await page.goto(`/bill?billId=${billId}`, {
      waitUntil: "domcontentloaded",
    })
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    await expect(page.getByText(translate("en", "bill.locked"))).toBeVisible()

    const viewPaymentButton = page.getByRole("button", {
      name: translate("en", "bill.locked.viewPayment"),
    })
    await expect(viewPaymentButton).toBeVisible()
    await viewPaymentButton.click()
    await page
      .getByRole("button", { name: translate("en", "paymentWait.cancel") })
      .waitFor()
    expect(page.url()).toBe(paymentPageUrl)

    await page.goto(`/bill?billId=${billId}`, {
      waitUntil: "domcontentloaded",
    })
  })

  await test.step("canceling the payment unlocks the bill again", async () => {
    await page.goto(paymentPageUrl, { waitUntil: "domcontentloaded" })
    await page
      .getByRole("button", { name: translate("en", "paymentWait.cancel") })
      .click()

    // The cancel handler navigates back to the bill itself since this
    // payment has a billId.
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    await expect(
      page.getByText(translate("en", "bill.locked"))
    ).not.toBeVisible()
    await expect(
      page.getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
    ).toBeVisible()
  })

  await test.step("the canceled payment's own page hands it to its activity detail, canceled, not paid", async () => {
    await page.goto(paymentPageUrl, { waitUntil: "domcontentloaded" })
    // The payment screen serves only an open payment (access/0002).
    await page.waitForURL(/\/activity\/[^/]+$/u)
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    await expect(
      page.getByText(translate("en", "payment.status.canceled")).first()
    ).toBeVisible()
    // The success ("paid") panel must not render at all for a canceled
    // payment — `isPaid` is now derived from `derivePaymentStatus`, which
    // ranks `canceled` above `paid` even though a claim could in principle
    // still exist. See docs/bill-payment-states.md.
    await expect(page.getByTestId("payment-paid-panel")).toHaveCount(0)
  })

  await test.step("the redirect replaced the payment screen in history", async () => {
    await page.goBack()
    await expect(page).not.toHaveURL(/\/payment\//)
  })
})

test("a link with an id that can't be parsed shows an invalid-id page with a way home, not the error boundary", async ({
  seededPage: page,
}) => {
  const backButton = page.getByRole("button", {
    name: translate("en", "nav.back"),
  })
  const homeButton = page.getByRole("button", {
    name: translate("en", "nav.menu"),
  })

  await test.step("a malformed bill link", async () => {
    await page.goto("/bill?billId=not-a-bill-id", {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByText(translate("en", "bill.invalidId"))
    ).toBeVisible()
    // The whole point: this used to throw out of `validateSearch` and land
    // in the global error boundary.
    await expect(page.getByText(translate("en", "appError.title"))).toHaveCount(
      0
    )

    await backButton.click()
    await expect(homeButton).toBeVisible()
  })

  await test.step("a malformed payment link", async () => {
    await page.goto("/payment/not-a-payment-id", {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByText(translate("en", "paymentWait.invalidId"))
    ).toBeVisible()

    await backButton.click()
    await expect(homeButton).toBeVisible()
  })

  await test.step("a malformed tableId only costs the table preselection", async () => {
    await page.goto("/bill?tableId=not-a-table-id", {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByRole("heading", { name: translate("en", "bill.title") })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: translate("en", "bill.table.assign") })
    ).toBeVisible()
  })
})

test("canceling a bill-less keypad payment lands back on the keypad", async ({
  seededPage: page,
}) => {
  await test.step("start a keypad payment with no bill behind it", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await createPayment(page, "en")
  })

  await test.step("cancel the payment", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentWait.cancel") })
      .click()
  })

  await test.step("lands back on the keypad, not in a brand-new bill", async () => {
    await expect(page).not.toHaveURL(/\/bill/)
    await expect(
      page.getByRole("button", { name: translate("en", "home.pay") })
    ).toBeVisible()
  })
})

test("adds a bulk quantity through the quantity dialog", async ({
  seededPage: page,
}) => {
  await test.step("add a catalog item and open the cart", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const summaryTrigger = page.getByTestId("bill-summary-trigger")
  const quantityTrigger = page.getByRole("button", {
    name: nameParam("bill.brick.quantity.trigger.aria", "Coffee"),
  })

  // The quantity shows, and opens the dialog, once the item is on the bill.
  await test.step("a tap on the tile puts one on the bill", async () => {
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect(quantityTrigger).toContainText("1")
  })

  await test.step("cancelling the dialog leaves the cart untouched", async () => {
    await quantityTrigger.click()
    await page
      .getByRole("dialog", { name: "Coffee" })
      .getByRole("textbox", {
        name: translate("en", "bill.brick.quantity.input.aria"),
      })
      .fill("7")
    await page
      .getByRole("button", {
        name: translate("en", "bill.brick.quantity.cancel"),
      })
      .click()
    await expect(page.getByRole("dialog", { name: "Coffee" })).not.toBeVisible()
    await expect(quantityTrigger).toContainText("1")
  })

  await test.step("confirming adds the whole quantity in one go", async () => {
    await quantityTrigger.click()
    const dialog = page.getByRole("dialog", { name: "Coffee" })
    await dialog
      .getByRole("textbox", {
        name: translate("en", "bill.brick.quantity.input.aria"),
      })
      .fill("12")
    await dialog
      .getByRole("button", {
        name: translate("en", "bill.brick.quantity.confirm"),
      })
      .click()
    await expect(dialog).not.toBeVisible()
    await expect(quantityTrigger).toContainText("13")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 13)
    )
  })

  await test.step("reopening the dialog starts empty, since confirming adds", async () => {
    await quantityTrigger.click()
    await expect(
      page.getByRole("dialog", { name: "Coffee" }).getByRole("textbox", {
        name: translate("en", "bill.brick.quantity.input.aria"),
      })
    ).toHaveValue("")
  })

  await test.step("confirming again adds on top instead of setting", async () => {
    const dialog = page.getByRole("dialog", { name: "Coffee" })
    await dialog
      .getByRole("textbox", {
        name: translate("en", "bill.brick.quantity.input.aria"),
      })
      .fill("3")
    await dialog
      .getByRole("button", {
        name: translate("en", "bill.brick.quantity.confirm"),
      })
      .click()
    await expect(dialog).not.toBeVisible()
    await expect(quantityTrigger).toContainText("16")
  })
})

test("filters the item grid by category", async ({ seededPage: page }) => {
  await test.step("create a category and items in and out of it", async () => {
    await addCatalogCategory(page, "en", "Drinks")
    await addCatalogItem(page, "en", {
      name: "Coffee",
      price: "5",
      categoryName: "Drinks",
    })
    await addCatalogItem(page, "en", { name: "Sandwich", price: "6" })
  })

  await test.step("open the bill", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const coffeeCard = page.getByText("Coffee", { exact: true })
  const sandwichCard = page.getByText("Sandwich", { exact: true })

  await test.step("both items are visible with the 'all' filter", async () => {
    await expect(coffeeCard).toBeVisible()
    await expect(sandwichCard).toBeVisible()
  })

  await test.step("the 'Drinks' filter only shows the categorized item", async () => {
    await page.getByRole("button", { name: "Drinks" }).click()
    await expect(coffeeCard).toBeVisible()
    await expect(sandwichCard).not.toBeVisible()
  })

  await test.step("the 'Uncategorized' filter only shows the other item", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "bill.category.uncategorized"),
      })
      .click()
    await expect(sandwichCard).toBeVisible()
    await expect(coffeeCard).not.toBeVisible()
  })

  await test.step("the 'All' filter shows both items again", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.category.all") })
      .click()
    await expect(coffeeCard).toBeVisible()
    await expect(sandwichCard).toBeVisible()
  })
})

test("assigns and clears a table on a cart from the bill header", async ({
  seededPage: page,
}) => {
  await test.step("seed a table and a catalog item", async () => {
    await addTable(page, "en", { name: "Patio 1", seatCount: "4" })
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  })

  await test.step("open the bill", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  const tableButton = page.getByRole("button", {
    name: translate("en", "bill.table.aria"),
  })

  await test.step("assign the table before the cart has a bill yet", async () => {
    await tableButton.click()
    const dialog = page.getByRole("dialog", {
      name: translate("en", "bill.table.dialog.title"),
    })
    await dialog.getByRole("button", { name: "Patio 1" }).click()
    await expect(dialog).not.toBeVisible()
    await expect(tableButton).toContainText("Patio 1")
  })

  await test.step("the lazily created bill keeps the assigned table", async () => {
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.add.aria", "Coffee"),
      })
      .click()
    await expect(tableButton).toContainText("Patio 1")
    // `billId` is already in the URL before this tap (it's generated up
    // front now, not once the bill is lazily created), so it's no longer a
    // signal that the create-plus-assign write has landed — the hard nav
    // below could otherwise race ahead of it and reload before the table
    // assignment is visible to the POS overview.
    await waitForLocalWriteToSettle(page)
  })

  await test.step("the POS overview shows the bill inside Patio 1's tile", async () => {
    await gotoPosOverview(page, "en")
    const patioTile = page
      .getByTestId("table-tile")
      .filter({ hasText: "Patio 1" })
    await expect(patioTile.getByRole("link", { name: /^Bill #/ })).toHaveCount(
      1
    )
  })

  await test.step("clear the table assignment", async () => {
    await page.goBack()
    await page.getByRole("heading", { name: /^Bill #/ }).waitFor()
    await tableButton.click()
    const dialog = page.getByRole("dialog", {
      name: translate("en", "bill.table.dialog.title"),
    })
    await dialog
      .getByRole("button", {
        name: translate("en", "bill.table.dialog.none"),
      })
      .click()
    await expect(dialog).not.toBeVisible()
    await expect(tableButton).toContainText(
      translate("en", "bill.table.assign")
    )
  })
})

test("a bill canceled while its payment is pending, then confirmed anyway, is flagged as a collision on every surface and can be resolved", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const { billId, paymentPageUrl } = await startCollisionBill(page, "en")

  await test.step("the bills list flags the collision", async () => {
    await gotoPage(page, "/activity/bills", "en", "activity.title")
    const row = contentNav(page, "en").locator(`a[href$="/${billId}"]`)
    await expect(row).toContainText(translate("en", "bill.status.canceled"))
    await expect(row).toContainText(translate("en", "bill.collision.title"))
    await page.screenshot({
      path: `${screenshotDir}/activity-bills-list-collision.png`,
      fullPage: true,
    })
  })

  await test.step("the bills detail page flags the collision", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByText(translate("en", "bill.collision.title"))
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "bill.collision.description"))
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/activity-bill-detail-collision.png`,
      fullPage: true,
    })
  })

  await test.step("the bill cart page shows the collision with the total, and links to the funding payment's detail page", async () => {
    await page.goto(`/bill?billId=${billId}`, { waitUntil: "domcontentloaded" })
    await expect(
      page.getByText(translate("en", "bill.collision.title"))
    ).toBeVisible()
    await expect(page.getByText("$5.00")).toBeVisible()

    const viewPaymentButton = page.getByRole("button", {
      name: translate("en", "bill.collision.viewPayment"),
    })
    await expect(viewPaymentButton).toBeVisible()
    await viewPaymentButton.click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
    // Goes straight to the payment's detail page, not the wait screen —
    // unlike `bill.locked.viewPayment`'s link, this payment is already
    // settled, so there's no "pending" state left to wait on.
    const paymentId = new URL(paymentPageUrl).pathname.split("/").pop()
    expect(page.url()).toContain(`/activity/${paymentId}`)
    await expect(
      page.getByText(translate("en", "bill.collision.title"))
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-bill-collision.png`,
      fullPage: true,
    })
  })

  await test.step("resolving the collision from the payment detail page flips the bill to closed", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "bill.collision.markClosed"),
      })
      .click()
    await expect(
      page.getByText(translate("en", "bill.collision.title"))
    ).toBeHidden()
    await page.screenshot({
      path: `${screenshotDir}/payment-detail-bill-resolved.png`,
      fullPage: true,
    })
  })

  await test.step("the bill cart page no longer shows the collision", async () => {
    await page.goto(`/bill?billId=${billId}`, { waitUntil: "domcontentloaded" })
    // Resolved, the bill is closed, which the bill screen no longer serves.
    // The bill screen serves only an open bill (access/0002).
    await page.waitForURL(/\/activity\/bills\//u)
    await page
      .getByRole("heading", { name: translate("en", "billDetail.title") })
      .waitFor()
    await expect(
      page.getByText(translate("en", "bill.collision.title"))
    ).toBeHidden()
    await page.screenshot({
      path: `${screenshotDir}/bill-page-resolved.png`,
      fullPage: true,
    })
  })
})

test("the bill page's own collision message resolves directly, without going through the payment", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const { billId } = await startCollisionBill(page, "en")

  await page.goto(`/bill?billId=${billId}`, { waitUntil: "domcontentloaded" })
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
  await expect(page.getByText(translate("en", "bill.closed"))).toBeVisible()
  await page.screenshot({
    path: `${screenshotDir}/bill-page-resolved-directly.png`,
    fullPage: true,
  })
})

test("adding two different items in quick succession lazily creates only one bill", async ({
  seededPage: page,
}) => {
  // Regression test for a race in `useCartBill`'s `ensureBillId`: before a
  // fresh cart's first add resolves, `billId` is still undefined on the
  // client, so a second add fired before that first one's `createBillAtEnd`
  // and route navigation land used to see `billId === undefined` too and
  // create its own separate bill — silently losing one of the two items on
  // an orphaned bill. Firing both adds without awaiting either in between
  // reproduces that race window.
  //
  // The two taps are fired as raw mouse clicks, one after the other, rather
  // than as two concurrent `locator.click()`s in a `Promise.all`: Playwright
  // does not support concurrent actions on one page — both clicks drive the
  // same virtual mouse, so they interleave and one of the two is dropped by
  // the driver (measured at roughly 2-3% of attempts, even on a settled bill
  // with nothing racing in the app). Sequential mouse clicks still fire the
  // second tap milliseconds after the first, long before it settles, and
  // unlike `locator.click()` they don't wait for the target to be enabled,
  // so they reproduce the app-side race harder rather than more softly.
  await test.step("seed two catalog items", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await addCatalogItem(page, "en", { name: "Tea", price: "3" })
  })

  await test.step("open a fresh cart", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  await test.step("add both items without waiting for the first to settle", async () => {
    await tapAddBrick(page, "Coffee")
    await tapAddBrick(page, "Tea")
  })

  await test.step("both items end up on the same, single bill", async () => {
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBeNull()

    const summaryTrigger = page.getByTestId("bill-summary-trigger")
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )

    await summaryTrigger.click()
    const summaryPanel = page.getByTestId("bill-summary-panel")
    await expect(summaryPanel.getByText("Coffee")).toBeVisible()
    await expect(summaryPanel.getByText("Tea")).toBeVisible()
  })

  await test.step("discarding it leaves no other draft bill behind", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.discard") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.discard.confirm.confirm"),
      })
      .click()
    await page.getByTestId("no-table-tile").waitFor()
    await expect(page.getByTestId("no-table-tile")).toContainText(
      translate("en", "home.pos.noTable.empty")
    )
    await expect(
      page.getByTestId("no-table-tile").getByRole("link", { name: /^Bill #/ })
    ).toHaveCount(0)
  })
})

test("rapid taps on the item grid are never dropped", async ({
  seededPage: page,
}) => {
  // Deterministic companion to the test above, which only reproduces the
  // two ways a tap gets swallowed as a rare flake: locator `.click()` waits
  // for the target to be enabled and fires press and release back to back,
  // so it papers over both a cart that disables its "+" buttons while a
  // mutation is in flight and a bill page that remounts (replacing every
  // node in the grid) the moment the first added item lazily creates the
  // bill. Raw mouse input reproduces both on purpose: it lands wherever the
  // finger lands, and its press and release can straddle the moment the
  // bill appears.
  await test.step("seed two catalog items", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await addCatalogItem(page, "en", { name: "Tea", price: "3" })
  })

  await test.step("open a fresh cart", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  await test.step("hold a second tap across the moment the bill is created", async () => {
    const tea = await addBrickCenter(page, "Tea")

    await tapAddBrick(page, "Coffee")
    await page.mouse.move(tea.x, tea.y)
    await page.mouse.down()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBeNull()
    await page.mouse.up()
  })

  await test.step("tap the first brick twice more, back to back", async () => {
    await tapAddBrick(page, "Coffee")
    await tapAddBrick(page, "Coffee")
  })

  await test.step("every tap ended up on the one bill", async () => {
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      translateValue("en", "bill.itemsCount", 4)
    )
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      "$18.00"
    )
  })
})

test("a double-tapped charge creates only one payment", async ({
  seededPage: page,
}) => {
  await test.step("add a catalog item", () =>
    addCatalogItem(page, "en", { name: "Coffee", price: "5" }))

  // With tips on, charging only navigates to the tip screen and creates
  // nothing — the bill's charge button issues the payment itself only on
  // the no-tips path, which is the one that could mint two of them.
  await test.step("turn tips off", async () => {
    await gotoPage(page, "/settings/tips", "en", "settings.tips.title")
    await page
      .getByRole("checkbox", {
        name: translate("en", "settings.tips.enabled.label"),
      })
      .click()
    await page
      .getByRole("button", { name: translate("en", "settings.tips.save") })
      .click()
    await expect(
      page.getByText(translate("en", "settings.tips.saved"))
    ).toBeVisible()
  })

  await test.step("charge the cart twice within one task", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await page
      .getByRole("button", { name: nameParam("bill.brick.add.aria", "Coffee") })
      .click()

    const chargeButton = page.getByRole("button", {
      name: translate("en", "home.pay"),
    })
    await expect(chargeButton).toBeInViewport()
    // The button stays disabled until the added line lands in `summaries`,
    // and the raw clicks below skip the actionability checks that would
    // otherwise wait this out — an early click just returns and charges
    // nothing.
    await expect(chargeButton).toBeEnabled()
    // Both clicks land before React can re-render the button as disabled —
    // the real two-taps-on-a-slow-terminal case. Playwright's own `click()`
    // waits for actionability and would serialise them instead.
    await chargeButton.evaluate((button: HTMLElement) => {
      button.click()
      button.click()
    })
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.iban") })
      .waitFor()
  })

  await test.step("the bill is locked by exactly one payment", async () => {
    await page.goBack()
    await expect(page.getByText(translate("en", "bill.locked"))).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: translate("en", "bill.locked.viewPayment"),
        exact: true,
      })
    ).toBeVisible()
  })
})

test("removing lines a guest has paid for asks first and offers to resolve the overpayment", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId = await startPartlyPaidBill(page, "en")
  const summaryTrigger = page.getByTestId("bill-summary-trigger")
  const clearButton = page
    .getByTestId("bill-summary-panel")
    .getByRole("button", { name: translate("en", "bill.summary.clear") })
  const question = page.getByRole("alertdialog")

  await test.step("Removing every line after a guest paid", async () => {
    await summaryTrigger.click()
    await clearButton.click()
    await expect(question).toContainText(
      translateParams("en", "bill.cover.overpaid.title", { amount: "$5.00" })
    )
  })

  await test.step("Removal canceled", async () => {
    await question
      .getByRole("button", { name: translate("en", "bill.cover.cancel") })
      .click()
    await expect(question).toBeHidden()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
    await expect(clearButton).toBeEnabled()
  })

  await test.step("Decide later", async () => {
    await clearButton.click()
    await question
      .getByRole("button", { name: translate("en", "bill.cover.confirm") })
      .click()
    await page.waitForURL(/\/activity\/bills\//u)
    await expect(overpaymentCard(page)).toContainText("$5.00")
    await page.screenshot({
      path: `${screenshotDir}/bill-removal-overpaid-decide.png`,
      fullPage: true,
    })
    await overpaymentCard(page)
      .getByRole("button", {
        name: translate("en", "overpayment.decideLater"),
      })
      .click()
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByText(translate("en", "bill.status.closed")).first()
    ).toBeVisible()
    await expect(overpaymentCard(page)).toContainText("$5.00")
    await expect(
      overpaymentCard(page).getByRole("button", {
        name: translate("en", "overpayment.decideLater"),
      })
    ).toHaveCount(0)
  })
})
