import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import type { Page } from "@playwright/test"

import { addCatalogItem, addTable } from "./support/bill.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate, translateParams } from "./support/i18n.ts"
import {
  enableTableSelfPay,
  openTableBill,
  publishedSelectionIds,
  receiveShownBankTransfer,
  routeFakeNostrRelays,
  seedActiveFioPlugin,
  seedMenu,
} from "./support/self-pay.ts"

const coffeeAndCake = [
  { name: "Coffee", amount: 6500 },
  { name: "Cake", amount: 8900 },
]

const seedCafe = async (
  page: Page,
  table: string,
  items: typeof coffeeAndCake = coffeeAndCake
) => {
  await seedActiveFioPlugin(page)
  await addTable(page, "en", { name: table, seatCount: "4" })
  const guestAddress = await enableTableSelfPay(page, "en", table)
  await seedMenu(page, { items })
  return guestAddress
}

const oneMore = (guest: Page, name: string) =>
  guest.getByRole("button", {
    name: nameParam("selfPay.menu.quantity.increase", name),
  })

const openMenu = async (guest: Page, guestAddress: string) => {
  await guest.goto(guestAddress)
  await expect(oneMore(guest, "Coffee")).toBeVisible({ timeout: 45_000 })
}

const pickItems = async (
  guest: Page,
  items: ReadonlyArray<readonly [string, number]>
) => {
  for (const [name, quantity] of items) {
    for (let unit = 0; unit < quantity; unit += 1) {
      await oneMore(guest, name).click()
    }
  }
}

const payButton = (guest: Page, amount: string) =>
  guest.getByRole("button", {
    name: translateParams("en", "selfPay.pay.total", { amount }),
  })

const noteField = (guest: Page) =>
  guest.getByRole("textbox", {
    name: translate("en", "selfPay.order.note.label"),
  })

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

test("a guest orders two coffees and a cake with a note and a tip, and the bank QR asks for it under an order reference", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  const relays = await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with coffee and cake in the menu", () =>
      seedCafe(page, "Table 3"))
  const guest = await context.newPage()

  await test.step("the guest picks two coffees and a cake, writes a note and tips 10 %", async () => {
    await openMenu(guest, guestAddress)
    await pickItems(guest, [
      ["Coffee", 2],
      ["Cake", 1],
    ])
    await noteField(guest).fill("bez cukru")
    await guest
      .getByRole("button", {
        name: translateParams("en", "selfPay.tip.percent", { percent: "10" }),
      })
      .click()
  })

  await test.step("paying publishes the order and asks for 240.90 with a reference from 9 and a PK1 message", async () => {
    const selectionsBefore = publishedSelectionIds(relays).size
    await payButton(guest, "$240.90").click()
    await expect(
      guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toBeVisible()
    expect(await bankField(guest, "selfPay.bank.amount")).toBe("240.90")
    expect(await bankField(guest, "selfPay.bank.variableSymbol")).toMatch(
      /^9\d{9}$/u
    )
    expect(await bankField(guest, "selfPay.bank.message")).toMatch(
      /^PK1[A-Z2-7]{32}$/u
    )
    expect(publishedSelectionIds(relays).size).toBe(selectionsBefore + 1)
  })
})

test("the note for the kitchen does not take a 141st character", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with coffee and cake in the menu", () =>
      seedCafe(page, "Table 6"))
  const guest = await context.newPage()

  await test.step("the guest types 140 characters and then one more", async () => {
    await openMenu(guest, guestAddress)
    await pickItems(guest, [["Coffee", 1]])
    await noteField(guest).fill("a".repeat(140))
    await noteField(guest).press("b")
  })

  await test.step("the note keeps the first 140 characters", async () => {
    await expect(noteField(guest)).toHaveValue("a".repeat(140))
    await expect(
      guest.getByText(
        translateParams("en", "selfPay.order.note.length", {
          length: 140,
          max: 140,
        })
      )
    ).toBeVisible()
  })
})

test("a table with an open bill offers paying the bill and ordering from the menu", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with a pizza bill and coffee and cake in the menu", async () => {
      await seedActiveFioPlugin(page)
      await addTable(page, "en", { name: "Table 5", seatCount: "4" })
      await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
      const address = await enableTableSelfPay(page, "en", "Table 5")
      await seedMenu(page, { items: coffeeAndCake })
      await openTableBill(page, "en", { table: "Table 5", items: ["Pizza"] })
      return address
    })
  const guest = await context.newPage()

  await test.step("the guest page opens on the bill", async () => {
    await guest.goto(guestAddress)
    await expect(payButton(guest, "$101.00")).toBeVisible({ timeout: 45_000 })
    await expect(
      guest.getByRole("tab", { name: translate("en", "selfPay.menu.tab.bill") })
    ).toHaveAttribute("aria-selected", "true")
  })

  await test.step("the menu tab offers the coffee and the cake", async () => {
    await guest
      .getByRole("tab", { name: translate("en", "selfPay.menu.tab.menu") })
      .click()
    await expect(oneMore(guest, "Coffee")).toBeVisible({ timeout: 45_000 })
    await expect(oneMore(guest, "Cake")).toBeVisible()
    await expect(payButton(guest, "$101.00")).toHaveCount(0)
  })
})

const orderCoffeesAndCake = async (guest: Page, guestAddress: string) => {
  await openMenu(guest, guestAddress)
  await pickItems(guest, [
    ["Coffee", 2],
    ["Cake", 1],
  ])
  await payButton(guest, "$219.00").click()
}

