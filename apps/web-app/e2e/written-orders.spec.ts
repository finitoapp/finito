import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import type { Page } from "@playwright/test"

import { addTable, addTaxRate } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate, translateParams } from "./support/i18n.ts"
import {
  pickInlineOption,
  toggleInlineCheckbox,
  toggleInlineSwitch,
} from "./support/inline-edit.ts"
import { gotoPage } from "./support/navigation.ts"
import { seedOnboarding } from "./support/onboarding.ts"
import { openRefundScreen, refundConfirmButton } from "./support/payment.ts"
import {
  enableTableSelfPay,
  fakeSelfPayLightning,
  receiveBankTransfer,
  receiveShownBankTransfer,
  routeFakeNostrRelays,
  seedActiveFioPlugin,
} from "./support/self-pay.ts"

const switchWriting = async (page: Page) => {
  await gotoPage(page, "/catalog/tables", "en", "catalog.tables.title")
  await toggleInlineSwitch(page, "catalog.tables.selfPayOptions.written")
}

const seedBar = async (page: Page) => {
  await seedActiveFioPlugin(page)
  await addTable(page, "en", { name: "Bar", seatCount: "4" })
  const guestAddress = await enableTableSelfPay(page, "en", "Bar")
  await switchWriting(page)
  return guestAddress
}

const textField = (guest: Page) =>
  guest.getByRole("textbox", {
    name: translate("en", "selfPay.written.text.label"),
  })

const amountField = (guest: Page) =>
  guest.getByRole("textbox", {
    name: translate("en", "selfPay.written.amount.label"),
  })

const payButton = (guest: Page, amount: string) =>
  guest.getByRole("button", {
    name: translateParams("en", "selfPay.pay.total", { amount }),
  })

const anyPayButton = (guest: Page) =>
  guest.getByRole("button", { name: /^Pay / })

const openForm = async (guest: Page, guestAddress: string) => {
  await guest.goto(guestAddress)
  await expect(textField(guest)).toBeVisible({ timeout: 45_000 })
}

const writeOrder = async (
  guest: Page,
  guestAddress: string,
  { text, amount }: { readonly text: string; readonly amount: string }
) => {
  await openForm(guest, guestAddress)
  await textField(guest).fill(text)
  await amountField(guest).fill(amount)
  await payButton(guest, `$${amount}`).click()
  await expect(
    guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
  ).toBeVisible()
}

const bankField = async (
  guest: Page,
  key:
    | "selfPay.bank.amount"
    | "selfPay.bank.variableSymbol"
    | "selfPay.bank.message"
) =>
  (await guest
    .getByText(translate("en", key), { exact: true })
    .locator("xpath=following-sibling::*[1]")
    .textContent()) ?? ""

const orderStatus = (
  guest: Page,
  key:
    | "selfPay.order.paid"
    | "selfPay.order.left"
    | "selfPay.order.preparing"
    | "selfPay.order.served"
    | "selfPay.order.rejected",
  params: Readonly<Record<string, string | number>>
) => guest.getByRole("main").getByText(translateParams("en", key, params))

const gotoOrders = (page: Page) =>
  gotoPage(page, "/orders", "en", "orders.title")

