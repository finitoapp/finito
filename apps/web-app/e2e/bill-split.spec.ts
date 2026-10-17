import type { Page } from "@playwright/test"
import {
  addCatalogItem,
  addTable,
  startBillWithCoffee,
  startNewBill,
} from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate, translateValue } from "./support/i18n.ts"
import {
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import { startPartlyPaidBill } from "./support/overpayment.ts"

/**
 * Starts a bill assigned to `tableName` (an already-added table) and adds
 * one "Coffee" brick to it, returning its bill id — the "other open bill"
 * merge targets in this spec need a table so their row in the split
 * dialog's existing-bill picker can be told apart from the source bill.
 */
async function startBillOnTableWithCoffee(
  page: Page,
  tableName: string
): Promise<string> {
  await gotoPosOverview(page, "en")
  await page
    .getByTestId("table-tile")
    .filter({ hasText: tableName })
    .getByRole("link", { name: translate("en", "tables.tile.newBill") })
    .click()
  await page
    .getByRole("heading", { name: translate("en", "bill.title") })
    .waitFor()
  await page
    .getByRole("button", { name: nameParam("bill.brick.add.aria", "Coffee") })
    .click()

  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
  const billId = new URL(page.url()).searchParams.get("billId")
  if (!billId) throw new Error("Could not determine bill id from URL.")
  await waitForLocalWriteToSettle(page)
  return billId
}

/**
 * Shared setup for the "merge into an existing bill" scenarios below: a
 * "Coffee" catalog item, a target bill on its own table with one coffee, and
 * an unrelated source bill (the one left showing on `page`) with two
 * coffees — differing only in what each test does with the source bill's
 * split dialog afterward.
 */
async function setupMergeScenario(page: Page): Promise<{
  readonly targetBillId: string
  readonly sourceBillId: string
  readonly summaryTrigger: ReturnType<Page["getByTestId"]>
}> {
  await test.step("add a catalog item and a table", async () => {
    await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
    await addTable(page, "en", { name: "Merge Table", seatCount: "2" })
  })

  const targetBillId =
    await test.step("start the target bill on the table with one coffee", () =>
      startBillOnTableWithCoffee(page, "Merge Table"))

  const sourceBillId =
    await test.step("start a second, unrelated bill with two coffees", async () => {
      const billId = await startBillWithCoffee(page, "en")
      await page
        .getByRole("button", {
          name: nameParam("bill.brick.add.aria", "Coffee"),
        })
        .click()
      return billId
    })

  return {
    targetBillId,
    sourceBillId,
    summaryTrigger: page.getByTestId("bill-summary-trigger"),
  }
}

test("split selected items off a bill into a newly created bill", async ({
  seededPage: page,
}) => {
  await test.step("add a catalog item", () =>
    addCatalogItem(page, "en", { name: "Coffee", price: "5" }))

  await test.step("start a bill with three coffees", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    const addCoffee = page.getByRole("button", {
      name: nameParam("bill.brick.add.aria", "Coffee"),
    })
    await addCoffee.click()
    await addCoffee.click()
    await addCoffee.click()
  })

  const summaryTrigger = page.getByTestId("bill-summary-trigger")
  await expect(summaryTrigger).toContainText(
    translateValue("en", "bill.itemsCount", 3)
  )

  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
  const sourceBillId = new URL(page.url()).searchParams.get("billId")

  await test.step("split two coffees into a new bill", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.split.button.aria") })
      .click()
    await expect(
      page.getByText(translate("en", "bill.split.title"))
    ).toBeVisible()

    const increaseCoffee = page.getByRole("button", {
      name: nameParam("bill.split.increase.aria", "Coffee"),
    })
    await increaseCoffee.click()
    await increaseCoffee.click()
    await expect(
      page.getByText(`${translate("en", "bill.split.selectedCount")} 2`, {
        exact: false,
      })
    ).toBeVisible()

    await page
      .getByRole("button", {
        name: translate("en", "bill.split.confirm"),
        exact: true,
      })
      .click()
  })

  await test.step("lands on the new bill with the moved items", async () => {
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .not.toBe(sourceBillId)
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 2)
    )
  })

  await test.step("the source bill keeps the one remaining coffee", async () => {
    await page.goto(`/bill?billId=${sourceBillId}`, {
      waitUntil: "domcontentloaded",
    })
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
  })
})

