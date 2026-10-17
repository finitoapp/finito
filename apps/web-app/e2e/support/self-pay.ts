import type { Language } from "@payky/app-shared/i18n/resources"
import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import type { NostrEvent } from "@payky/core/integrations/nostr/nostr-event"
import { createFakeNostrRelay } from "@payky/core/integrations/nostr/nostr-relay-test-fixtures"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
  type Page,
} from "@playwright/test"
import { addCatalogItem, addTable, injectScanCode } from "./bill.ts"
import { nameParam, translate, translateParams } from "./i18n.ts"
import {
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./navigation.ts"

export function createFakeNostrRelays(urls: ReadonlyArray<string>) {
  const relays = new Map(
    urls.map((url) => [
      new URL(url).origin,
      { url, fake: createFakeNostrRelay() },
    ])
  )
  const relayOf = (url: string) => {
    const relay = relays.get(new URL(url).origin)
    if (relay === undefined) throw new Error(`No fake relay for ${url}.`)
    return relay
  }

  return {
    received: (): ReadonlyArray<NostrEvent> =>
      [...relays.values()].flatMap(({ fake }) => fake.received()),
    receivedBy: (url: string): ReadonlyArray<NostrEvent> =>
      relayOf(url).fake.received(),
    refuse: (url: string, refuse: boolean): void => {
      relayOf(url).fake.refuseEvents(refuse)
    },
    route: async (context: BrowserContext) => {
      const connected = new Set<string>()
      await context.routeWebSocket(
        (url) => relays.has(url.origin),
        (webSocket) => {
          const { url, fake } = relayOf(webSocket.url())
          connected.add(url)
          const socket = fake.createSocket()
          socket.addEventListener("message", ({ data }) => {
            webSocket.send(String(data))
          })
          webSocket.onMessage((message) => {
            socket.send(String(message))
          })
          webSocket.onClose(() => {
            socket.close()
          })
        }
      )
      return { connected: (): ReadonlySet<string> => new Set(connected) }
    },
  }
}

export type FakeNostrRelays = ReturnType<typeof createFakeNostrRelays>

export const publishedSelectionIds = (
  relays: FakeNostrRelays
): ReadonlySet<string> =>
  new Set(
    relays
      .received()
      .filter(({ tags }) =>
        tags.some(([name, value]) => name === "d" && value === "")
      )
      .map(({ id }) => id)
  )

export async function routeFakeNostrRelays(
  context: BrowserContext
): Promise<FakeNostrRelays> {
  const relays = createFakeNostrRelays(defaultSelfPayRelays)
  await relays.route(context)
  return relays
}

export async function newGuestContext(
  browser: Browser,
  relays: FakeNostrRelays,
  options: BrowserContextOptions = {}
): Promise<BrowserContext> {
  const context = await browser.newContext(options)
  await relays.route(context)
  return context
}

export async function seedActiveFioPlugin(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.__e2eSeedActiveFioPlugin?.()
  })
}

async function openTableSelfPaySwitch(
  page: Page,
  language: Language,
  tableName: string
) {
  await gotoPage(page, "/catalog/tables", language, "catalog.tables.title")
  await page.getByRole("link", { name: new RegExp(tableName) }).click()
  await page
    .getByRole("heading", {
      name: translate(language, "catalog.tables.form.title.edit"),
    })
    .waitFor()
  return page.getByRole("switch", {
    name: translate(language, "catalog.tables.selfPay.enabled"),
  })
}

async function readGuestAddress(page: Page, language: Language) {
  const guestLink = page.getByRole("link", {
    name: translate(language, "catalog.tables.selfPay.open"),
  })
  await guestLink.waitFor()
  const address = await guestLink.getAttribute("href")
  if (address === null) throw new Error("Expected the table's guest address.")
  return address
}

export async function enableTableSelfPay(
  page: Page,
  language: Language,
  tableName: string
): Promise<string> {
  const toggle = await openTableSelfPaySwitch(page, language, tableName)
  await toggle.click()
  return readGuestAddress(page, language)
}