test("the owner switches writing on and a sticker printed before shows the form", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guest = await context.newPage()
  const guestAddress =
    await test.step("a table has self-pay on and offers nothing to write", async () => {
      await seedActiveFioPlugin(page)
      await addTable(page, "en", { name: "Bar", seatCount: "4" })
      const address = await enableTableSelfPay(page, "en", "Bar")
      await guest.goto(address)
      await expect(
        guest.getByText(translate("en", "selfPay.empty.title"))
      ).toBeVisible({ timeout: 45_000 })
      await expect(textField(guest)).toHaveCount(0)
      return address
    })

  await test.step("switching writing on names this device to take orders", async () => {
    await switchWriting(page)
    await expect(
      page.getByRole("combobox", {
        name: translate(
          "en",
          "catalog.tables.selfPayOptions.orderDevice.label"
        ),
      })
    ).toContainText(
      translateParams("en", "catalog.tables.selfPayOptions.orderDevice.this", {
        name: "",
      }).trim()
    )
  })

  await test.step("the same sticker now shows the form, and nothing to order", async () => {
    await openForm(guest, guestAddress)
    await expect(
      guest.getByText(translate("en", "selfPay.order.unavailable.title"))
    ).toHaveCount(0)
  })

  await test.step("switching it off takes the form away", async () => {
    await switchWriting(page)
    await expect(async () => {
      await guest.goto(guestAddress)
      await expect(
        guest.getByText(translate("en", "selfPay.empty.title"))
      ).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
    await expect(textField(guest)).toHaveCount(0)
  })
})

test("a VAT payer's guests can write once the owner picks the tax rate of a written line", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guest = await context.newPage()
  const missingRate = page.getByText(
    translate(
      "en",
      "catalog.tables.selfPayOptions.written.taxRate.missing.title"
    )
  )

  const guestAddress =
    await test.step("a VAT payer switches writing on and is told guests can't write yet", async () => {
      await gotoPage(
        page,
        "/settings/legal-entity",
        "en",
        "settings.legalEntity.title"
      )
      await pickInlineOption(
        page,
        "settings.legalEntity.country.label",
        translate("en", "country.cz")
      )
      await toggleInlineCheckbox(page, "settings.legalEntity.vatPayer.label")
      await addTaxRate(page, "en", { name: "Standard", rate: "21" })
      const address = await seedBar(page)
      await expect(missingRate).toBeVisible()
      return address
    })

  await test.step("the guest is asked to order with the staff and offered nothing to write", async () => {
    await guest.goto(guestAddress)
    await expect(
      guest.getByText(translate("en", "selfPay.order.unavailable.title"))
    ).toBeVisible({ timeout: 45_000 })
    await expect(textField(guest)).toHaveCount(0)
  })

  await test.step("once the owner picks the rate, the guest can write", async () => {
    await pickInlineOption(
      page,
      "catalog.tables.selfPayOptions.written.taxRate.label",
      /^Standard/
    )
    await expect(missingRate).toHaveCount(0)
    await openForm(guest, guestAddress)
  })
})

test("a VAT payer's staff switch a written item to another tax rate before accepting the order, and it holds after", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(150_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const guest = await context.newPage()
  const mealRates = orderCard.getByRole("group", {
    name: translateParams("en", "orders.written.taxRate", { text: "utopenec" }),
  })

  const guestAddress =
    await test.step("a VAT payer with a standard and a food rate writes lines at the standard one", async () => {
      await gotoPage(
        page,
        "/settings/legal-entity",
        "en",
        "settings.legalEntity.title"
      )
      await pickInlineOption(
        page,
        "settings.legalEntity.country.label",
        translate("en", "country.cz")
      )
      await toggleInlineCheckbox(page, "settings.legalEntity.vatPayer.label")
      await addTaxRate(page, "en", { name: "Standard", rate: "21" })
      await addTaxRate(page, "en", { name: "Food", rate: "12" })
      const address = await seedBar(page)
      await pickInlineOption(
        page,
        "catalog.tables.selfPayOptions.written.taxRate.label",
        /^Standard/
      )
      return address
    })

  await test.step("a guest writes a beer and a meal and pays", async () => {
    await gotoOrders(page)
    await openForm(guest, guestAddress)
    await textField(guest).fill("2x pivo")
    await amountField(guest).fill("90.00")
    await guest
      .getByRole("button", { name: translate("en", "selfPay.written.add") })
      .click()
    await textField(guest).nth(1).fill("utopenec")
    await amountField(guest).nth(1).fill("60.00")
    await payButton(guest, "$150.00").click()
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 15_000,
      currency: "USD",
    })
  })

  await test.step("staff switch the meal to the food rate, then accept the order", async () => {
    const food = mealRates.getByRole("button", { name: /^Food/ })
    await expect(food).toBeVisible({ timeout: 45_000 })
    await food.click()
    await expect(food).toHaveAttribute("aria-pressed", "true")
    await orderCard
      .getByRole("button", { name: translate("en", "orders.accept") })
      .click()
    await expect(orderCard).toContainText(translate("en", "orders.preparing"))
  })

  await test.step("the accepted order shows each rate and offers no switch", async () => {
    await expect(mealRates).toHaveCount(0)
    await expect(orderCard).toContainText("Standard (21%)")
    await expect(orderCard).toContainText("Food (12%)")
  })
})

