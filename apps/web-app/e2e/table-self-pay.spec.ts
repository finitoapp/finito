import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import type { BrowserContext, Locator, Page } from "@playwright/test"
import { addCatalogItem, addTable } from "./support/bill.ts"
import { cancelBillDirectly } from "./support/collisions.ts"
import { colorContrast } from "./support/color-contrast.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { nameParam, translate, translateParams } from "./support/i18n.ts"
import {
  contentNav,
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import { seedOnboarding } from "./support/onboarding.ts"
import { overpaymentCard, resolveOverpayment } from "./support/overpayment.ts"
import {
  addBillLines,
  disableTableSelfPay,
  enableTableSelfPay,
  fakeSelfPayLightning,
  newGuestContext,
  openTableBill,
  payAllOfTheBeer,
  pickEqualShares,
  pickLineUnits,
  pickShareChoice,
  publishedSelectionIds,
  readShownLightningInvoice,
  receiveBankTransfer,
  receiveLightningPayment,
  receiveShownBankTransfer,
  routeFakeNostrRelays,
  seedActiveFioPlugin,
  seedPizzaAndBeerBill,
  shareLine,
} from "./support/self-pay.ts"

const guestText = (key: Parameters<typeof translate>[1], amount: string) =>
  translate("en", key).replace("{amount}", amount)

const paidForRows = (guest: Page) =>
  guest
    .getByRole("region", { name: translate("en", "selfPay.paidFor.title") })
    .getByRole("listitem")

const openPosBillSummary = async (page: Page, billId: string) => {
  await page.goto(`/bill?billId=${billId}`)
  await page.getByTestId("bill-summary-trigger").click()
  return page.getByTestId("bill-summary-panel")
}

const posLinePartlyPaid = (paid: string, remaining: string) =>
  translateParams("en", "bill.summary.selfPay.partlyPaid", { paid, remaining })

const posBillAmount = (summary: Locator, label: TranslationKey) =>
  summary
    .getByText(translate("en", label), { exact: true })
    .locator("..")
    .getByRole("definition")

test("guests pay a fifth of a line at the table while nobody reserves anything", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  const relays = await routeFakeNostrRelays(context)
  let guestAddress = ""
  let billId: string | null = null

  await test.step("seed a table with self-pay switched on and a pizza", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 7", seatCount: "4" })
    await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
    guestAddress = await enableTableSelfPay(page, "en", "Table 7")
    await page.screenshot({
      path: `${screenshotDir}/table-self-pay-settings.png`,
      fullPage: true,
    })
  })

  await test.step("open a bill on the table with one pizza", async () => {
    billId = await openTableBill(page, "en", {
      table: "Table 7",
      items: ["Pizza"],
    })
  })

  await test.step("a guest opens a payment for the whole remainder and walks away", async () => {
    const guest = await context.newPage()
    await guest.goto(guestAddress)
    await guest.getByRole("heading", { name: "Table 7" }).waitFor()
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$101.00") })
      .click()
    await expect(
      guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toBeVisible()
    await guest.close()
  })

  let variableSymbol = ""
  let recipientMessage = ""
  const payer = await context.newPage()

  await test.step("another guest still sees the full remainder and pays a fifth of the pizza", async () => {
    await payer.goto(guestAddress)
    await payer.getByRole("heading", { name: "Table 7" }).waitFor()
    await expect(
      payer.getByRole("button", {
        name: guestText("selfPay.pay.total", "$101.00"),
      })
    ).toBeVisible()
    await pickShareChoice(payer, "selfPay.choice.items")
    await pickLineUnits(payer, { line: "Pizza", units: 1 })
    await shareLine(payer, { line: "Pizza", people: 5 })
    const selectionsBefore = publishedSelectionIds(relays).size
    await payer
      .getByRole("button", { name: guestText("selfPay.pay.total", "$20.20") })
      .click()
    await payer.screenshot({
      path: `${screenshotDir}/table-self-pay-guest-bank.png`,
      fullPage: true,
    })
    await payer
      .getByRole("button", {
        name: translate("en", "selfPay.bank.format.showPayBySquare"),
      })
      .click()
    await expect(
      payer.getByRole("button", {
        name: translate("en", "selfPay.bank.format.showSpayd"),
      })
    ).toBeVisible()
    await expect(
      payer.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toBeVisible()
    variableSymbol =
      (await payer
        .getByText(translate("en", "selfPay.bank.variableSymbol"), {
          exact: true,
        })
        .locator("xpath=following-sibling::*[1]")
        .textContent()) ?? ""
    recipientMessage =
      (await payer
        .getByText(translate("en", "selfPay.bank.message"), { exact: true })
        .locator("xpath=following-sibling::*[1]")
        .textContent()) ?? ""
    expect(variableSymbol).toMatch(/^\d{10}$/u)
    expect(recipientMessage).toMatch(/^PK1[A-Z2-7]{32}$/u)
    expect(publishedSelectionIds(relays).size).toBe(selectionsBefore + 1)
  })

  await test.step("the fifth arrives and the terminal shows it paid, with the bill still editable", async () => {
    await receiveBankTransfer(page, {
      amount: 2020,
      currency: "USD",
      variableSymbol,
      recipientMessage,
    })
    await page.goto(`/activity/bills/${billId}`)
    await expect(
      page.getByText(
        translate("en", "billDetail.selfPay.linePaid")
          .replace("{paid}", "$20.20")
          .replace("{total}", "$101.00")
      )
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByText(translate("en", "billDetail.selfPay"), { exact: true })
    ).toBeVisible()
    await page.screenshot({
      path: `${screenshotDir}/table-self-pay-bill-detail.png`,
      fullPage: true,
    })
    await page.goto(`/bill?billId=${billId}`)
    await page
      .getByRole("button", { name: nameParam("bill.brick.add.aria", "Pizza") })
      .click()
    await expect(page.getByTestId("bill-summary-trigger")).toContainText(
      "$181.80"
    )
    await page.getByTestId("bill-summary-trigger").click()
    await expect(
      page
        .getByTestId("bill-summary-panel")
        .getByText(posLinePartlyPaid("$20.20", "$181.80"))
    ).toBeVisible()
  })

  await test.step("the payer's page shows the payment confirmed by the restaurant", async () => {
    await payer.bringToFront()
    await expect(
      payer
        .getByRole("main")
        .getByText(guestText("selfPay.confirmation.mine", "$20.20"))
    ).toBeVisible({ timeout: 45_000 })
    await payer.screenshot({
      path: `${screenshotDir}/table-self-pay-guest-confirmed.png`,
      fullPage: true,
    })
  })
})

test("two guests split a bill in halves and the till sees every line paid", async ({
  seededPage: page,
  context,
  browser,
}) => {
  test.setTimeout(180_000)
  const relay = await routeFakeNostrRelays(context)
  const linePaid = (paid: string, total: string) =>
    page.getByText(
      translate("en", "billDetail.selfPay.linePaid")
        .replace("{paid}", paid)
        .replace("{total}", total)
    )

  const { guestAddress, billId } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 8"))

  await test.step("the first guest pays half of the whole bill", async () => {
    const guest = await context.newPage()
    await guest.goto(guestAddress)
    await guest.getByRole("heading", { name: "Table 8" }).waitFor()
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$146.00") })
      .waitFor()
    await pickEqualShares(guest, 2)
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$73.00") })
      .click()
    await expect(paidForRows(guest)).toHaveText([
      `${translateParams("en", "selfPay.paidFor.equal", { people: "2" })}$73.00`,
    ])
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 7300,
      currency: "USD",
    })
    await page.goto(`/activity/bills/${billId}`)
    await expect(linePaid("$50.50", "$101.00")).toBeVisible({
      timeout: 30_000,
    })
    await expect(linePaid("$22.50", "$45.00")).toBeVisible()
    const summary = await openPosBillSummary(page, billId)
    await expect(
      summary.getByText(posLinePartlyPaid("$50.50", "$50.50"))
    ).toBeVisible()
    await expect(
      summary.getByText(posLinePartlyPaid("$22.50", "$22.50"))
    ).toBeVisible()
    await guest.close()
  })

  await test.step("the second guest picks what is left of both lines and pays the other half", async () => {
    await using secondPhone = await newGuestContext(browser, relay)
    const guest = await secondPhone.newPage()
    await guest.goto(guestAddress)
    await guest.getByRole("heading", { name: "Table 8" }).waitFor()
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$73.00") })
      .waitFor({ timeout: 45_000 })
    await pickShareChoice(guest, "selfPay.choice.items")
    for (const name of ["Pizza", "Beer"]) {
      await pickLineUnits(guest, { line: name, units: 1 })
    }
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$73.00") })
      .click()
    await expect(paidForRows(guest)).toHaveText(["Pizza$50.50", "Beer$22.50"])
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 7300,
      currency: "USD",
    })
    await page.goto(`/activity/bills/${billId}`)
    await expect(linePaid("$101.00", "$101.00")).toBeVisible({
      timeout: 30_000,
    })
    await expect(linePaid("$45.00", "$45.00")).toBeVisible()
  })

  await test.step("each guest page sent the relays only its own selection", async () => {
    expect(publishedSelectionIds(relay).size).toBe(2)
    expect(new Set(relay.received().map(({ pubkey }) => pubkey)).size).toBe(3)
  })
})

