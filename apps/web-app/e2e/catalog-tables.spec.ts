import { addTable, injectScanCode } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate } from "./support/i18n.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"
import {
  checkTableSticker,
  enableTableSelfPay,
  routeFakeNostrRelays,
  seedActiveFioPlugin,
} from "./support/self-pay.ts"

test("create, edit and delete a table", async ({ seededPage: page }) => {
  await test.step("open table settings and see the empty state", () =>
    gotoPage(page, "/catalog/tables", "en", "catalog.tables.title"))

  await expect(
    page.getByText(translate("en", "catalog.tables.empty.title"))
  ).toBeVisible()

  await test.step("go to the add table form", async () => {
    await page
      .getByRole("button", { name: translate("en", "catalog.tables.add") })
      .click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.tables.form.title.create"),
      })
      .waitFor()
  })

  await test.step("fill in and save a new table", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.tables.form.name.label"),
      })
      .fill("Patio 1")
    await page
      .getByRole("textbox", {
        name: translate("en", "catalog.tables.form.seatCount.label"),
      })
      .fill("4")
    await page
      .getByRole("button", {
        name: translate("en", "catalog.tables.form.save.create"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.tables.title") })
      .waitFor()
  })

  const tableRow = page.getByRole("link", { name: /Patio 1/ })

  await test.step("verify the table appears in the list with its seat count", async () => {
    await expect(tableRow).toBeVisible()
    await expect(tableRow).toContainText("4")
  })

  const nameInput = page.getByRole("textbox", {
    name: translate("en", "catalog.tables.form.name.label"),
  })
  const seatCountInput = page.getByRole("textbox", {
    name: translate("en", "catalog.tables.form.seatCount.label"),
  })
  const saveButton = page.getByRole("button", {
    name: translate("en", "inlineEdit.save"),
  })

  await test.step("edit the table and see a generated code", async () => {
    await tableRow.click()
    await page
      .getByRole("heading", {
        name: translate("en", "catalog.tables.form.title.edit"),
      })
      .waitFor()

    await expect(nameInput).toHaveValue("Patio 1")

    const codeInput = page.getByRole("textbox", {
      name: translate("en", "catalog.tables.form.code.label"),
    })
    await expect(codeInput).toHaveValue(
      /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/
    )
    await expect(codeInput).toBeDisabled()

    // Each field saves itself; there is no submit button.
    await nameInput.fill("Patio 2")
    await nameInput.press("Enter")
  })

  await test.step("an edit holds focus until it is finished", async () => {
    await seatCountInput.fill("6")

    // Clicking away is refused: focus stays put and nothing is saved yet.
    await nameInput.click()
    await expect(seatCountInput).toBeFocused()

    await saveButton.click()
    await expect(saveButton).toBeHidden()

    const savedTick = page.getByLabel(translate("en", "inlineEdit.saved"))
    await expect(savedTick).toBeVisible()
    // It fades back out on its own.
    await expect(savedTick).toHaveCount(0, { timeout: 5_000 })
  })

  await test.step("an invalid value is rejected and can be discarded", async () => {
    const seatCountError = page.getByText(
      translate("en", "catalog.tables.form.seatCount.invalid")
    )
    await seatCountInput.fill("0")

    // A refused click away says why, rather than only blinking.
    await nameInput.click()
    await expect(seatCountError).toBeVisible()
    await expect(seatCountInput).toBeFocused()

    await saveButton.click()
    await expect(seatCountError).toBeVisible()

    // Escape drops the draft and the field falls back to the stored value.
    await seatCountInput.press("Escape")
    await expect(seatCountInput).toHaveValue("6")
  })

  await test.step("verify the edit persists after reload", async () => {
    await reloadPage(page, "en", "catalog.tables.form.title.edit")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.tables.form.name.label"),
      })
    ).toHaveValue("Patio 2")
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "catalog.tables.form.seatCount.label"),
      })
    ).toHaveValue("6")
  })

  await test.step("delete the table and confirm", async () => {
    await page
      .getByRole("button", { name: translate("en", "catalog.tables.delete") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "catalog.tables.delete.confirm.confirm"),
      })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "catalog.tables.title") })
      .waitFor()
  })

  await test.step("verify the list is empty again", async () => {
    await expect(
      page.getByText(translate("en", "catalog.tables.empty.title"))
    ).toBeVisible()
  })
})

