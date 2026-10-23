import { bytesToHex } from "@noble/hashes/utils.js"

import { defaultSelfPayRelays } from "@payky/core/integrations/nostr/nostr-default-relays"
import { parseTableSelfPayAddress } from "@payky/core/modules/table-self-pay/table-self-pay-address-utils"
import { addCatalogItem, addTable } from "./support/bill.ts"
import { colorContrast } from "./support/color-contrast.ts"
import { expect, screenshotDir, test } from "./support/fixtures.ts"
import { nameParam, translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import {
  addSelfPayRelay,
  checkTableSticker,
  createFakeNostrRelays,
  enableTableSelfPay,
  openTableBill,
  readTableSelfPayAddress,
  seedActiveFioPlugin,
  selfPayRelaySwitch,
  submitSelfPayRelay,
  switchOffSelfPayRelay,
} from "./support/self-pay.ts"

const customRelay = "wss://relay.payky.test"

test("the security card keeps the last active relay on", async ({
  seededPage: page,
  context,
}) => {
  await createFakeNostrRelays([...defaultSelfPayRelays, customRelay]).route(
    context
  )
  const [first, second, third, fourth, last] = defaultSelfPayRelays

  await test.step("the card lists the five default relays, all on", async () => {
    await gotoPage(page, "/settings/security", "en", "settings.security.title")
    await expect(
      page.getByText(
        translate("en", "settings.security.selfPayRelays.default"),
        {
          exact: true,
        }
      )
    ).toHaveCount(5)
    for (const url of defaultSelfPayRelays) {
      await expect(selfPayRelaySwitch(page, "en", url)).toBeChecked()
    }
  })

  await test.step("switching four off leaves the fifth on, locked and explained", async () => {
    const lastActive = page.getByText(
      translate("en", "settings.security.selfPayRelays.lastActive")
    )
    await expect(lastActive).toBeHidden()
    for (const url of [first, second, third, fourth]) {
      await switchOffSelfPayRelay(page, "en", url)
    }
    await expect(selfPayRelaySwitch(page, "en", last)).toBeChecked()
    await expect(selfPayRelaySwitch(page, "en", last)).toBeDisabled()
    await expect(lastActive).toBeVisible()
  })

  await test.step("an https URL is rejected", async () => {
    await submitSelfPayRelay(page, "en", "https://relay.payky.test")
    await expect(
      page.getByText(
        translate("en", "settings.security.selfPayRelays.url.invalid")
      )
    ).toBeVisible()
  })

  await test.step("adding a wss relay unlocks the fifth", async () => {
    await addSelfPayRelay(page, "en", customRelay)
    await expect(selfPayRelaySwitch(page, "en", last)).toBeEnabled()
    await page.screenshot({
      path: `${screenshotDir}/self-pay-relays-settings.png`,
      fullPage: true,
    })
  })
})

test("a table names the relays it publishes to and the guest reads only those", async ({
  seededPage: page,
  context,
  browser,
}) => {
  test.setTimeout(120_000)
  const relays = createFakeNostrRelays([...defaultSelfPayRelays, customRelay])
  await relays.route(context)
  const [droppedRelay, ...keptRelays] = defaultSelfPayRelays
  const publishedRelays = [...keptRelays, customRelay]
  let oldAddress = ""
  let newAddress = ""
  let tablePublicKey = ""

  await test.step("seed a table with self-pay on and an open bill", async () => {
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 3", seatCount: "4" })
    await addCatalogItem(page, "en", { name: "Pizza", price: "101" })
    oldAddress = await enableTableSelfPay(page, "en", "Table 3")
    expect(parseTableSelfPayAddress(oldAddress)?.relays).toEqual([])
    await openTableBill(page, "en", { table: "Table 3", items: ["Pizza"] })
  })

  await test.step("switch the first default off and add a custom relay", async () => {
    await gotoPage(page, "/settings/security", "en", "settings.security.title")
    await switchOffSelfPayRelay(page, "en", droppedRelay)
    await addSelfPayRelay(page, "en", customRelay)
  })

  await test.step("the table's address names the relays after its keys", async () => {
    newAddress = await readTableSelfPayAddress(page, "en", "Table 3")
    const parsed = parseTableSelfPayAddress(newAddress)
    if (parsed === null) throw new Error("Expected a table address.")
    expect(parsed.relays).toEqual(publishedRelays)
    tablePublicKey = bytesToHex(parsed.publicKey)
  })

  await test.step("the custom relay receives the table's view", async () => {
    await expect
      .poll(() =>
        relays
          .receivedBy(customRelay)
          .some(({ pubkey }) => pubkey === tablePublicKey)
      )
      .toBe(true)
  })

  await test.step("a guest's phone reads the view from exactly those relays", async () => {
    const guestContext = await browser.newContext()
    try {
      const guestSockets = await relays.route(guestContext)
      const guest = await guestContext.newPage()
      await guest.goto(newAddress)
      await guest.getByRole("heading", { name: "Table 3" }).waitFor()
      await expect
        .poll(() => [...guestSockets.connected()].sort())
        .toEqual([...publishedRelays].sort())
    } finally {
      await guestContext.close()
    }
  })

  await test.step("the sticker check flags the old sticker and accepts the new one", async () => {
    await checkTableSticker(page, "en", oldAddress)
    await expect(
      page.getByText(
        nameParam("catalog.tables.sticker.relaysChanged", "Table 3")
      )
    ).toBeVisible()
    await checkTableSticker(page, "en", newAddress)
    await expect(
      page.getByText(nameParam("catalog.tables.sticker.current", "Table 3"))
    ).toBeVisible()
  })
})

test("a publish every relay refused is marked on both cards, and a retry clears it", async ({
  seededPage: page,
  context,
}) => {
  test.setTimeout(120_000)
  const relays = createFakeNostrRelays(defaultSelfPayRelays)
  await relays.route(context)
  const cannotSee = page.getByRole("alert").filter({
    hasText: translate("en", "catalog.tables.selfPay.noRelayAccepted.title"),
  })
  const retry = cannotSee.getByRole("button", {
    name: translate("en", "catalog.tables.selfPay.noRelayAccepted.retry"),
  })

  await test.step("every relay refuses the table's publish", async () => {
    for (const url of defaultSelfPayRelays) {
      relays.refuse(url, true)
    }
    await seedActiveFioPlugin(page)
    await addTable(page, "en", { name: "Table 5", seatCount: "4" })
    await enableTableSelfPay(page, "en", "Table 5")
  })

  await test.step("the table's card says guests cannot see its bill", async () => {
    await expect(cannotSee).toBeVisible({ timeout: 45_000 })
    await expect(
      cannotSee.getByText(
        translate("en", "catalog.tables.selfPay.noRelayAccepted.description")
      )
    ).toBeVisible()
    expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  })

  await test.step("the relay card marks each refusing relay", async () => {
    await gotoPage(page, "/settings/security", "en", "settings.security.title")
    for (const url of defaultSelfPayRelays) {
      await expect(
        page
          .getByRole("listitem")
          .filter({ has: selfPayRelaySwitch(page, "en", url) })
      ).toContainText(
        translate("en", "settings.security.selfPayRelays.refused")
      )
    }
  })

  await test.step("the refused mark reads at 4.5:1 in light and dark mode", async () => {
    const refused = page
      .getByText(translate("en", "settings.security.selfPayRelays.refused"))
      .first()
    const html = page.locator("html")
    const contrast = () =>
      colorContrast([refused, "color"], [refused, "background"])
    await expect(html).not.toHaveClass(/dark/u)
    await expect.poll(contrast).toBeGreaterThanOrEqual(4.5)
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(html).toHaveClass(/dark/u)
    await expect.poll(contrast).toBeGreaterThanOrEqual(4.5)
    await page.emulateMedia({ colorScheme: "light" })
  })

  await test.step("once the relays accept again, a retry clears the warning", async () => {
    for (const url of defaultSelfPayRelays) {
      relays.refuse(url, false)
    }
    await readTableSelfPayAddress(page, "en", "Table 5")
    await retry.click()
    await expect(cannotSee).toBeHidden({ timeout: 45_000 })
    await gotoPage(page, "/settings/security", "en", "settings.security.title")
    await expect(
      page.getByText(translate("en", "settings.security.selfPayRelays.refused"))
    ).toHaveCount(0)
  })
})