test("a guest sees what each choice and tip costs before paying", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 9"))
  const guest = await context.newPage()
  const payTotal = (amount: string) =>
    guest.getByRole("button", { name: guestText("selfPay.pay.total", amount) })

  await test.step("everything left is picked when the page opens", async () => {
    await guest.goto(guestAddress)
    await expect(payTotal("$146.00")).toBeEnabled({ timeout: 45_000 })
    await expect(
      guest.getByRole("button", {
        name: translate("en", "selfPay.choice.remainder"),
      })
    ).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("by items adds what each picked line costs", async () => {
    await pickShareChoice(guest, "selfPay.choice.items")
    await expect(payTotal("$146.00")).toBeHidden()
    await pickLineUnits(guest, { line: "Beer", units: 1 })
    await expect(payTotal("$45.00")).toBeEnabled()
    await pickLineUnits(guest, { line: "Pizza", units: 1 })
    await shareLine(guest, { line: "Pizza", people: 2 })
    await expect(payTotal("$95.50")).toBeEnabled()
    await expect(
      guest.getByRole("button", {
        name: nameParam("selfPay.line.unshare.label", "Pizza"),
      })
    ).toBeVisible()
    await guest.mouse.move(0, 0)
    await guest.screenshot({
      path: `${screenshotDir}/table-self-pay-guest-items.png`,
      fullPage: true,
      animations: "disabled",
    })
  })

  await test.step("equal shares say they are a fraction of the whole bill", async () => {
    await pickEqualShares(guest, 2)
    await expect(payTotal("$73.00")).toBeEnabled()
    await expect(
      guest.getByText(
        translateParams("en", "selfPay.choice.equal.hint", {
          people: "2",
          total: "$146.00",
        })
      )
    ).toBeVisible()
  })

  await test.step("a percent tip and a custom tip show what they add", async () => {
    await guest
      .getByRole("button", {
        name: `${translateParams("en", "selfPay.tip.percent", { percent: "10" })} $7.30`,
      })
      .click()
    await expect(payTotal("$80.30")).toBeEnabled()
    await guest
      .getByRole("button", { name: translate("en", "selfPay.tip.custom") })
      .click()
    const customTip = guest.getByRole("textbox", {
      name: translate("en", "selfPay.tip.custom.label"),
    })
    const currencyUnit = guest.getByRole("button", { name: "$", exact: true })
    const percentUnit = guest.getByRole("button", { name: "%", exact: true })
    await expect(currencyUnit).toHaveAttribute("aria-pressed", "true")
    const unitBox = await percentUnit.boundingBox()
    const fieldBox = await customTip.boundingBox()
    expect(unitBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(
      fieldBox?.x ?? 0
    )
    await customTip.fill("5")
    await expect(payTotal("$78.00")).toBeEnabled()
    await percentUnit.click()
    await expect(payTotal("$76.65")).toBeEnabled()
    await currencyUnit.click()
    await expect(payTotal("$78.00")).toBeEnabled()
  })

  await test.step("an amount above what is left asks for what is left", async () => {
    await guest
      .getByRole("button", { name: translate("en", "selfPay.choice.amount") })
      .click()
    await guest
      .getByRole("textbox", {
        name: translate("en", "selfPay.choice.amount.label"),
      })
      .fill("200")
    await expect(payTotal("$151.00")).toBeEnabled()
    await expect(
      guest
        .getByRole("main")
        .getByText(guestText("selfPay.pay.capped", "$146.00"))
    ).toBeVisible()
    await guest.screenshot({
      path: `${screenshotDir}/table-self-pay-guest-choices.png`,
      fullPage: true,
    })
  })
})

test("a guest switches the table page to Czech without losing the share they picked", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 9"))
  const guest = await context.newPage()
  const czechChoiceTitle = guest.getByRole("heading", {
    name: translate("cs", "selfPay.choice.title"),
  })

  await test.step("a guest on an English page picks equal shares", async () => {
    await guest.goto(guestAddress)
    await expect(
      guest.getByRole("button", {
        name: guestText("selfPay.pay.total", "$146.00"),
      })
    ).toBeEnabled({ timeout: 45_000 })
    await pickEqualShares(guest, 2)
    await expect(
      guest.getByRole("button", {
        name: guestText("selfPay.pay.total", "$73.00"),
      })
    ).toBeEnabled()
  })

  await test.step("Čeština turns the page Czech and keeps equal shares picked", async () => {
    await guest
      .getByRole("combobox", {
        name: translate("en", "selfPay.language.label"),
      })
      .click()
    await guest.getByRole("option", { name: "Čeština" }).click()
    await expect(czechChoiceTitle).toBeVisible()
    await expect(
      guest.getByRole("button", {
        name: translate("cs", "selfPay.choice.equal"),
      })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(
      guest.getByRole("button", {
        name: translateParams("cs", "selfPay.pay.total", {
          amount: new Intl.NumberFormat("cs", {
            style: "currency",
            currency: "USD",
          }).format(73),
        }),
      })
    ).toBeEnabled()
    await expect(guest.locator("html")).toHaveAttribute("lang", "cs")
  })

  await test.step("the page opens in Czech again after a reload", async () => {
    await guest.reload()
    await expect(czechChoiceTitle).toBeVisible({ timeout: 45_000 })
  })
})

test("the table page turns dark when the phone does, and the language picker stays plain", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 9"))
  const guest = await context.newPage()
  const languagePicker = guest.getByRole("combobox", {
    name: translate("en", "selfPay.language.label"),
  })

  await test.step("a guest opens the page on a light phone", async () => {
    await guest.emulateMedia({ colorScheme: "light" })
    await guest.goto(guestAddress)
    await expect(
      guest.getByRole("button", {
        name: guestText("selfPay.pay.total", "$146.00"),
      })
    ).toBeEnabled({ timeout: 45_000 })
    await expect(guest.locator("html")).not.toHaveClass(/\bdark\b/u)
  })

  await test.step("the phone turns dark and the page follows without a reload", async () => {
    await guest.emulateMedia({ colorScheme: "dark" })
    await expect(guest.locator("html")).toHaveClass(/\bdark\b/u)
    await expect(languagePicker).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    )
  })
})

test("a guest who changes what they pay finds the share and tip they picked", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 9"))
  const guest = await context.newPage()
  const payTotal = (amount: string) =>
    guest.getByRole("button", {
      name: guestText("selfPay.pay.total", amount),
    })

  await test.step("the guest picks equal shares and a 10 % tip, then pays", async () => {
    await guest.goto(guestAddress)
    await expect(payTotal("$146.00")).toBeEnabled({ timeout: 45_000 })
    await pickEqualShares(guest, 2)
    await guest
      .getByRole("button", {
        name: `${translateParams("en", "selfPay.tip.percent", { percent: "10" })} $7.30`,
      })
      .click()
    await payTotal("$80.30").click()
    await expect(
      guest.getByRole("button", { name: translate("en", "selfPay.back") })
    ).toBeVisible()
    await expect(paidForRows(guest)).toHaveText([
      `${translateParams("en", "selfPay.paidFor.equal", { people: "2" })}$73.00`,
      `${translate("en", "selfPay.tip.label")}$7.30`,
    ])
    await expect(
      guest.getByText(translate("en", "selfPay.bill.remainder"))
    ).toBeHidden()
  })

  await test.step("changing what they pay shows the equal share and the tip again", async () => {
    await guest
      .getByRole("button", { name: translate("en", "selfPay.back") })
      .click()
    await expect(
      guest.getByRole("button", {
        name: translate("en", "selfPay.choice.equal"),
      })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(payTotal("$80.30")).toBeEnabled()
    await expect(
      guest.getByText(translate("en", "selfPay.bill.remainder"))
    ).toBeVisible()
  })
})

test("a guest whose selection no relay takes is told the restaurant will not see the items, and can still pay", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  const relays = await routeFakeNostrRelays(context)
  const { guestAddress } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 11"))

  await test.step("every relay refuses the selection, and the page still shows how to pay", async () => {
    const guest = await context.newPage()
    await guest.goto(guestAddress)
    await guest.getByRole("heading", { name: "Table 11" }).waitFor()
    for (const url of defaultSelfPayRelays) relays.refuse(url, true)
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$146.00") })
      .click()
    await expect(
      guest.getByText(translate("en", "selfPay.pay.unseen"))
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toBeVisible()
    await guest.close()
  })
})

test("a guest pays the beer in full and the till shows it paid beside the open pizza", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress, billId } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 10"))

  await test.step("a guest pays all of the beer", async () => {
    const guest = await context.newPage()
    await guest.goto(guestAddress)
    await guest.getByRole("heading", { name: "Table 10" }).waitFor()
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$146.00") })
      .waitFor()
    await payAllOfTheBeer(page, guest)
    await guest.close()
  })

  await test.step("the till shows the beer paid by guests and nothing paid of the pizza", async () => {
    const summary = await openPosBillSummary(page, billId)
    await expect(
      summary.getByText(translate("en", "bill.summary.selfPay.paid"), {
        exact: true,
      })
    ).toBeVisible({ timeout: 30_000 })
    await expect(summary.getByTestId("bill-summary-self-pay")).toHaveCount(1)
  })
})