test("a guest sees their order confirmed as order 1 once the money arrives, and again after reopening the page", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with coffee and cake in the menu", () =>
      seedCafe(page, "Table 4"))
  const guest = await context.newPage()

  await test.step("the guest orders two coffees and a cake and the transfer arrives", async () => {
    await orderCoffeesAndCake(guest, guestAddress)
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 21_900,
      currency: "USD",
    })
  })

  await test.step("the restaurant confirms it as order 1, paid, and the payment closes", async () => {
    await expect(
      orderStatus(guest, "selfPay.order.paid", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
    await expect(
      guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toHaveCount(0)
  })

  await test.step("back on the page, the order still shows as confirmed and paid", async () => {
    await guest.reload()
    await expect(
      orderStatus(guest, "selfPay.order.paid", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
  })
})

test("a guest who paid an order short sees what is left, also after reopening the page, pays the rest and sees it paid", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with coffee and cake in the menu", () =>
      seedCafe(page, "Table 2"))
  const guest = await context.newPage()
  const left = orderStatus(guest, "selfPay.order.left", {
    number: 1,
    amount: "$19.00",
  })

  await test.step("the guest orders for 219.00 and 200.00 arrives", async () => {
    await orderCoffeesAndCake(guest, guestAddress)
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 20_000,
      currency: "USD",
    })
    await expect(left).toBeVisible({ timeout: 45_000 })
  })

  await test.step("back on the page, the order still shows 19.00 left", async () => {
    await guest.reload()
    await expect(left).toBeVisible({ timeout: 45_000 })
  })

  await test.step("the guest pays the rest and sees the order paid", async () => {
    await guest
      .getByRole("button", {
        name: translateParams("en", "selfPay.order.payRest", {
          amount: "$19.00",
        }),
      })
      .click()
    expect(await bankField(guest, "selfPay.bank.amount")).toBe("19.00")
    await receiveShownBankTransfer(page, {
      payer: guest,
      language: "en",
      amount: 1900,
      currency: "USD",
    })
    await expect(
      orderStatus(guest, "selfPay.order.paid", { number: 1 })
    ).toBeVisible({ timeout: 45_000 })
  })
})

test("a guest who never pays an order is told the payment was not seen once the wait is over, removes the order, and it stays gone", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with coffee and cake in the menu", () =>
      seedCafe(page, "Table 6"))
  const guest = await context.newPage()
  await guest.clock.install()
  const orders = guest.getByRole("heading", {
    name: translate("en", "selfPay.order.list.title"),
  })

  await test.step("the guest orders and sends no money", async () => {
    await orderCoffeesAndCake(guest, guestAddress)
    await expect(
      guest
        .getByRole("main")
        .getByText(translate("en", "selfPay.order.waiting"))
    ).toBeVisible()
  })

  await test.step("past the wait, the order says the payment was not seen", async () => {
    await guest.clock.fastForward("10:10")
    await expect(
      guest.getByRole("main").getByText(translate("en", "selfPay.order.unseen"))
    ).toBeVisible()
    await expect(
      guest
        .getByRole("main")
        .getByText(translate("en", "selfPay.order.unseen.description"))
    ).toBeVisible()
  })

  await test.step("the guest removes the order, and it stays gone after a reload", async () => {
    await guest
      .getByRole("button", { name: translate("en", "selfPay.order.remove") })
      .click()
    await expect(orders).toHaveCount(0)
    await expect(oneMore(guest, "Coffee")).toBeVisible()
    await guest.reload()
    await expect(oneMore(guest, "Coffee")).toBeVisible({ timeout: 45_000 })
    await expect(orders).toHaveCount(0)
  })
})

test("when no relay takes the order, the guest is asked to order with the staff and offered no payment", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  const relays = await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with coffee and cake in the menu", () =>
      seedCafe(page, "Table 8"))
  const guest = await context.newPage()

  await test.step("the guest picks a coffee while every relay refuses events", async () => {
    await openMenu(guest, guestAddress)
    for (const url of defaultSelfPayRelays) {
      relays.refuse(url, true)
    }
    await pickItems(guest, [["Coffee", 1]])
    await payButton(guest, "$65.00").click()
  })

  await test.step("the page asks to order with the staff and shows no payment", async () => {
    await expect(guest.getByRole("alert")).toHaveText(
      translate("en", "selfPay.order.refused")
    )
    await expect(
      guest.getByRole("img", { name: translate("en", "selfPay.bank.qr") })
    ).toHaveCount(0)
    await expect(
      guest.getByText(translate("en", "selfPay.bank.variableSymbol"))
    ).toHaveCount(0)
  })
})

test("with nothing in the menu, the guest page says ordering is not available right now", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  await routeFakeNostrRelays(context)
  const guestAddress =
    await test.step("seed a table with ordering on and an empty menu", () =>
      seedCafe(page, "Table 9", []))
  const guest = await context.newPage()

  await test.step("the guest page asks to order with the staff", async () => {
    await guest.goto(guestAddress)
    await expect(
      guest.getByRole("heading", {
        name: translate("en", "selfPay.order.unavailable.title"),
      })
    ).toBeVisible({ timeout: 45_000 })
    await expect(
      guest.getByText(translate("en", "selfPay.order.unavailable.description"))
    ).toBeVisible()
    await expect(
      guest.getByText(translate("en", "selfPay.empty.title"))
    ).toHaveCount(0)
  })
})