test("the split button is disabled on an empty bill", async ({
  seededPage: page,
}) => {
  await test.step("open an empty bill", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
  })

  await expect(
    page.getByRole("button", {
      name: translate("en", "bill.split.button.aria"),
    })
  ).toBeDisabled()
})

test("select all merges a bill fully into an existing open bill", async ({
  seededPage: page,
}) => {
  const { targetBillId, sourceBillId, summaryTrigger } =
    await setupMergeScenario(page)

  await test.step("select all, then merge into the existing bill", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.split.button.aria") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "bill.split.selectAll") })
      .click()
    const existingTab = page.getByRole("button", {
      name: translate("en", "bill.split.destination.existing"),
    })
    await existingTab.click()
    await expect(existingTab).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: /Merge Table/ }).click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.split.confirm"),
        exact: true,
      })
      .click()
  })

  await test.step("navigates to the target bill, now holding all three coffees", async () => {
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .toBe(targetBillId)
    await page
      .getByRole("heading", { name: translate("en", "bill.title") })
      .waitFor()
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 3)
    )
  })

  await test.step("the emptied source bill was auto-canceled", async () => {
    await page.goto(`/bill?billId=${sourceBillId}`, {
      waitUntil: "domcontentloaded",
    })
    // The bill screen serves only an open bill (access/0002).
    await page.waitForURL(/\/activity\/bills\//u)
    await page
      .getByRole("heading", { name: translate("en", "billDetail.title") })
      .waitFor()
    await expect(
      page.getByText(translate("en", "bill.status.canceled"), { exact: true })
    ).toBeVisible()
  })
})

test("a partial split into an existing bill stays on the source bill", async ({
  seededPage: page,
}) => {
  const { sourceBillId, summaryTrigger } = await setupMergeScenario(page)

  await test.step("split just one coffee into the existing bill", async () => {
    await page
      .getByRole("button", { name: translate("en", "bill.split.button.aria") })
      .click()
    await page
      .getByRole("button", {
        name: nameParam("bill.split.increase.aria", "Coffee"),
      })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.split.destination.existing"),
      })
      .click()
    await page.getByRole("button", { name: /Merge Table/ }).click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.split.confirm"),
        exact: true,
      })
      .click()
  })

  await test.step("stays on the source bill, which kept its other coffee", async () => {
    await expect
      .poll(() => new URL(page.url()).searchParams.get("billId"))
      .toBe(sourceBillId)
    await expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", 1)
    )
  })
})

test("Split that leaves the bill paid exactly", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const sourceBillId = await startPartlyPaidBill(page, "en")

  await page
    .getByRole("button", { name: translate("en", "bill.split.button.aria") })
    .click()
  await page
    .getByRole("button", {
      name: nameParam("bill.split.increase.aria", "e2e: concurrent addition"),
    })
    .click()
  await page
    .getByRole("button", {
      name: translate("en", "bill.split.confirm"),
      exact: true,
    })
    .click()

  const question = page.getByRole("alertdialog")
  await expect(question).toContainText(translate("en", "bill.cover.paid.title"))
  await expect(question).toContainText(
    translate("en", "bill.cover.split.description")
  )
  await question
    .getByRole("button", { name: translate("en", "bill.cover.confirm") })
    .click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBe(sourceBillId)

  await page.goto(`/bill?billId=${sourceBillId}`, {
    waitUntil: "domcontentloaded",
  })
  await page.waitForURL(/\/activity\/bills\//u)
})