test("the till charges only what guests have not paid, lines or no lines", async ({
  seededPage: page,
  context,
  browser,
}) => {
  test.setTimeout(120_000)
  const relays = await routeFakeNostrRelays(context)
  const { guestAddress, billId } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 11"))

  await test.step("a guest pays the beer and another one's transfer names no lines", async () => {
    const guest = await context.newPage()
    await guest.goto(guestAddress)
    await payAllOfTheBeer(page, guest)
    await guest.close()

    await using cutPhone = await newGuestContext(browser, relays)
    const cutGuest = await cutPhone.newPage()
    await cutGuest.goto(guestAddress)
    await cutGuest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$101.00") })
      .click()
    await receiveShownBankTransfer(page, {
      payer: cutGuest,
      language: "en",
      amount: 2000,
      currency: "USD",
      recipientMessage: "Dinner",
    })
    await cutGuest.close()
  })

  await test.step("the till shows both payments and charges the rest", async () => {
    const summary = await openPosBillSummary(page, billId)
    await expect(posBillAmount(summary, "bill.summary.alreadyPaid")).toHaveText(
      "$65.00",
      { timeout: 30_000 }
    )
    await expect(posBillAmount(summary, "bill.summary.leftToPay")).toHaveText(
      "$81.00"
    )
    await page
      .getByRole("button", { name: translate("en", "home.pay"), exact: true })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentTip.title") })
      .waitFor()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("$81.00")
  })
})

test("a table whose guest paid the beer reads partly paid, then free once staff remove the pizza", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const { guestAddress, billId } =
    await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
      seedPizzaAndBeerBill(page, "Table 12"))
  const tableTile = page
    .getByTestId("table-tile")
    .filter({ hasText: "Table 12" })

  await test.step("a guest pays all of the beer and the table reads partly paid", async () => {
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

  await test.step("staff remove the pizza the guest left", async () => {
    await page.goto(`/bill?billId=${billId}`)
    await page
      .getByRole("button", {
        name: nameParam("bill.brick.remove.aria", "Pizza"),
      })
      .click()
    const question = page.getByRole("alertdialog")
    await expect(question).toContainText(
      translate("en", "bill.cover.paid.title")
    )
    await question
      .getByRole("button", { name: translate("en", "bill.cover.confirm") })
      .click()
    await waitForLocalWriteToSettle(page)
  })

  await test.step("the table is free and the bill reads closed", async () => {
    await gotoPosOverview(page, "en")
    await expect(tableTile).toContainText(translate("en", "tables.tile.free"))
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByText(translate("en", "bill.status.closed"), { exact: true })
    ).toBeVisible()
  })
})

test("a guest keeps the bill they picked when an earlier bill of the table closes", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  let guestAddress = ""
  let firstBillId = ""
  const guest = await context.newPage()
  const billTab = (number: number) =>
    guest.getByRole("tab", {
      name: translate("en", "selfPay.bill.number").replace(
        "{number}",
        String(number)
      ),
    })
  const payTotal = (amount: string) =>
    guest.getByRole("button", {
      name: guestText("selfPay.pay.total", amount),
    })

  await test.step("open three bills on one self-pay table", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 9", seatCount: "6" })
    for (const [name, price] of [
      ["Pizza", "101"],
      ["Beer", "45"],
      ["Soup", "30"],
    ] as const) {
      await addCatalogItem(page, "en", { name, price })
    }
    guestAddress = await enableTableSelfPay(page, "en", "Table 9")
    firstBillId = await openTableBill(page, "en", {
      table: "Table 9",
      items: ["Pizza"],
    })
    for (const item of ["Beer", "Soup"]) {
      await openTableBill(page, "en", { table: "Table 9", items: [item] })
    }
  })

  await test.step("a guest picks the second bill", async () => {
    await guest.goto(guestAddress)
    await guest.getByRole("heading", { name: "Table 9" }).waitFor()
    await billTab(3).waitFor({ timeout: 45_000 })
    await billTab(2).click()
    await expect(payTotal("$45.00")).toBeVisible()
  })

  await test.step("the first bill closes and the guest still sees the beer", async () => {
    await cancelBillDirectly(page, firstBillId)
    await expect(billTab(3)).toBeHidden({ timeout: 45_000 })
    await expect(payTotal("$45.00")).toBeVisible()
  })
})

test("a guest who scans a damaged QR code is told to pay with the staff", async ({
  page,
}) => {
  await page.goto("/t#1.damaged")

  await expect(
    page.getByRole("heading", {
      name: translate("en", "selfPay.invalid.title"),
    })
  ).toBeVisible()
})

test("a guest pays at least five cents, or everything left on the bill", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guest = await context.newPage()
  const payTotal = (amount: string) =>
    guest.getByRole("button", {
      name: guestText("selfPay.pay.total", amount),
    })
  let billId = ""

  await test.step("a bill of four cents can be paid whole", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 11", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Mint", price: "0.04" })
    await guest.goto(await enableTableSelfPay(page, "en", "Table 11"))
    billId = await openTableBill(page, "en", {
      table: "Table 11",
      items: ["Mint"],
    })
    await expect(payTotal("$0.04")).toBeEnabled({ timeout: 45_000 })
  })

  await test.step("the mint alone cannot be paid once the bill holds a water too", async () => {
    await addBillLines(page, billId, [{ name: "Water", amount: 200 }])
    await expect(payTotal("$2.04")).toBeVisible({ timeout: 45_000 })
    await pickShareChoice(guest, "selfPay.choice.items")
    await pickLineUnits(guest, { line: "Mint", units: 1 })
    await expect(payTotal("$0.04")).toBeDisabled()
    await expect(
      guest
        .getByRole("main")
        .getByText(guestText("selfPay.pay.belowMinimum", "$0.05"))
    ).toBeVisible()
  })

  await test.step("an amount that would leave three cents pays them too", async () => {
    await guest
      .getByRole("button", { name: translate("en", "selfPay.choice.amount") })
      .click()
    await guest
      .getByRole("textbox", {
        name: translate("en", "selfPay.choice.amount.label"),
      })
      .fill("2.01")
    await expect(payTotal("$2.04")).toBeEnabled()
    await expect(
      guest
        .getByRole("main")
        .getByText(guestText("selfPay.pay.restAdded", "$0.03"))
    ).toBeVisible()
  })
})

test("a guest copies the amount to pay, or is told to hold the text when copying fails", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  let guestAddress = ""
  const copyAmount = (guest: Page) =>
    guest.getByRole("button", {
      name: translateParams("en", "selfPay.bank.copy", {
        field: translate("en", "selfPay.bank.amount"),
      }),
    })
  const openBankPayment = async (guest: Page) => {
    await guest.goto(guestAddress)
    const payTotal = guest.getByRole("button", {
      name: guestText("selfPay.pay.total", "$12.00"),
    })
    await expect(payTotal).toBeVisible({ timeout: 45_000 })
    await payTotal.click()
    await expect(copyAmount(guest)).toBeVisible()
  }

  await test.step("a guest opens a bill with a $12.00 salad", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 12", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Salad", price: "12" })
    guestAddress = await enableTableSelfPay(page, "en", "Table 12")
    await openTableBill(page, "en", { table: "Table 12", items: ["Salad"] })
  })

  await test.step("the amount lands on the clipboard", async () => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    const guest = await context.newPage()
    await openBankPayment(guest)
    await copyAmount(guest).click()
    await expect
      .poll(() => guest.evaluate(() => navigator.clipboard.readText()))
      .toBe("12.00")
  })

  await test.step("a refused copy tells the guest to hold the text", async () => {
    const guest = await context.newPage()
    await guest.addInitScript(() => {
      document.execCommand = () => false
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.reject(new Error("NotAllowedError")),
        },
      })
    })
    await openBankPayment(guest)
    await copyAmount(guest).click()
    await expect(
      guest.getByRole("main").getByText(translate("en", "selfPay.copy.failed"))
    ).toBeVisible()
  })

  await test.step("on a Czech page the amount copies with a decimal comma, and the IBAN copies without its spaces", async () => {
    const guest = await context.newPage()
    const copyField = (key: TranslationKey) =>
      guest.getByRole("button", {
        name: translateParams("cs", "selfPay.bank.copy", {
          field: translate("cs", key),
        }),
      })
    const clipboard = () => guest.evaluate(() => navigator.clipboard.readText())
    await openBankPayment(guest)
    await guest
      .getByRole("combobox", {
        name: translate("en", "selfPay.language.label"),
      })
      .click()
    await guest.getByRole("option", { name: "Čeština" }).click()
    await copyField("selfPay.bank.amount").click()
    await expect.poll(clipboard).toBe("12,00")
    await expect(
      guest.getByText("CZ65 0800 0000 1920 0014 5399", { exact: true })
    ).toBeVisible()
    await copyField("selfPay.bank.iban").click()
    await expect.poll(clipboard).toBe("CZ6508000000192000145399")
  })
})

