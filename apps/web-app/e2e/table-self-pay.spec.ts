import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import type { Locator, Page } from "@playwright/test"
import { addCatalogItem, addTable } from "./support/bill.ts"
import { cancelBillDirectly } from "./support/collisions.ts"
import { colorContrast } from "./support/color-contrast.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { nameParam, translate, translateParams } from "./support/i18n.ts"
import {
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import { seedOnboarding } from "./support/onboarding.ts"
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
    const payBySquare = payer.getByRole("button", {
      name: translate("en", "selfPay.bank.format.payBySquare"),
    })
    await payBySquare.click()
    await expect(payBySquare).toHaveAttribute("aria-pressed", "true")
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
      .getByRole("button", { name: translate("en", "home.pay") })
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

    await test.step("the instructions say from the start that the restaurant confirms the money", async () => {
      await openGuestPage(guest, guestAddress, "$146.00")
      await payTotal(guest, "$146.00").click()
      await expect(guest.getByRole("status")).toHaveText(
        translate("en", "selfPay.waiting")
      )
      await expect(waitingIndicator).toBeVisible()
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

    await test.step("the guest creates a Lightning invoice", async () => {
      await openGuestPage(guest, guestAddress, "$101.00")
      await payTotal(guest, "$101.00").click()
      await guestButton(guest, "selfPay.lightning.create").click({
        timeout: 45_000,
      })
      await expect(guest.getByText(/^lnbc\d+n1/u)).toBeVisible()
    })

    await test.step("once the invoice expires the guest is told and offered a new one", async () => {
      await phone.clock.fastForward("01:00:01")
      await expect(
        guest
          .getByRole("main")
          .getByText(translate("en", "selfPay.lightning.expired"))
      ).toBeVisible()
      await expect(
        guestButton(guest, "selfPay.lightning.restart")
      ).toBeVisible()
      await expect(guest.getByText(/^lnbc\d+n1/u)).toHaveCount(0)
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
      await test.step(`in ${colorScheme} mode the picked tip, unit, share, QR format and method stand out`, async () => {
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
        await pickedAgainstUnpicked(
          tile("selfPay.bank.format.spayd"),
          tile("selfPay.bank.format.payBySquare")
        )
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

  test("saving the payment QR hands a PNG to the share sheet, and a QR Platba opens in the bank app as a .spayd file", async ({
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
      await guestButton(guest, "selfPay.bank.format.payBySquare").click()
      await expect(
        guestButton(guest, "selfPay.bank.format.payBySquare")
      ).toHaveAttribute("aria-pressed", "true")
      await expect(guestButton(guest, "selfPay.bank.openInApp")).toHaveCount(0)
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
        guestButton(guest, "selfPay.bank.format.spayd"),
        guestButton(guest, "selfPay.bank.format.payBySquare"),
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
    await guest
      .getByRole("button", {
        name: translate("en", "selfPay.lightning.create"),
      })
      .click({ timeout: 45_000 })
    lnInvoice = (await guest.getByText(/^lnbc\d+n1/u).textContent()) ?? ""
    expect(lnInvoice).toMatch(/^lnbc\d+n1/u)
  })

  await test.step("switching to the bank and back keeps the same invoice", async () => {
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.method.bank") })
      .click()
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.method.lightning") })
      .click()
    await expect(guest.getByText(lnInvoice, { exact: true })).toBeVisible()
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