test("search filters the tables list", async ({ seededPage: page }) => {
  await test.step("add two tables", async () => {
    await addTable(page, "en", { name: "Patio 1", seatCount: "4" })
    await addTable(page, "en", { name: "Patio 2", seatCount: "2" })
  })

  const searchInput = page.getByRole("textbox", {
    name: translate("en", "catalog.tables.search"),
  })
  const patio1Row = page.getByRole("link", { name: /Patio 1/ })
  const patio2Row = page.getByRole("link", { name: /Patio 2/ })

  await test.step("typing filters the list to matching tables", async () => {
    await searchInput.fill("Patio 1")
    await expect(patio1Row).toBeVisible()
    await expect(patio2Row).not.toBeVisible()
  })

  await test.step("no match shows the empty-search message", async () => {
    await searchInput.fill("nonexistent")
    await expect(
      page.getByText(translate("en", "catalog.tables.emptySearch"))
    ).toBeVisible()
  })

  await test.step("clearing the search restores the full list", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.tables.search.clear.aria"),
      })
      .click()
    await expect(searchInput).toHaveValue("")
    await expect(patio1Row).toBeVisible()
    await expect(patio2Row).toBeVisible()
  })
})

test("the tables list marks self-pay tables, and a sticker's verdict stays until dismissed", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(90_000)
  await routeFakeNostrRelays(context)
  let guestAddress = ""
  const selfPayMark = translate("en", "catalog.tables.selfPay.title")
  const verdict = page.getByRole("alert")

  await test.step("add two tables and switch self-pay on for one", async () => {
    await addTable(page, "en", { name: "Table 7", seatCount: "4" })
    await addTable(page, "en", { name: "Table 8", seatCount: "2" })
    guestAddress = await enableTableSelfPay(page, "en", "Table 7")
  })

  await test.step("the list marks only the self-pay table", async () => {
    await gotoPage(page, "/catalog/tables", "en", "catalog.tables.title")
    await expect(page.getByRole("link", { name: /Table 7/u })).toContainText(
      selfPayMark
    )
    await expect(
      page.getByRole("link", { name: /Table 8/u })
    ).not.toContainText(selfPayMark)
  })

  await test.step("a foreign sticker's verdict is still on screen 6 s later", async () => {
    await checkTableSticker(
      page,
      "en",
      guestAddress.replace(
        new URL(guestAddress).origin,
        "https://t.example.com"
      )
    )
    await expect(verdict).toContainText(
      translate("en", "catalog.tables.sticker.foreign")
    )
    await page.waitForTimeout(6_000)
    await expect(verdict).toContainText(
      translate("en", "catalog.tables.sticker.foreign")
    )
  })

  await test.step("the next sticker replaces the verdict, and dismissing clears it", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "catalog.tables.sticker.next"),
      })
      .click()
    await injectScanCode(page, guestAddress)
    await expect(verdict).toContainText(
      nameParam("catalog.tables.sticker.current", "Table 7")
    )
    await verdict
      .getByRole("button", {
        name: translate("en", "catalog.tables.sticker.dismiss"),
      })
      .click()
    await expect(verdict).toBeHidden()
    await expect(
      page.getByRole("button", {
        name: translate("en", "catalog.tables.sticker.check"),
      })
    ).toBeVisible()
  })
})

test("a self-pay table no payment method reaches says so and links to the payment accounts", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(90_000)
  await routeFakeNostrRelays(context)
  const cannotPay = page.getByRole("alert").filter({
    hasText: translate("en", "catalog.tables.selfPay.noPaymentMethod.title"),
  })

  await test.step("switch self-pay on with cash and a bank account without bank sync", async () => {
    await addTable(page, "en", { name: "Table 4", seatCount: "4" })
    await enableTableSelfPay(page, "en", "Table 4")
  })

  await test.step("the card says guests cannot pay yet, names what is missing and links to fix it", async () => {
    await expect(cannotPay).toBeVisible()
    await expect(cannotPay).toContainText(
      translate("en", "catalog.tables.selfPay.noPaymentMethod.description")
    )
    await expect(
      cannotPay.getByRole("link", {
        name: translate("en", "catalog.tables.selfPay.noPaymentMethod.link"),
      })
    ).toHaveAttribute("href", "/settings/payment-accounts")
  })

  await test.step("turning bank sync on clears the warning", async () => {
    await seedActiveFioPlugin(page)
    await expect(cannotPay).toBeHidden()
  })
})