test("a guest sees an empty table, then its bill, then pay-with-staff once self-pay is off", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guest = await context.newPage()
  const heading = (key: Parameters<typeof translate>[1]) =>
    guest.getByRole("heading", { name: translate("en", key) })

  await test.step("an empty self-pay table has nothing to pay", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 10", seatCount: "2" })
    await addCatalogItem(page, "en", { name: "Soup", price: "30" })
    await guest.goto(await enableTableSelfPay(page, "en", "Table 10"))
    await expect(heading("selfPay.empty.title")).toBeVisible({
      timeout: 45_000,
    })
    await expect(
      guest.getByText(translate("en", "selfPay.footer"))
    ).toBeHidden()
  })

  await test.step("the bill appears once staff opens it", async () => {
    await openTableBill(page, "en", { table: "Table 10", items: ["Soup"] })
    await expect(
      guest.getByRole("button", {
        name: guestText("selfPay.pay.total", "$30.00"),
      })
    ).toBeVisible({ timeout: 45_000 })
  })

  await test.step("switching self-pay off sends the guest to the staff", async () => {
    await disableTableSelfPay(page, "en", "Table 10")
    await expect(heading("selfPay.disabled.title")).toBeVisible({
      timeout: 45_000,
    })
    await expect(
      guest.getByText(translate("en", "selfPay.footer"))
    ).toBeHidden()
    await guest.screenshot({
      path: `${screenshotDir}/table-self-pay-guest-disabled.png`,
      fullPage: true,
    })
  })
})