export async function readTableSelfPayAddress(
  page: Page,
  language: Language,
  tableName: string
): Promise<string> {
  await openTableSelfPaySwitch(page, language, tableName)
  return readGuestAddress(page, language)
}

export async function disableTableSelfPay(
  page: Page,
  language: Language,
  tableName: string
): Promise<void> {
  const toggle = await openTableSelfPaySwitch(page, language, tableName)
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await waitForLocalWriteToSettle(page)
}

export async function openTableBill(
  page: Page,
  language: Language,
  {
    table,
    items,
  }: { readonly table: string; readonly items: ReadonlyArray<string> }
): Promise<string> {
  await gotoPosOverview(page, language)
  await page
    .getByTestId("table-tile")
    .filter({ hasText: table })
    .getByRole("link", { name: translate(language, "tables.tile.newBill") })
    .click()
  for (const name of items) {
    await page
      .getByRole("button", { name: nameParam("bill.brick.add.aria", name) })
      .click()
  }
  await expect
    .poll(() => new URL(page.url()).searchParams.get("billId"))
    .not.toBeNull()
  await waitForLocalWriteToSettle(page)
  const billId = new URL(page.url()).searchParams.get("billId")
  if (billId === null) throw new Error("Expected the bill's id in the URL.")
  return billId
}

export async function receiveBankTransfer(
  page: Page,
  transfer: {
    readonly amount: number
    readonly currency: FiatCurrency
    readonly variableSymbol: string
    readonly recipientMessage: string
  }
): Promise<void> {
  await page.evaluate(async (value) => {
    await window.__e2eReceiveBankTransfer?.(value)
  }, transfer)
}

export async function receiveShownBankTransfer(
  page: Page,
  {
    payer,
    language,
    ...transfer
  }: {
    readonly payer: Page
    readonly language: Language
    readonly amount: number
    readonly currency: FiatCurrency
    readonly recipientMessage?: string
  }
): Promise<void> {
  const fieldValue = async (
    key: "selfPay.bank.variableSymbol" | "selfPay.bank.message"
  ) =>
    (await payer
      .getByText(translate(language, key), { exact: true })
      .locator("xpath=following-sibling::*[1]")
      .textContent()) ?? ""
  await receiveBankTransfer(page, {
    ...transfer,
    variableSymbol: await fieldValue("selfPay.bank.variableSymbol"),
    recipientMessage:
      transfer.recipientMessage ?? (await fieldValue("selfPay.bank.message")),
  })
}

export async function receiveLightningPayment(
  page: Page,
  payment: { readonly lnInvoice: string; readonly amountSats: number }
): Promise<void> {
  await page.evaluate(async (value) => {
    await window.__e2eReceiveLightningPayment?.(value)
  }, payment)
}

export async function addBillLines(
  page: Page,
  billId: string,
  lines: ReadonlyArray<{ readonly name: string; readonly amount: number }>
): Promise<void> {
  await page.evaluate(
    async ([id, values]) => {
      await window.__e2eAddBillLines?.(id, values)
    },
    [billId, lines] as const
  )
  await waitForLocalWriteToSettle(page)
}

export async function fakeSelfPayLightning(
  context: BrowserContext,
  btcPrice: number
): Promise<void> {
  await context.addInitScript(() => {
    const identityPublicKey = `03${"cd".repeat(32)}`
    window.__e2eSparkWallet = {
      getIdentityPublicKey: async () => identityPublicKey,
      getWalletSettings: async () => ({
        ownerIdentityPublicKey: identityPublicKey,
        privateEnabled: true,
      }),
    }
    window.__e2eGuestInvoiceWallet = true
  })
  await context.route("https://api.yadio.io/exrates/**", async (route) => {
    await route.fulfill({ json: { BTC: btcPrice, timestamp: Date.now() } })
  })
}