test("staff remember a written item for today as Řízek for 199.00, and the next guest orders it from the menu", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(150_000)
  await routeFakeNostrRelays(context)
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("a guest writes a schnitzel and pays it", async () => {
    await writeOrder(guest, guestAddress, {
      text: "řízek s kaší",
      amount: "189.00",
    })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 18_900,
      currency: "USD",
    })
  })

  await test.step("the owner switches ordering from the menu on", async () => {
    await gotoPage(page, "/catalog/tables", "en", "catalog.tables.title")
    await toggleInlineSwitch(page, "catalog.tables.selfPayOptions.order")
    await expect(
      page.getByRole("combobox", {
        name: translate(
          "en",
          "catalog.tables.selfPayOptions.written.dayEnd.label"
        ),
      })
    ).toContainText("4:00")
  })

  await test.step("staff remember it as Řízek for 199.00", async () => {
    await gotoOrders(page)
    await page
      .getByRole("button", { name: translate("en", "orders.written.remember") })
      .click()
    const dialog = page.getByRole("dialog")
    const name = dialog.getByRole("textbox", {
      name: translate("en", "catalog.items.form.name.label"),
    })
    await expect(name).toHaveValue("řízek s kaší")
    await name.fill("Řízek")
    await dialog
      .getByRole("textbox", {
        name: translate("en", "catalog.items.form.price.label"),
      })
      .fill("199.00")
    await dialog
      .getByRole("button", { name: translate("en", "orders.remember.save") })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText(
        translateParams("en", "orders.written.remembered", { time: "4:00 AM" })
      )
    ).toBeVisible()
  })

  await test.step("the next guest finds Řízek in the menu", async () => {
    const next = await context.newPage()
    await next.goto(guestAddress)
    await expect(
      next.getByRole("button", {
        name: nameParam("selfPay.menu.quantity.increase", "Řízek"),
      })
    ).toBeVisible({ timeout: 45_000 })
  })
})

test("a guest writes 2x pivo for 90.00 and the QR asks for 90.00 with a reference that starts with 9", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("the guest writes it and pays", () =>
    writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" }))

  await test.step("the bank payment carries the amount, a 9 reference and a PK1 message, not the text", async () => {
    expect(await bankField(guest, "selfPay.bank.amount")).toBe("90.00")
    expect(await bankField(guest, "selfPay.bank.variableSymbol")).toMatch(
      /^9\d{9}$/u
    )
    const message = await bankField(guest, "selfPay.bank.message")
    expect(message).toMatch(/^PK1[A-Z2-7]{32}$/u)
    expect(message).not.toContain("pivo")
  })
})

test("a guest writes two items, pays their total, and staff see each with its amount and the total", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("the guest writes 2x pivo for 90.00, adds utopenec for 60.00 and pays 150.00", async () => {
    await gotoOrders(page)
    await openForm(guest, guestAddress)
    await textField(guest).fill("2x pivo")
    await amountField(guest).fill("90.00")
    await guest
      .getByRole("button", { name: translate("en", "selfPay.written.add") })
      .click()
    await textField(guest).nth(1).fill("utopenec")
    await amountField(guest).nth(1).fill("60.00")
    await payButton(guest, "$150.00").click()
    expect(await bankField(guest, "selfPay.bank.amount")).toBe("150.00")
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 15_000,
      currency: "USD",
    })
  })

  await test.step("To serve lists each item as the guest's, with its amount, and the total", async () => {
    for (const [text, amount] of [
      ["2x pivo", "$90.00"],
      ["utopenec", "$60.00"],
    ] as const) {
      await expect(orderCard).toContainText(
        translateParams("en", "orders.written", { text })
      )
      await expect(orderCard).toContainText(amount)
    }
    await expect(orderCard).toContainText(
      translateParams("en", "orders.written.total", { amount: "$150.00" })
    )
  })
})