test.describe("a guest paying at the table", () => {
  const payTotal = (guest: Page, amount: string) =>
    guest.getByRole("button", {
      name: guestText("selfPay.pay.total", amount),
    })
  const anyPayButton = (guest: Page) =>
    guest.getByRole("button", { name: /^Pay \$/u })
  const guestButton = (guest: Page, key: TranslationKey) =>
    guest.getByRole("button", { name: translate("en", key) })
  const tenPercentTip = (guest: Page) =>
    guest.getByRole("button", {
      name: translateParams("en", "selfPay.tip.percent", { percent: "10" }),
    })
  const anotherAmount = (guest: Page) =>
    guest.getByRole("textbox", {
      name: translate("en", "selfPay.choice.amount.label"),
    })
  const customTipField = (guest: Page) =>
    guest.getByRole("textbox", {
      name: translate("en", "selfPay.tip.custom.label"),
    })
  const openGuestPage = async (guest: Page, address: string, total: string) => {
    await guest.goto(address)
    await expect(payTotal(guest, total)).toBeEnabled({ timeout: 45_000 })
  }
  const minHeight = async (locator: Locator) => {
    const boxes = await Promise.all(
      (await locator.all()).map((item) => item.boundingBox())
    )
    return Math.min(...boxes.map((box) => box?.height ?? 0))
  }

  test("a guest whose payment is confirmed is done and pays nothing more unless they ask", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 21"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const done = guestText("selfPay.confirmation.mine", "$73.00")

    await test.step("the guest pays half of the bill and the money arrives", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await pickEqualShares(guest, 2)
      await payTotal(guest, "$73.00").click()
      await receiveShownBankTransfer(page, {
        payer: guest,
        language: "en",
        amount: 7300,
        currency: "USD",
      })
    })

    await test.step("the confirmation leads with focus and nothing asks for the rest", async () => {
      await expect(guest.locator(":focus")).toContainText(done, {
        timeout: 45_000,
      })
      await expect(guest.getByRole("status")).toHaveText(done)
      await expect(anyPayButton(guest)).toHaveCount(0)
      await expect(guestButton(guest, "selfPay.choice.remainder")).toBeHidden()
    })

    await test.step("paying something else opens the choices with nothing picked", async () => {
      await guestButton(guest, "selfPay.payMore").click()
      for (const choice of [
        "selfPay.choice.remainder",
        "selfPay.choice.equal",
        "selfPay.choice.items",
      ] as const) {
        await expect(guestButton(guest, choice)).toHaveAttribute(
          "aria-pressed",
          "false"
        )
      }
      await expect(anyPayButton(guest)).toHaveCount(0)
    })
  })

  test("a guest who pays again is done only with the new payment, and the first reads as paid at its time", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 35"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const main = guest.getByRole("main")
    const firstDone = guestText("selfPay.confirmation.mine", "$73.00")
    const firstPaid = translateParams("en", "selfPay.confirmation.mine.past", {
      amount: "$73.00",
      time: "",
    }).trim()

    await test.step("the guest pays half of the bill and is done with it", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await pickEqualShares(guest, 2)
      await payTotal(guest, "$73.00").click()
      await receiveShownBankTransfer(page, {
        payer: guest,
        language: "en",
        amount: 7300,
        currency: "USD",
      })
      await expect(main.getByText(firstDone)).toBeVisible({ timeout: 45_000 })
    })

    await test.step("paying more no longer says done and names the first payment's time", async () => {
      await guestButton(guest, "selfPay.payMore").click()
      await expect(main.getByText(firstDone)).toHaveCount(0)
      await expect(main.getByText(firstPaid)).toBeVisible()
    })

    await test.step("the second payment is the one that says done", async () => {
      await pickEqualShares(guest, 4)
      await payTotal(guest, "$36.50").click()
      await receiveShownBankTransfer(page, {
        payer: guest,
        language: "en",
        amount: 3650,
        currency: "USD",
      })
      const secondDone = guestText("selfPay.confirmation.mine", "$36.50")
      await expect(guest.locator(":focus")).toContainText(secondDone, {
        timeout: 45_000,
      })
      await expect(main.getByText(secondDone)).toHaveCount(1)
      await expect(main.getByText(firstDone)).toHaveCount(0)
      await expect(main.getByText(firstPaid)).toBeVisible()
    })
  })

  test("a guest paying is told what is left once another guest paid meanwhile", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 32"))
    await using firstPhone = await newGuestContext(browser, relays)
    await using secondPhone = await newGuestContext(browser, relays)
    const payer = await firstPhone.newPage()
    const guest = await secondPhone.newPage()
    const changed = guestText("selfPay.billChanged.title", "$73.00")
    const goBack = translate("en", "selfPay.billChanged.description")

    await test.step("a guest opens the payment for the whole bill", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
      await expect(
        guest.getByRole("heading", { name: "$146.00" })
      ).toBeFocused()
    })

    await test.step("another guest pays half, which the payer is not warned about", async () => {
      await openGuestPage(payer, guestAddress, "$146.00")
      await pickEqualShares(payer, 2)
      await payTotal(payer, "$73.00").click()
      await receiveShownBankTransfer(page, {
        payer,
        language: "en",
        amount: 7300,
        currency: "USD",
      })
      await expect(
        payer
          .getByRole("main")
          .getByText(guestText("selfPay.confirmation.mine", "$73.00"))
      ).toBeVisible({ timeout: 45_000 })
      await expect(payer.getByText(changed)).toHaveCount(0)
    })

    await test.step("the guest still paying is told what is left and to go back", async () => {
      await expect(guest.getByRole("main").getByText(changed)).toBeVisible({
        timeout: 45_000,
      })
      await expect(guest.getByRole("main").getByText(goBack)).toBeVisible()
      await expect(guest.getByRole("status")).toHaveText(
        translateParams("en", "selfPay.billChanged.announcement", {
          title: changed,
          description: goBack,
        })
      )
      await expect(
        guest.getByRole("heading", { name: "$146.00" })
      ).toBeVisible()
    })
  })

  test("a guest paying is told nothing is left once staff remove every line meanwhile", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress, billId } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 33"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const removeLine = async (name: string) => {
      await page
        .getByRole("button", {
          name: nameParam("bill.brick.remove.aria", name),
        })
        .click()
      await waitForLocalWriteToSettle(page)
    }

    await test.step("the guest opens the payment for the whole bill", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
    })

    await test.step("staff remove the beer, and the guest is told what is left", async () => {
      await page.goto(`/bill?billId=${billId}`)
      await removeLine("Beer")
      await expect(
        guest
          .getByRole("main")
          .getByText(guestText("selfPay.billChanged.title", "$101.00"))
      ).toBeVisible({ timeout: 45_000 })
    })

    await test.step("staff remove the pizza too, and the guest is told not to send money", async () => {
      await removeLine("Pizza")
      await expect(
        guest
          .getByRole("main")
          .getByText(translate("en", "selfPay.billChanged.nothingLeft.title"))
      ).toBeVisible({ timeout: 45_000 })
      await expect(
        guest
          .getByRole("main")
          .getByText(
            translate("en", "selfPay.billChanged.nothingLeft.description")
          )
      ).toBeVisible()
    })
  })

  test("a guest paying keeps the amount and variable symbol and is told nothing is left once staff close the bill", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress, billId } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 34"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const variableSymbol = guest
      .getByText(translate("en", "selfPay.bank.variableSymbol"), {
        exact: true,
      })
      .locator("xpath=following-sibling::*[1]")
    const nothingLeft = translate("en", "selfPay.billChanged.nothingLeft.title")
    const doNotSend = translate(
      "en",
      "selfPay.billChanged.nothingLeft.description"
    )
    let shownSymbol = ""

    await test.step("the guest opens the bank payment for the whole bill", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
      shownSymbol = (await variableSymbol.textContent()) ?? ""
      expect(shownSymbol).toMatch(/^\d{10}$/u)
    })

    await test.step("staff close the bill, and the payment stays and says nothing is left", async () => {
      await cancelBillDirectly(page, billId)
      await expect(guest.getByRole("main").getByText(nothingLeft)).toBeVisible({
        timeout: 45_000,
      })
      await expect(guest.getByRole("status")).toHaveText(
        translateParams("en", "selfPay.billChanged.announcement", {
          title: nothingLeft,
          description: doNotSend,
        })
      )
      await expect(
        guest.getByRole("heading", { name: "$146.00" })
      ).toBeVisible()
      await expect(variableSymbol).toHaveText(shownSymbol)
      await expect(
        guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
      ).toBeVisible()
      await expect(
        guest.getByRole("heading", {
          name: translate("en", "selfPay.empty.title"),
        })
      ).toHaveCount(0)
    })
  })

  test("a guest who presses Back on the bank screen keeps the share and tip, and a new tab knows the payment", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 22"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()

    await test.step("the guest picks equal shares and a 10 % tip and opens the bank transfer", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await pickEqualShares(guest, 2)
      await tenPercentTip(guest).click()
      await payTotal(guest, "$80.30").click()
      await expect(
        guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
      ).toBeVisible()
    })

    await test.step("phone Back returns to the share and tip on the table page", async () => {
      await guest.goBack()
      await expect(guestButton(guest, "selfPay.choice.equal")).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      await expect(tenPercentTip(guest)).toHaveAttribute("aria-pressed", "true")
      await expect(payTotal(guest, "$80.30")).toBeEnabled()
      expect(guest.url()).toBe(guestAddress)
    })

    await test.step("the guest pays and a new tab of the same browser shows the payment as theirs", async () => {
      await payTotal(guest, "$80.30").click()
      await receiveShownBankTransfer(page, {
        payer: guest,
        language: "en",
        amount: 8030,
        currency: "USD",
      })
      const rescan = await phone.newPage()
      await rescan.goto(guestAddress)
      await expect(
        rescan
          .getByRole("main")
          .getByText(guestText("selfPay.confirmation.mine", "$80.30"))
      ).toBeVisible({ timeout: 45_000 })
    })
  })

  test("a guest waiting for a transfer is told how it is confirmed and is sent to the staff after ten minutes", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 23"))
    await using phone = await newGuestContext(browser, relays)
    await phone.clock.install()
    const guest = await phone.newPage()
    const waitingIndicator = guest.getByTestId("self-pay-waiting-indicator")

    await test.step("the instructions say from the start, under the amount, that the restaurant confirms the money, and what it pays for follows the QR", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
      await expect(guest.getByRole("status")).toHaveText(
        translate("en", "selfPay.waiting")
      )
      await expect(waitingIndicator).toBeVisible()
      const top = async (locator: Locator) =>
        (await locator.boundingBox())?.y ?? Number.NaN
      expect(
        await top(
          guest.getByRole("main").getByText(translate("en", "selfPay.waiting"))
        )
      ).toBeLessThan(
        await top(
          guest.getByRole("region", {
            name: translate("en", "selfPay.paidFor.title"),
          })
        )
      )
      expect(
        await top(
          guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
        )
      ).toBeLessThan(
        await top(
          guest.getByRole("region", {
            name: translate("en", "selfPay.paidFor.title"),
          })
        )
      )
    })

    await test.step("ten minutes without a confirmation stop the indicator and send the guest to the staff", async () => {
      await phone.clock.fastForward("10:01")
      await expect(
        guest
          .getByRole("main")
          .getByText(translate("en", "selfPay.waiting.over.title"))
      ).toBeVisible()
      await expect(
        guest
          .getByRole("main")
          .getByText(translate("en", "selfPay.waiting.over.description"))
      ).toBeVisible()
      await expect(waitingIndicator).toHaveCount(0)
      await expect(guest.getByRole("status")).toContainText(
        translate("en", "selfPay.waiting.over.description")
      )
    })
  })

  test("a guest whose Lightning invoice expired is told so and can start again", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    await fakeSelfPayLightning(context, 100_000)
    let guestAddress = ""

    await test.step("seed a Lightning account and a table with a pizza", async () => {
      await seedOnboarding(page, "en", { spark: true })
      await addTable(page, "en", { name: "Table 24", seatCount: "2" })
      await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 24")
      await openTableBill(page, "en", { table: "Table 24", items: ["Pizza"] })
    })

    await using phone = await newGuestContext(browser, relays)
    await fakeSelfPayLightning(phone, 100_000)
    await phone.clock.install()
    const guest = await phone.newPage()

    const lightningQr = guest.getByRole("img", {
      name: translate("en", "selfPay.lightning.qr"),
    })

    await test.step("the guest is shown a Lightning invoice", async () => {
      await openGuestPage(guest, guestAddress, "$101.00")
      await payTotal(guest, "$101.00").click()
      await expect(lightningQr).toBeVisible({ timeout: 45_000 })
    })

    await test.step("once the invoice expires the guest is told not to pay it again and offered a new one", async () => {
      await phone.clock.fastForward("01:00:01")
      await expect(
        guest
          .getByRole("main")
          .getByText(translate("en", "selfPay.lightning.expired"))
      ).toBeVisible()
      await expect(
        guestButton(guest, "selfPay.lightning.restart")
      ).toBeVisible()
      await expect(lightningQr).toHaveCount(0)
    })
  })

  test("the Bitcoin QR code shows without a tap, opens in the wallet from above it, and spells its code only when copying fails", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    await fakeSelfPayLightning(context, 100_000)
    let guestAddress = ""

    await test.step("seed a table that takes bank transfers and Lightning, with a pizza", async () => {
      await seedOnboarding(page, "en", { spark: true })
      await seedActiveFioPlugin(page)
      await addTable(page, "en", { name: "Table 43", seatCount: "2" })
      await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 43")
      await openTableBill(page, "en", { table: "Table 43", items: ["Pizza"] })
    })

    await using phone = await newGuestContext(browser, relays)
    await fakeSelfPayLightning(phone, 100_000)
    await phone.addInitScript(() => {
      document.execCommand = () => false
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.reject(new Error("NotAllowedError")),
        },
      })
    })
    const guest = await phone.newPage()
    const invoiceText = guest.getByText(/^lnbc\d+n1/u)

    await test.step("opening Bitcoin shows the QR code with Open in wallet above it and no code as text", async () => {
      await openGuestPage(guest, guestAddress, "$101.00")
      await payTotal(guest, "$101.00").click()
      await guest
        .getByRole("tab", { name: translate("en", "selfPay.method.lightning") })
        .click()
      const invoice = await readShownLightningInvoice(guest, "en")
      expect(invoice).toMatch(/^lnbc\d+n1/u)
      const [openBox, qrBox] = await Promise.all([
        guestButton(guest, "selfPay.lightning.open").boundingBox(),
        guest
          .getByRole("img", { name: translate("en", "selfPay.lightning.qr") })
          .boundingBox(),
      ])
      expect(openBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(qrBox?.y ?? 0)
      await expect(guestButton(guest, "selfPay.lightning.create")).toHaveCount(
        0
      )
      await expect(invoiceText).toHaveCount(0)
    })

    await test.step("a copy that fails tells the guest to hold the code, and shows it", async () => {
      await guestButton(guest, "selfPay.lightning.copy").click()
      await expect(
        guest
          .getByRole("main")
          .getByText(translate("en", "selfPay.copy.failed"))
      ).toBeVisible()
      await expect(invoiceText).toBeVisible()
    })
  })

  test("an offline guest is told so, and a Bitcoin QR code is prepared without waiting for the network", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    await fakeSelfPayLightning(context, 100_000)
    let guestAddress = ""

    await test.step("seed a table that takes bank transfers and Lightning, with a pizza", async () => {
      await seedOnboarding(page, "en", { spark: true })
      await seedActiveFioPlugin(page)
      await addTable(page, "en", { name: "Table 33", seatCount: "2" })
      await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 33")
      await openTableBill(page, "en", { table: "Table 33", items: ["Pizza"] })
    })

    await using phone = await newGuestContext(browser, relays)
    await fakeSelfPayLightning(phone, 100_000)
    const guest = await phone.newPage()
    const offline = guest
      .getByRole("main")
      .getByText(translate("en", "selfPay.offline"))

    await test.step("the guest opens the payment and the phone goes offline", async () => {
      await openGuestPage(guest, guestAddress, "$101.00")
      await expect(offline).toHaveCount(0)
      await payTotal(guest, "$101.00").click()
      await phone.setOffline(true)
      await expect(offline).toBeVisible()
    })

    await test.step("opening Bitcoin prepares the QR code at once instead of waiting for the network", async () => {
      await guest
        .getByRole("tab", { name: translate("en", "selfPay.method.lightning") })
        .click()
      await expect(
        guest
          .getByRole("img", { name: translate("en", "selfPay.lightning.qr") })
          .or(guest.getByText(translate("en", "selfPay.lightning.error")))
      ).toBeVisible()
    })

    await test.step("back online, the notice goes away", async () => {
      await phone.setOffline(false)
      await expect(offline).toHaveCount(0)
    })
  })

  test("what a guest picks stands out, and every text reads, in light and dark", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(180_000)
    const relays = await routeFakeNostrRelays(context)
    await fakeSelfPayLightning(context, 100_000)
    let guestAddress = ""

    await test.step("seed a table with bank transfer and Lightning", async () => {
      await seedOnboarding(page, "en", { spark: true })
      await seedActiveFioPlugin(page)
      await addTable(page, "en", { name: "Table 25", seatCount: "2" })
      await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 25")
      await openTableBill(page, "en", { table: "Table 25", items: ["Pizza"] })
    })

    for (const colorScheme of ["light", "dark"] as const) {
      await test.step(`in ${colorScheme} mode the picked tip, unit, share and method stand out, and the other QR format reads`, async () => {
        await using phone = await newGuestContext(browser, relays, {
          colorScheme,
        })
        await fakeSelfPayLightning(phone, 100_000)
        const guest = await phone.newPage()
        const tile = (key: TranslationKey) => guestButton(guest, key)
        const borderContrast = async (picked: Locator, unpicked: Locator) => {
          await expect
            .poll(() =>
              colorContrast(
                [picked, "border-top-color"],
                [unpicked, "border-top-color"]
              )
            )
            .toBeGreaterThanOrEqual(3)
        }
        const pickedAgainstUnpicked = async (
          picked: Locator,
          unpicked: Locator
        ) => {
          await expect(picked).toHaveAttribute("aria-pressed", "true")
          await borderContrast(picked, unpicked)
        }
        const readable = async (text: Locator) => {
          await expect
            .poll(() => colorContrast([text, "color"], [text, "background"]))
            .toBeGreaterThanOrEqual(4.5)
        }

        await openGuestPage(guest, guestAddress, "$101.00")
        await tenPercentTip(guest).click()
        await pickedAgainstUnpicked(
          tenPercentTip(guest),
          tile("selfPay.tip.none")
        )
        await readable(tenPercentTip(guest).locator("span").last())
        await readable(tile("selfPay.tip.none").locator("span").last())
        const remainder = tile("selfPay.choice.remainder")
        await expect(remainder).toHaveAttribute("aria-pressed", "true")
        await borderContrast(
          remainder.locator(".."),
          tile("selfPay.choice.equal").locator("..")
        )
        await readable(
          remainder.getByText(
            translate("en", "selfPay.choice.remainder.description")
          )
        )
        await readable(remainder.getByText("$101.00"))
        await readable(
          guest.getByRole("combobox", {
            name: translate("en", "selfPay.language.label"),
          })
        )

        await tile("selfPay.tip.custom").click()
        await pickedAgainstUnpicked(
          guest.getByRole("button", { name: "$", exact: true }),
          guest.getByRole("button", { name: "%", exact: true })
        )

        await tile("selfPay.tip.none").click()
        await payTotal(guest, "$101.00").click()
        await readable(tile("selfPay.bank.format.showPayBySquare"))
        const tab = (key: TranslationKey) =>
          guest.getByRole("tab", { name: translate("en", key) })
        await expect(tab("selfPay.method.bank")).toHaveAttribute(
          "aria-selected",
          "true"
        )
        await borderContrast(
          tab("selfPay.method.bank"),
          tab("selfPay.method.lightning")
        )
        await readable(tab("selfPay.method.lightning"))
      })
    }
  })

  test("focus follows the payment step and the page announces what changes", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress, billId } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 26"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const status = guest.getByRole("status")

    await test.step("entering another amount puts focus in its field", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await guestButton(guest, "selfPay.choice.amount").click()
      await expect(anotherAmount(guest)).toBeFocused()
    })

    await test.step("paying puts the amount at the top of the screen with focus on it", async () => {
      await pickEqualShares(guest, 2)
      await tenPercentTip(guest).click()
      await payTotal(guest, "$80.30").click()
      const amount = guest.getByRole("heading", { name: "$80.30" })
      await expect(amount).toBeFocused()
      expect(
        await guest.evaluate(() => document.activeElement?.textContent)
      ).toBe("$80.30")
      await expect
        .poll(
          async () =>
            (await amount.boundingBox())?.y ?? Number.POSITIVE_INFINITY
        )
        .toBeLessThan(8)
      await expect(status).toHaveText(translate("en", "selfPay.waiting"))
    })

    await test.step("copying the amount is announced", async () => {
      await guest
        .getByRole("button", {
          name: translateParams("en", "selfPay.bank.copy", {
            field: translate("en", "selfPay.bank.amount"),
          }),
        })
        .click()
      await expect(status).toHaveText(translate("en", "selfPay.copied"))
    })

    await test.step("the new amount is announced when staff remove a line while the guest chooses", async () => {
      await guestButton(guest, "selfPay.back").click()
      await expect(payTotal(guest, "$80.30")).toBeVisible()
      await page.goto(`/bill?billId=${billId}`)
      await page
        .getByRole("button", {
          name: nameParam("bill.brick.remove.aria", "Beer"),
        })
        .click()
      await waitForLocalWriteToSettle(page)
      await expect(status).toHaveText(
        guestText("selfPay.pay.total", "$55.55"),
        {
          timeout: 45_000,
        }
      )
    })
  })

  test("the pay bar never covers the focused tip, nor the custom tip in landscape", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 27"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const payBar = guest.locator("footer")
    const expectAbovePayBar = async (locator: Locator) => {
      await expect
        .poll(async () => {
          const box = await locator.boundingBox()
          const bar = await payBar.boundingBox()
          return (
            box !== null &&
            bar !== null &&
            box.y >= 0 &&
            box.y + box.height <= bar.y
          )
        })
        .toBe(true)
    }

    await test.step("a keyboard user tabs to the None tip above the pay bar", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await guestButton(guest, "selfPay.choice.amount").focus()
      await guest.keyboard.press("Tab")
      const none = guestButton(guest, "selfPay.tip.none")
      await expect(none).toBeFocused()
      await expectAbovePayBar(none)
    })

    await test.step("the custom tip field and its label stay above the pay bar in landscape", async () => {
      await guest.setViewportSize({ width: 818, height: 406 })
      await guestButton(guest, "selfPay.tip.custom").click()
      await customTipField(guest).focus()
      await expectAbovePayBar(customTipField(guest))
      await expectAbovePayBar(
        guest.getByText(translate("en", "selfPay.tip.custom.label"), {
          exact: true,
        })
      )
    })
  })

  test("an amount the page cannot read is named at its field", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 28"))
    await using phone = await newGuestContext(browser, relays)
    const guest = await phone.newPage()
    const unreadable = translate("en", "selfPay.amount.unreadable")

    await test.step("another amount of 12.345 is named, marked invalid and not offered to pay", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await guestButton(guest, "selfPay.choice.amount").click()
      await anotherAmount(guest).fill("12.345")
      await anotherAmount(guest).press("Tab")
      await expect(guest.getByText(unreadable)).toBeVisible()
      await expect(anotherAmount(guest)).toHaveAttribute("aria-invalid", "true")
      await expect(anyPayButton(guest)).toHaveCount(0)
    })

    await test.step("a custom tip that cannot be read is named and keeps the pay button off", async () => {
      await anotherAmount(guest).fill("20")
      await expect(anotherAmount(guest)).toHaveAttribute(
        "aria-invalid",
        "false"
      )
      await guestButton(guest, "selfPay.tip.custom").click()
      await customTipField(guest).fill("abc")
      await customTipField(guest).press("Tab")
      await expect(customTipField(guest)).toHaveAttribute(
        "aria-invalid",
        "true"
      )
      await expect(guest.getByText(unreadable)).toBeVisible()
      await expect(payTotal(guest, "$20.00")).toBeDisabled()
    })
  })

  test("a phone that shares a .spayd opens the QR Platba in the bank app, and saving the QR hands a PNG to the share sheet", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 29"))
    await using phone = await newGuestContext(browser, relays)
    await phone.addInitScript(() => {
      const shared: Array<{
        readonly name: string
        readonly type: string
        readonly head: ReadonlyArray<number>
        readonly text: string
      }> = []
      Object.assign(window, { __e2eSharedFiles: shared })
      Object.defineProperty(navigator, "canShare", { value: () => true })
      Object.defineProperty(navigator, "share", {
        value: async ({ files = [] }: ShareData) => {
          for (const file of files) {
            shared.push({
              name: file.name,
              type: file.type,
              head: [...new Uint8Array(await file.slice(0, 8).arrayBuffer())],
              text: await file.text(),
            })
          }
        },
      })
    })
    const guest = await phone.newPage()

    await test.step("the QR is an image the guest can long-press", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
      await expect(
        guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
      ).toHaveJSProperty("tagName", "IMG")
      await expect(
        guest.getByText(translate("en", "selfPay.bank.hint.open"))
      ).toBeVisible()
    })

    await test.step("saving it shares the PNG file", async () => {
      await guestButton(guest, "selfPay.bank.saveQr").click()
      await expect
        .poll(() =>
          guest.evaluate(() => Reflect.get(window, "__e2eSharedFiles"))
        )
        .toEqual([
          expect.objectContaining({
            name: expect.stringMatching(/^payment-\d{10}\.png$/u),
            type: "image/png",
            head: [137, 80, 78, 71, 13, 10, 26, 10],
          }),
        ])
    })

    await test.step("opening it in the bank app shares a .spayd file of the payment shown", async () => {
      await guestButton(guest, "selfPay.bank.openInApp").click()
      await expect
        .poll(() =>
          guest.evaluate(() => Reflect.get(window, "__e2eSharedFiles")[1])
        )
        .toEqual(
          expect.objectContaining({
            name: expect.stringMatching(/^payment-\d{10}\.spayd$/u),
            type: "application/x-shortpaymentdescriptor",
            text: expect.stringMatching(
              /^SPD\*1\.0\*ACC:CZ6508000000192000145399\*AM:146\.00\*CC:USD\*PT:IP\*X-VS:\d{10}\*MSG:[^*]+$/u
            ),
          })
        )
      const { name, text }: { readonly name: string; readonly text: string } =
        await guest.evaluate(() => Reflect.get(window, "__e2eSharedFiles")[1])
      const [, variableSymbol = "", message = ""] =
        /X-VS:(\d{10})\*MSG:(.+)$/u.exec(text) ?? []
      expect(name).toBe(`payment-${variableSymbol}.spayd`)
      await expect(
        guest.getByText(variableSymbol, { exact: true })
      ).toBeVisible()
      await expect(guest.getByText(message, { exact: true })).toBeVisible()
    })

    await test.step("PAY by square offers no bank-app button", async () => {
      await guestButton(guest, "selfPay.bank.format.showPayBySquare").click()
      await expect(
        guestButton(guest, "selfPay.bank.format.showSpayd")
      ).toBeVisible()
      await expect(guestButton(guest, "selfPay.bank.openInApp")).toHaveCount(0)
    })
  })

  test("the bank QR follows the page language, PAY by square in Slovak and QR Platba in Czech, each one tap from the other", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 42"))
    const payInLanguage = async (
      phone: BrowserContext,
      language: "cs" | "sk"
    ) => {
      const guest = await phone.newPage()
      await guest.goto(guestAddress)
      const pay = guest.getByRole("button", {
        name: translateParams(language, "selfPay.pay.total", {
          amount: new Intl.NumberFormat(language, {
            style: "currency",
            currency: "USD",
          }).format(146),
        }),
      })
      await expect(pay).toBeEnabled({ timeout: 45_000 })
      await pay.click()
      await expect(
        guest.getByRole("img", { name: translate(language, "selfPay.bank.qr") })
      ).toBeVisible()
      return (key: TranslationKey) =>
        guest.getByRole("button", { name: translate(language, key) })
    }

    await test.step("a Slovak page shows PAY by square and offers QR Platba for a Czech bank", async () => {
      await using phone = await newGuestContext(browser, relays, {
        locale: "sk-SK",
      })
      const link = await payInLanguage(phone, "sk")
      await expect(link("selfPay.bank.format.showPayBySquare")).toHaveCount(0)
      await link("selfPay.bank.format.showSpayd").click()
      await expect(link("selfPay.bank.format.showPayBySquare")).toBeVisible()
      await expect(link("selfPay.bank.format.showSpayd")).toHaveCount(0)
    })

    await test.step("a Czech page shows QR Platba and offers PAY by square for a Slovak bank", async () => {
      await using phone = await newGuestContext(browser, relays, {
        locale: "cs-CZ",
      })
      const link = await payInLanguage(phone, "cs")
      await expect(link("selfPay.bank.format.showSpayd")).toHaveCount(0)
      await link("selfPay.bank.format.showPayBySquare").click()
      await expect(link("selfPay.bank.format.showSpayd")).toBeVisible()
    })
  })

  test("a phone that cannot share a .spayd saves the QR as the main step and offers no bank app", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 41"))
    await using phone = await newGuestContext(browser, relays)
    await phone.addInitScript(() => {
      const shared: Array<string> = []
      Object.assign(window, { __e2eSharedFiles: shared })
      Object.defineProperty(navigator, "canShare", {
        value: ({ files = [] }: ShareData) =>
          files.every((file) => file.type === "image/png"),
      })
      Object.defineProperty(navigator, "share", {
        value: async ({ files = [] }: ShareData) => {
          shared.push(...files.map((file) => file.name))
        },
      })
    })
    const guest = await phone.newPage()
    const saveQr = guestButton(guest, "selfPay.bank.saveQr")
    const qr = guest.getByRole("img", {
      name: translate("en", "selfPay.bank.qr"),
    })

    await test.step("the guest is told to save the QR, above it, with no bank-app button", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
      await expect(qr).toBeVisible()
      await expect(
        guest.getByText(translate("en", "selfPay.bank.hint.save"))
      ).toBeVisible()
      await expect(guestButton(guest, "selfPay.bank.openInApp")).toHaveCount(0)
      const [saveBox, qrBox] = await Promise.all([
        saveQr.boundingBox(),
        qr.boundingBox(),
      ])
      expect(saveBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(qrBox?.y ?? 0)
    })

    await test.step("saving it shares only the PNG", async () => {
      await saveQr.click()
      await expect
        .poll(() =>
          guest.evaluate(() => Reflect.get(window, "__e2eSharedFiles"))
        )
        .toEqual([expect.stringMatching(/^payment-\d{10}\.png$/u)])
    })
  })

  test("each bill tab says what is left, and the payment step's controls are thumb-sized", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    await fakeSelfPayLightning(context, 100_000)
    let guestAddress = ""

    await test.step("seed a self-pay table with two bills, bank transfer and Lightning", async () => {
      await seedOnboarding(page, "en", { spark: true })
      await seedActiveFioPlugin(page)
      await addTable(page, "en", { name: "Table 30", seatCount: "4" })
      await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
      await addCatalogItem(page, "en", { name: "Beer", price: "45" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 30")
      await openTableBill(page, "en", { table: "Table 30", items: ["Pizza"] })
      await openTableBill(page, "en", { table: "Table 30", items: ["Beer"] })
    })

    await using phone = await newGuestContext(browser, relays)
    await fakeSelfPayLightning(phone, 100_000)
    const guest = await phone.newPage()
    const billTabs = guest.getByRole("tab")

    await test.step("each tab names its bill and what is left on it", async () => {
      await guest.goto(guestAddress)
      await expect(billTabs).toHaveCount(2, { timeout: 45_000 })
      await expect(billTabs.first()).toHaveText(
        `${translateParams("en", "selfPay.bill.number", { number: "1" })}${guestText("selfPay.bill.left", "$101.00")}`
      )
      await expect(billTabs.last()).toHaveText(
        `${translateParams("en", "selfPay.bill.number", { number: "2" })}${guestText("selfPay.bill.left", "$45.00")}`
      )
      expect(await minHeight(billTabs)).toBeGreaterThanOrEqual(44)
      expect(
        await minHeight(
          guest.getByRole("combobox", {
            name: translate("en", "selfPay.language.label"),
          })
        )
      ).toBeGreaterThanOrEqual(44)
    })

    await test.step("every control on the bank screen is at least 44 px", async () => {
      await payTotal(guest, "$101.00").click()
      const controls = [
        billTabs,
        guest.getByRole("tab", {
          name: translate("en", "selfPay.method.bank"),
        }),
        guestButton(guest, "selfPay.bank.format.showPayBySquare"),
        guestButton(guest, "selfPay.bank.saveQr"),
        guest.getByRole("button", { name: /^Copy /u }),
        guestButton(guest, "selfPay.back"),
      ]
      for (const control of controls) {
        expect(await minHeight(control)).toBeGreaterThanOrEqual(44)
      }
      const copyBox = await guest
        .getByRole("button", { name: /^Copy /u })
        .first()
        .boundingBox()
      expect(copyBox?.width ?? 0).toBeGreaterThanOrEqual(44)
    })
  })

  test("a table that offers guests no way to pay asks them to pay with the staff", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000)
    const relays = await routeFakeNostrRelays(context)
    let guestAddress = ""

    await test.step("seed a self-pay table on an account with a bank account but no bank sync", async () => {
      await addTable(page, "en", { name: "Table 31", seatCount: "2" })
      await addCatalogItem(page, "en", { name: "Soup", price: "30" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 31")
      await openTableBill(page, "en", { table: "Table 31", items: ["Soup"] })
    })

    await test.step("the guest is asked to pay with the staff because paying here is not available now", async () => {
      await using phone = await newGuestContext(browser, relays)
      const guest = await phone.newPage()
      await guest.goto(guestAddress)
      await expect(
        guest.getByRole("heading", {
          name: translate("en", "selfPay.disabled.title"),
        })
      ).toBeVisible({ timeout: 45_000 })
      await expect(
        guest.getByText(translate("en", "selfPay.noMethod.description"))
      ).toBeVisible()
      await expect(
        guest.getByText(translate("en", "selfPay.disabled.description"))
      ).toBeHidden()
    })
  })

  test("a Bitcoin-only table without a usable rate asks guests to pay with the staff before they choose", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(150_000)
    const relays = await routeFakeNostrRelays(context)
    await fakeSelfPayLightning(context, 100_000)
    await context.route("https://api.yadio.io/exrates/**", (route) =>
      route.abort()
    )
    let guestAddress = ""

    await test.step("seed a Lightning account whose till cannot get a rate", async () => {
      await seedOnboarding(page, "en", { spark: true })
      await addTable(page, "en", { name: "Table 32", seatCount: "2" })
      await addCatalogItem(page, "en", { name: "Soup", price: "30" })
      guestAddress = await enableTableSelfPay(page, "en", "Table 32")
      await openTableBill(page, "en", { table: "Table 32", items: ["Soup"] })
    })

    await test.step("the guest is told paying here is not available, with no choice and no Pay", async () => {
      await using phone = await newGuestContext(browser, relays)
      const guest = await phone.newPage()
      await guest.goto(guestAddress)
      await expect(
        guest.getByText(translate("en", "selfPay.noMethod.description"))
      ).toBeVisible({ timeout: 45_000 })
      await expect(guest.getByRole("button", { name: /^Pay / })).toHaveCount(0)
    })
  })
})