export async function pickShareChoice(
  guest: Page,
  choice:
    | "selfPay.choice.remainder"
    | "selfPay.choice.equal"
    | "selfPay.choice.items"
): Promise<void> {
  await guest.getByRole("button", { name: translate("en", choice) }).click()
}

export async function pickEqualShares(
  guest: Page,
  people: number
): Promise<void> {
  await pickShareChoice(guest, "selfPay.choice.equal")
  const increase = guest
    .getByRole("group", {
      name: translate("en", "selfPay.choice.equal.people"),
    })
    .getByRole("button", { name: translate("en", "selfPay.people.increase") })
  for (let person = 2; person < people; person += 1) {
    await increase.click()
  }
}

export async function pickLineUnits(
  guest: Page,
  { line, units }: { readonly line: string; readonly units: number }
): Promise<void> {
  const increase = guest.getByRole("button", {
    name: nameParam("selfPay.line.units.increase", line),
  })
  for (let unit = 0; unit < units; unit += 1) {
    await increase.click()
  }
}

export async function shareLine(
  guest: Page,
  { line, people }: { readonly line: string; readonly people: number }
): Promise<void> {
  await guest
    .getByRole("button", { name: nameParam("selfPay.line.share.label", line) })
    .click()
  const increase = guest
    .getByRole("group", { name: nameParam("selfPay.line.people.label", line) })
    .getByRole("button", { name: translate("en", "selfPay.people.increase") })
  for (let person = 2; person < people; person += 1) {
    await increase.click()
  }
}

export const selfPayRelaySwitch = (
  page: Page,
  language: Language,
  url: string
) =>
  page.getByRole("switch", {
    name: translateParams(language, "settings.security.selfPayRelays.toggle", {
      url,
    }),
  })

export async function switchOffSelfPayRelay(
  page: Page,
  language: Language,
  url: string
): Promise<void> {
  const toggle = selfPayRelaySwitch(page, language, url)
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await waitForLocalWriteToSettle(page)
}

export async function submitSelfPayRelay(
  page: Page,
  language: Language,
  url: string
): Promise<void> {
  await page
    .getByRole("textbox", {
      name: translate(language, "settings.security.selfPayRelays.url.label"),
    })
    .fill(url)
  await page
    .getByRole("button", {
      name: translate(language, "settings.security.selfPayRelays.add"),
    })
    .click()
}

export async function addSelfPayRelay(
  page: Page,
  language: Language,
  url: string
): Promise<void> {
  await submitSelfPayRelay(page, language, url)
  await expect(selfPayRelaySwitch(page, language, url)).toBeChecked()
  await waitForLocalWriteToSettle(page)
}

export async function checkTableSticker(
  page: Page,
  language: Language,
  address: string
): Promise<void> {
  await gotoPage(page, "/catalog/tables", language, "catalog.tables.title")
  await page
    .getByRole("button", {
      name: translate(language, "catalog.tables.sticker.check"),
    })
    .click()
  await injectScanCode(page, address)
}

export async function seedPizzaAndBeerBill(
  page: Page,
  table: string
): Promise<{ readonly guestAddress: string; readonly billId: string }> {
  await seedActiveFioPlugin(page)
  await addTable(page, "en", { name: table, seatCount: "4" })
  await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
  await addCatalogItem(page, "en", { name: "Beer", price: "45" })
  const guestAddress = await enableTableSelfPay(page, "en", table)
  const billId = await openTableBill(page, "en", {
    table,
    items: ["Pizza", "Beer"],
  })
  return { guestAddress, billId }
}

export async function payAllOfTheBeer(page: Page, guest: Page): Promise<void> {
  await pickShareChoice(guest, "selfPay.choice.items")
  await pickLineUnits(guest, { line: "Beer", units: 1 })
  await guest
    .getByRole("button", {
      name: translateParams("en", "selfPay.pay.total", { amount: "$45.00" }),
    })
    .click()
  await receiveShownBankTransfer(page, {
    payer: guest,
    language: "en",
    amount: 4500,
    currency: "USD",
  })
}