test("the form refuses only spaces, too little and too much, takes 90,50 and no 256th character", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()
  await openForm(guest, guestAddress)

  await test.step("only spaces offer no payment", async () => {
    await textField(guest).fill("   ")
    await amountField(guest).fill("90")
    await expect(anyPayButton(guest)).toHaveCount(0)
  })

  await test.step("below the minimum says the smallest amount", async () => {
    await textField(guest).fill("2x pivo")
    await amountField(guest).fill("0.01")
    await expect(anyPayButton(guest)).toHaveCount(0)
    await expect(
      guest.getByText(
        translateParams("en", "selfPay.written.amount.tooLow", {
          amount: "$0.05",
        })
      )
    ).toBeVisible()
  })

  await test.step("above the maximum says the largest amount", async () => {
    await amountField(guest).fill("10000000")
    await expect(anyPayButton(guest)).toHaveCount(0)
    await expect(
      guest.getByText(
        translateParams("en", "selfPay.written.amount.tooHigh", {
          amount: "$9,999,999.99",
        })
      )
    ).toBeVisible()
  })

  await test.step("a decimal comma is taken", async () => {
    await amountField(guest).fill("90,50")
    await expect(payButton(guest, "$90.50")).toBeVisible()
  })

  await test.step("the text keeps its first 255 characters", async () => {
    await textField(guest).fill("a".repeat(255))
    await textField(guest).press("b")
    await expect(textField(guest)).toHaveValue("a".repeat(255))
  })
})

test("when no relay takes the written order, the guest is asked to pay with the staff and offered no payment", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  const relays = await routeFakeNostrRelays(context)
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("the guest writes it while every relay refuses it", async () => {
    await openForm(guest, guestAddress)
    await textField(guest).fill("2x pivo")
    await amountField(guest).fill("90.00")
    for (const url of defaultSelfPayRelays) {
      relays.refuse(url, true)
    }
    await payButton(guest, "$90.00").click()
  })

  await test.step("the page says so and shows no QR", async () => {
    await expect(guest.getByRole("alert")).toHaveText(
      translate("en", "selfPay.order.refused")
    )
    await expect(
      guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toHaveCount(0)
  })
})

test("the device that takes orders records it and the guest sees order 1, 2x pivo, confirmed and paid", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("the guest writes it and the transfer arrives", async () => {
    await writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 9000,
      currency: "USD",
    })
  })

  await test.step("the guest sees it confirmed, with the text", async () => {
    await expect(
      orderStatus(guest, "selfPay.order.paid", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
    await expect(guest.getByRole("main")).toContainText("2x pivo")
  })
})

test("staff see New order 1 · Bar · $90.00 · 2x pivo, accept it and mark it served, and the guest sees both", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("staff wait on To serve while a guest writes and pays", async () => {
    await gotoOrders(page)
    await writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 9000,
      currency: "USD",
    })
  })

  await test.step("the till announces the table, the number, the money and the text", async () => {
    await expect(
      page.getByText(
        translateParams("en", "orders.announced.written", {
          number: 1,
          table: "Bar",
          amount: "$90.00",
          text: "2x pivo",
        })
      )
    ).toBeVisible()
  })

  await test.step("To serve shows the text as the guest's, paid", async () => {
    await expect(orderCard).toContainText("Bar")
    await expect(orderCard).toContainText(
      translateParams("en", "orders.written", { text: "2x pivo" })
    )
    await expect(orderCard).toContainText(translate("en", "orders.paid"))
  })

  await test.step("the guest sees it paid and waiting for the staff", async () => {
    await expect(
      orderStatus(guest, "selfPay.order.paid", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
  })

  await test.step("Accept tells the guest it is being prepared", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.accept") })
      .click()
    await expect(orderCard).toContainText(translate("en", "orders.preparing"))
    await expect(
      orderStatus(guest, "selfPay.order.preparing", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
  })

  await test.step("Served takes it off the list and tells the guest", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.served") })
      .click()
    await expect(orderCard).toHaveCount(0)
    await expect(
      orderStatus(guest, "selfPay.order.served", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
  })
})

test("staff reject a written order, refund it from its payment, and the guest is told", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("a guest writes and pays while staff wait on To serve", async () => {
    await gotoOrders(page)
    await writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 9000,
      currency: "USD",
    })
    await expect(orderCard).toHaveCount(1)
  })

  await test.step("going back in the dialog keeps the order", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.reject") })
      .click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toContainText(
      translateParams("en", "orders.reject.title", { number: 1 })
    )
    await dialog
      .getByRole("button", { name: translate("en", "orders.reject.cancel") })
      .click()
    await expect(orderCard).toHaveCount(1)
  })

  await test.step("rejecting opens the order's payment", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.reject") })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: translate("en", "orders.reject.confirm") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentDetail.title") })
      .waitFor()
  })

  await test.step("the refund goes through from the payment", async () => {
    await openRefundScreen(page, "en")
    await refundConfirmButton(page).click()
    await expect(
      page.getByText(translate("en", "refund.created"))
    ).toBeVisible()
  })

  await test.step("the guest sees it rejected", async () => {
    await expect(
      orderStatus(guest, "selfPay.order.rejected", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
  })

  await test.step("To serve no longer lists it", async () => {
    await gotoOrders(page)
    await expect(orderCard).toHaveCount(0)
  })
})