test("a guest pays a third of a bill too long to list by Lightning and sees it confirmed", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  await routeFakeNostrRelays(context)
  await fakeSelfPayLightning(context, 100_000)
  let guestAddress = ""
  let lnInvoice = ""

  await test.step("seed a table whose bill has more lines than one view holds", async () => {
    await seedOnboarding(page, "en", { spark: true })
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 12", seatCount: "8" })
    await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
    guestAddress = await enableTableSelfPay(page, "en", "Table 12")
    const billId = await openTableBill(page, "en", {
      table: "Table 12",
      items: ["Pizza"],
    })
    await addBillLines(
      page,
      billId,
      Array.from({ length: 64 }, (_, index) => ({
        name: `${index} ${"Ř".repeat(250)}`,
        amount: 1000,
      }))
    )
  })

  const guest = await context.newPage()

  await test.step("the guest sees the bill by its totals and picks a third of it", async () => {
    await guest.goto(guestAddress)
    await expect(
      guest.getByRole("button", {
        name: guestText("selfPay.pay.total", "$741.00"),
      })
    ).toBeVisible({ timeout: 45_000 })
    await expect(
      guest.getByRole("button", {
        name: translate("en", "selfPay.choice.items"),
      })
    ).toBeHidden()
    await pickEqualShares(guest, 3)
    await guest
      .getByRole("button", { name: guestText("selfPay.pay.total", "$247.00") })
      .click()
  })

  await test.step("the guest creates a Lightning invoice for the third", async () => {
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.method.lightning") })
      .click()
    lnInvoice = await readShownLightningInvoice(guest, "en")
    expect(lnInvoice).toMatch(/^lnbc\d+n1/u)
  })

  await test.step("switching to the bank and back keeps the same invoice", async () => {
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.method.bank") })
      .click()
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.method.lightning") })
      .click()
    expect(await readShownLightningInvoice(guest, "en")).toBe(lnInvoice)
    await expect(
      guest.getByRole("button", {
        name: translate("en", "selfPay.lightning.create"),
      })
    ).toBeHidden()
  })

  await test.step("the money arrives and the guest's page shows it confirmed", async () => {
    const amountSats = Number(/^lnbc(\d+)n1/u.exec(lnInvoice)?.[1]) / 10
    await receiveLightningPayment(page, { lnInvoice, amountSats })
    await expect(
      guest
        .getByRole("main")
        .getByText(guestText("selfPay.confirmation.mine", "$247.00"))
    ).toBeVisible({ timeout: 45_000 })
  })
})

