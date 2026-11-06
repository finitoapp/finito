import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import type { Page } from "@playwright/test"

import { addTable } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate, translateParams } from "./support/i18n.ts"
import { toggleInlineSwitch } from "./support/inline-edit.ts"
import { gotoPage } from "./support/navigation.ts"
import {
  enableTableSelfPay,
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
  key: "selfPay.order.paid" | "selfPay.order.left",
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

test("staff see New order 1 · Bar · $90.00 · 2x pivo, open it and mark it served", async ({
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

  await test.step("Served takes it off the list", async () => {
    await orderCard
      .getByRole("button", { name: translate("en", "orders.served") })
      .click()
    await expect(orderCard).toHaveCount(0)
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