test("a guest paying the rest of an order staff reject leaves the payment and is told", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("the guest pays 80.00 of 90.00 and opens paying the rest", async () => {
    await gotoOrders(page)
    await writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 8000,
      currency: "USD",
    })
    const payRest = guest.getByRole("button", {
      name: translateParams("en", "selfPay.order.payRest", {
        amount: "$10.00",
      }),
    })
    await expect(payRest).toBeVisible({ timeout: 45_000 })
    await payRest.click()
    expect(await bankField(guest, "selfPay.bank.amount")).toBe("10.00")
  })

  await test.step("staff reject it, and the guest's payment closes on the rejection", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.reject") })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: translate("en", "orders.reject.confirm") })
      .click()
    await expect(
      orderStatus(guest, "selfPay.order.rejected", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
    await expect(
      guest.getByRole("button", { name: translate("en", "selfPay.order.back") })
    ).toHaveCount(0)
  })
})

test("money a guest sends after staff reject the order stays off its bill, listed apart by the order's number", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  const rest =
    await test.step("the guest pays 80.00 of 90.00 and opens paying the rest", async () => {
      await gotoOrders(page)
      await writeOrder(guest, guestAddress, {
        text: "2x pivo",
        amount: "90.00",
      })
      await receiveShownBankTransfer(page, {
        payer: guest,
        language: "en",
        amount: 8000,
        currency: "USD",
      })
      const payRest = guest.getByRole("button", {
        name: translateParams("en", "selfPay.order.payRest", {
          amount: "$10.00",
        }),
      })
      await expect(payRest).toBeVisible({ timeout: 45_000 })
      await payRest.click()
      return {
        variableSymbol: await bankField(guest, "selfPay.bank.variableSymbol"),
        recipientMessage: await bankField(guest, "selfPay.bank.message"),
      }
    })

  await test.step("staff reject the order", async () => {
    await page
      .getByTestId("order-to-serve")
      .getByRole("button", { name: translate("en", "orders.reject") })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: translate("en", "orders.reject.confirm") })
      .click()
    await gotoOrders(page)
  })

  await test.step("the rest the guest sends anyway is listed apart, by the order's number", async () => {
    await receiveBankTransfer(page, { amount: 1000, currency: "USD", ...rest })
    await expect(
      page.getByText(translate("en", "orders.paidAfterRejection.title"))
    ).toBeVisible({ timeout: 45_000 })
    await expect(
      page.getByText(
        translateParams("en", "orders.paidAfterRejection.entry", {
          number: 1,
          amount: "$10.00",
        })
      )
    ).toBeVisible()
  })
})