test.describe("the till", () => {
  test("the open bill announces guest money, labels what is left and links to the bill guests close", async ({
    seededPage: page,
    context,
    browser,
  }) => {
    test.setTimeout(180_000)
    const relays = await routeFakeNostrRelays(context)
    const { guestAddress, billId } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 14"))

    await test.step("a guest pays the beer while staff have the bill open", async () => {
      const guest = await context.newPage()
      await guest.goto(guestAddress)
      await payAllOfTheBeer(page, guest)
      await guest.close()
      await expect(
        page.getByText(
          translateParams("en", "bill.guestMoney.arrived", {
            paid: "$45.00",
            remaining: "$101.00",
          })
        )
      ).toBeVisible({ timeout: 30_000 })
    })

    await test.step("the collapsed bill bar labels what is left", async () => {
      await expect(page.getByTestId("bill-summary-trigger")).toContainText(
        `${translate("en", "bill.summary.leftToPay")}$101.00`
      )
    })

    await test.step("another guest pays the rest", async () => {
      const guestContext = await browser.newContext({
        ignoreHTTPSErrors: true,
      })
      try {
        await relays.route(guestContext)
        const guest = await guestContext.newPage()
        await guest.goto(guestAddress)
        await pickShareChoice(guest, "selfPay.choice.remainder")
        await guest
          .getByRole("button", {
            name: guestText("selfPay.pay.total", "$101.00"),
          })
          .click()
        await receiveShownBankTransfer(page, {
          payer: guest,
          language: "en",
          amount: 10_100,
          currency: "USD",
        })
      } finally {
        await guestContext.close()
      }
    })

    await test.step("the till says guests paid the bill and links to its detail", async () => {
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: translate("en", "bill.guestMoney.closed") })
      ).toBeVisible({ timeout: 30_000 })
      await page
        .getByRole("link", {
          name: translate("en", "bill.guestMoney.openDetail"),
        })
        .click()
      await page
        .getByRole("heading", { name: translate("en", "billDetail.title") })
        .waitFor()
      expect(new URL(page.url()).pathname).toBe(`/activity/bills/${billId}`)
    })
  })

  test("removing the beer guests paid for asks first with the amount, and so does discarding the bill", async ({
    seededPage: page,
    context,
  }) => {
    test.setTimeout(120_000)
    await routeFakeNostrRelays(context)
    const { guestAddress } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 15"))
    const question = page.getByRole("alertdialog")
    const removeBeer = page.getByRole("button", {
      name: nameParam("bill.brick.remove.aria", "Beer"),
    })

    await test.step("a guest pays the beer and its brick says so", async () => {
      const guest = await context.newPage()
      await guest.goto(guestAddress)
      await payAllOfTheBeer(page, guest)
      await guest.close()
      await expect(
        page.getByText(
          translateParams("en", "bill.brick.guestPaid", { amount: "$45.00" }),
          { exact: true }
        )
      ).toBeVisible({ timeout: 30_000 })
    })

    await test.step("tapping − on the beer asks with what guests paid before removing it", async () => {
      await removeBeer.click()
      await expect(question).toContainText(
        translateParams("en", "bill.guestPaid.remove.title", { names: "Beer" })
      )
      await expect(question).toContainText(
        translateParams("en", "bill.guestPaid.description", {
          amount: "$45.00",
          names: "Beer",
        })
      )
      await question
        .getByRole("button", { name: translate("en", "bill.cover.cancel") })
        .click()
      await expect(question).toBeHidden()
      await expect(removeBeer).toBeVisible()
      await expect(page.getByTestId("bill-summary-trigger")).toContainText(
        `${translate("en", "bill.summary.leftToPay")}$101.00`
      )
    })

    await test.step("discarding the bill names the guest money that stays on it", async () => {
      await page
        .getByRole("button", { name: translate("en", "bill.discard") })
        .click()
      await expect(question).toContainText(
        translateParams("en", "bill.discard.confirm.paid.description", {
          amount: "$45.00",
        })
      )
      await question
        .getByRole("button", {
          name: translate("en", "bill.discard.confirm.cancel"),
        })
        .click()
      await expect(question).toBeHidden()
    })
  })

  test("the guest money a discarded bill holds is answered on its overpayment card", async ({
    seededPage: page,
    context,
  }) => {
    test.setTimeout(120_000)
    await routeFakeNostrRelays(context)
    const { guestAddress, billId } =
      await test.step("seed a table with self-pay and a bill of a pizza and a beer", () =>
        seedPizzaAndBeerBill(page, "Table 16"))

    await test.step("a guest pays the beer", async () => {
      const guest = await context.newPage()
      await guest.goto(guestAddress)
      await payAllOfTheBeer(page, guest)
      await guest.close()
      await expect(
        page.getByText(
          translateParams("en", "bill.brick.guestPaid", { amount: "$45.00" }),
          { exact: true }
        )
      ).toBeVisible({ timeout: 30_000 })
    })

    await test.step("staff discard the bill", async () => {
      await page
        .getByRole("button", { name: translate("en", "bill.discard") })
        .click()
      await page
        .getByRole("alertdialog")
        .getByRole("button", {
          name: translate("en", "bill.discard.confirm.confirm"),
        })
        .click()
      await waitForLocalWriteToSettle(page)
    })

    await test.step("the activity reads the discarded bill's money overpaid, never underpaid", async () => {
      await gotoPage(page, "/activity/bills", "en", "activity.title")
      const billRow = contentNav(page, "en").locator(`a[href$="/${billId}"]`)
      await expect(billRow).toContainText(
        translate("en", "billHistory.overpaid")
      )
      await expect(billRow).not.toContainText(
        translate("en", "billHistory.underpaid")
      )

      await gotoPage(page, "/activity", "en", "activity.title")
      const paymentRow = contentNav(page, "en").getByRole("link")
      await expect(paymentRow).toHaveCount(1)
      await expect(paymentRow).toContainText(
        translate("en", "paymentHistory.billOverpaid")
      )
      await expect(paymentRow).not.toContainText(
        translate("en", "paymentHistory.billUnderpaid")
      )

      await paymentRow.click()
      await expect(
        page.getByText(
          translateParams("en", "overpayment.title", { amount: "$45.00" })
        )
      ).toBeVisible()
      await expect(
        page.getByRole("button", {
          name: translate("en", "overpayment.resolveOnBill"),
        })
      ).toBeVisible()
      await expect(
        page.getByText(
          translate("en", "paymentDetail.bill.coverage.underpaid.title")
        )
      ).toBeHidden()
    })

    await test.step("the canceled bill offers the guest's money, and keeping it resolves it", async () => {
      await page.goto(`/activity/bills/${billId}`)
      const card = overpaymentCard(page)
      await expect(card).toContainText(
        translateParams("en", "overpayment.title", { amount: "$45.00" })
      )
      await resolveOverpayment(page, "en", { kind: "kept", amount: "45" })
      await expect(card).toContainText(
        translate("en", "overpayment.resolved.title")
      )
    })
  })
})