test("a guest paying the rest of one order, then of another, starts the second without the first's Lightning invoice", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  await routeFakeNostrRelays(context)
  await fakeSelfPayLightning(context, 100_000)
  const guestAddress =
    await test.step("seed the bar with Lightning", async () => {
      await seedOnboarding(page, "en", { spark: true })
      return seedBar(page)
    })
  const guest = await context.newPage()
  const payRest = (amount: string) =>
    guest.getByRole("button", {
      name: translateParams("en", "selfPay.order.payRest", { amount }),
    })
  const payByLightning = async () => {
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.method.lightning") })
      .click()
  }
  let firstInvoice = ""

  await test.step("the guest pays 80.00 of 90.00 for one order and 30.00 of 50.00 for another", async () => {
    await gotoOrders(page)
    await writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 8000,
      currency: "USD",
    })
    await expect(payRest("$10.00")).toBeVisible({ timeout: 45_000 })
    await writeOrder(guest, guestAddress, { text: "kofola", amount: "50.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 3000,
      currency: "USD",
    })
    await expect(payRest("$20.00")).toBeVisible({ timeout: 45_000 })
  })

  await test.step("the guest creates a Lightning invoice for the rest of the first", async () => {
    await payRest("$10.00").click()
    await payByLightning()
    await guest
      .getByRole("button", {
        name: translate("en", "selfPay.lightning.create"),
      })
      .click({ timeout: 45_000 })
    firstInvoice = (await guest.getByText(/^lnbc\d+n1/u).textContent()) ?? ""
    expect(firstInvoice).toMatch(/^lnbc\d+n1/u)
  })

  await test.step("paying the rest of the second offers a new invoice, not the first's", async () => {
    await payRest("$20.00").click()
    await payByLightning()
    await expect(
      guest.getByRole("button", {
        name: translate("en", "selfPay.lightning.create"),
      })
    ).toBeVisible()
    await expect(guest.getByText(firstInvoice, { exact: true })).toBeHidden()
  })
})

test("a guest who pays less leaves nothing owed, staff see both amounts, and the rest raises the line", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const orderCard = page.getByTestId("order-to-serve")
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("the guest writes 90.00 and 80.00 arrives", async () => {
    await gotoOrders(page)
    await writeOrder(guest, guestAddress, { text: "2x pivo", amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 8000,
      currency: "USD",
    })
  })

  await test.step("the till says both amounts, and the order is not fully paid", async () => {
    await expect(
      page.getByText(
        translateParams("en", "orders.announced.written", {
          number: 1,
          table: "Bar",
          amount: translateParams("en", "orders.written.arrivedOf", {
            arrived: "$80.00",
            named: "$90.00",
          }),
          text: "2x pivo",
        })
      )
    ).toBeVisible()
    await expect(orderCard).toContainText(
      translateParams("en", "orders.written.arrivedOf", {
        arrived: "$80.00",
        named: "$90.00",
      })
    )
    await expect(orderCard).toContainText(
      translate("en", "orders.notFullyPaid")
    )
  })

  await test.step("the guest sees what is left and pays it", async () => {
    await expect(
      orderStatus(guest, "selfPay.order.left", {
        number: 1,
        amount: "$10.00",
      })
    ).toBeVisible({ timeout: 45_000 })
    await guest
      .getByRole("button", {
        name: translateParams("en", "selfPay.order.payRest", {
          amount: "$10.00",
        }),
      })
      .click()
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 1000,
      currency: "USD",
    })
  })

  await test.step("the order is paid for both", async () => {
    await expect(
      orderStatus(guest, "selfPay.order.paid", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
    await expect(orderCard).toContainText(translate("en", "orders.paid"))
    await expect(orderCard).not.toContainText(
      translate("en", "orders.notFullyPaid")
    )
  })
})

test("a text of <b>pivo</b> {amount} $& shows its characters in the announcement, To serve and the bill", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const text = "<b>pivo</b> {amount} $&"
  const orderCard = page.getByTestId("order-to-serve")
  const guestAddress = await test.step("seed the bar", () => seedBar(page))
  const guest = await context.newPage()

  await test.step("a guest writes markup and placeholders and pays", async () => {
    await gotoOrders(page)
    await writeOrder(guest, guestAddress, { text, amount: "90.00" })
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 9000,
      currency: "USD",
    })
  })

  await test.step("the announcement shows its characters", async () => {
    await expect(
      page.getByText(`New order 1 · Bar · $90.00 · ${text}`, { exact: true })
    ).toBeVisible()
  })

  await test.step("To serve shows its characters", async () => {
    await expect(orderCard).toContainText(text)
    await expect(orderCard.locator("b")).toHaveCount(0)
  })

  await test.step("the bill shows its characters", async () => {
    await gotoPage(page, "/activity/bills", "en", "activity.title")
    await page.getByRole("link").filter({ hasText: "$90.00" }).first().click()
    await page
      .getByRole("heading", { name: translate("en", "billDetail.title") })
      .waitFor()
    await expect(page.getByText(text, { exact: true })).toBeVisible()
    await expect(page.locator("main b")).toHaveCount(0)
  })
})
