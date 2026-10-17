import type { Page } from "@playwright/test"

import {
  openSettingsEntry,
  ownerPin,
  pinPrompt,
  turnOnAccessControl,
  typePin,
} from "./support/access.ts"
import { addCatalogItem, startNewBill } from "./support/bill.ts"
import { simulateBillModifiedDuringPayment } from "./support/collisions.ts"
import { expect, test } from "./support/fixtures.ts"
import {
  nameParam,
  translate,
  translateParams,
  translateValue,
} from "./support/i18n.ts"
import {
  gotoPage,
  menuHome,
  openMenuTab,
  openMenuTabFromHome,
} from "./support/navigation.ts"
import { completeOnboardingDefaults } from "./support/onboarding.ts"
import {
  overpaymentCard,
  submitOverpaymentResolution,
} from "./support/overpayment.ts"
import {
  createPayment,
  markCashPaidAndSettle,
  prepareIbanPayment,
  startBillAndBeginCashPayment,
} from "./support/payment.ts"

const newPin = "99887766"

const routeLock = (
  page: Page,
  permissionKey: Parameters<typeof translate>[1]
) =>
  page.getByRole("heading", {
    name: translate("en", "access.pin.why.route").replace(
      "{permission}",
      translate("en", permissionKey)
    ),
  })

const cancelPrompt = (prompt: ReturnType<typeof pinPrompt>) =>
  prompt
    .getByRole("button", { name: translate("en", "access.pin.cancel") })
    .click()

const goBackInApp = (page: Page) =>
  page.getByRole("button", { name: translate("en", "nav.back") }).click()

const openSettingsFromHome = (page: Page) =>
  openMenuTabFromHome(page, "en", "nav.settings")

const deviceAccountIds = async (page: Page) => {
  await page.waitForFunction(
    () => typeof window.__e2eDeviceAccountIds === "function"
  )
  return page.evaluate(
    async () => (await window.__e2eDeviceAccountIds?.()) ?? []
  )
}

test("every cart write that takes items off the bill asks a Basic device for the PIN", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  const addCoffee = page.getByRole("button", {
    name: nameParam("bill.brick.add.aria", "Coffee"),
  })
  const removeCoffee = page.getByRole("button", {
    name: nameParam("bill.brick.remove.aria", "Coffee"),
  })
  const summaryTrigger = page.getByTestId("bill-summary-trigger")
  const summaryPanel = page.getByTestId("bill-summary-panel")
  const removeLinesPrompt = pinPrompt(page, "en", "access.action.removeLines")
  const itemsCount = (count: number) =>
    expect(summaryTrigger).toContainText(
      translateValue("en", "bill.itemsCount", count)
    )

  await test.step("adding needs no PIN", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await startNewBill(page, "en")
    await addCoffee.click()
    await itemsCount(1)
    await addCoffee.click()
    await itemsCount(2)
  })

  await test.step("removing one asks; cancelling leaves the bill as it was", async () => {
    await removeCoffee.click()
    await expect(removeLinesPrompt).toBeVisible()
    await cancelPrompt(removeLinesPrompt)
    await expect(removeLinesPrompt).toBeHidden()
    await itemsCount(2)
  })

  await test.step("undoing an added item writes a removal, so it asks too", async () => {
    await summaryTrigger.click()
    await summaryPanel
      .getByRole("button", { name: translate("en", "bill.summary.undo") })
      .click()
    await expect(removeLinesPrompt).toBeVisible()
    await typePin(page, "en", ownerPin)
    await itemsCount(1)
  })

  await test.step("clearing asks again: the prompt started no session", async () => {
    await summaryPanel
      .getByRole("button", { name: translate("en", "bill.summary.clear") })
      .click()
    await expect(removeLinesPrompt).toBeVisible()
    await typePin(page, "en", ownerPin)
    await itemsCount(0)
  })

  await test.step("discarding the bill asks for the PIN", async () => {
    // The open summary dims the items; closing it uncovers them again.
    await summaryTrigger.click()
    await addCoffee.click()
    await itemsCount(1)
    await page
      .getByRole("button", { name: translate("en", "bill.discard") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "bill.discard.confirm.confirm"),
      })
      .click()
    const discardPrompt = pinPrompt(page, "en", "access.action.discardBill")
    await expect(discardPrompt).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(page.getByTestId("no-table-tile")).toContainText(
      translate("en", "home.pos.noTable.empty")
    )
  })
})

test("cancelling a payment and confirming money by hand ask a Basic device for the PIN", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  const paidPanel = page
    .getByTestId("payment-paid-panel")
    .getByText(translate("en", "paymentWait.paid"))

  await test.step("confirming cash asks; cancelling the prompt confirms nothing", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await createPayment(page, "en", "5")
    await page
      .getByRole("button", {
        name: translate("en", "paymentWait.cashPaid.action"),
      })
      .click()
    const prompt = pinPrompt(page, "en", "access.action.markCashPaid")
    await expect(prompt).toBeVisible()
    await cancelPrompt(prompt)
    await expect(prompt).toBeHidden()
    // The panel stays mounted and is shown by `aria-hidden` (e2e/AGENTS.md).
    await expect(page.getByTestId("payment-paid-panel")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })

  await test.step("cancelling the payment takes the PIN", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentWait.cancel") })
      .click()
    await expect(
      pinPrompt(page, "en", "access.action.cancelPayment")
    ).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(
      page.getByRole("button", { name: translate("en", "home.pay") })
    ).toBeVisible()
  })

  await test.step("confirming a bank transfer by hand takes the PIN", async () => {
    await createPayment(page, "en", "5")
    await prepareIbanPayment(page, "en")
    await page
      .getByRole("button", {
        name: translate("en", "paymentWait.ibanPaid.action"),
      })
      .click()
    await expect(
      pinPrompt(page, "en", "access.action.markIbanPaid")
    ).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(paidPanel).toBeVisible()
  })
})

test("keeping money paid above a bill asks a Basic device for the PIN", async ({
  seededPage: page,
}) => {
  await addCatalogItem(page, "en", { name: "Coffee", price: "5" })
  const billId =
    await test.step("pay 5.00 for a bill whose lines are then removed", async () => {
      const id = await startBillAndBeginCashPayment(page, "en")
      await simulateBillModifiedDuringPayment(page, id, "removeAll")
      await markCashPaidAndSettle(page, "en")
      return id
    })
  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  await test.step("keeping 3.00 takes the PIN, which names the choice, the amount and the bill", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await submitOverpaymentResolution(page, "en", {
      kind: "kept",
      amount: "3",
    })
    const prompt = pinPrompt(page, "en", "access.action.resolveOverpayment")
    await expect(prompt).toBeVisible()
    await expect(prompt.getByTestId("pin-prompt-detail")).toHaveText(
      translateParams("en", "overpayment.pinDetail", {
        action: translateParams("en", "overpayment.dialog.confirm.keep", {
          amount: "$3.00",
        }),
        bill: translateParams("en", "bill.list.label", { number: 1 }),
      })
    )
    await typePin(page, "en", ownerPin)
    await expect(overpaymentCard(page)).toContainText(
      translateParams("en", "overpayment.title", { amount: "$2.00" })
    )
  })
})

test("an Owner device still needs the PIN to change it, to turn access control off and to unblock", async ({
  seededPage: page,
}) => {
  const kitchenId = await page.evaluate(
    async () =>
      (await window.__e2eSeedDevice?.({
        name: "Kitchen tablet",
        blocked: true,
      })) ?? ""
  )
  await test.step("turn access control on, this device set to Owner", () =>
    turnOnAccessControl(page, "en", { preset: "owner" }))

  await test.step("a fresh start: no session, the device's own admin opens Access", () =>
    gotoPage(page, "/settings/access", "en", "access.title"))

  await test.step("changing the PIN asks for the current one", async () => {
    await page
      .getByRole("button", { name: translate("en", "access.changePin") })
      .click()
    await page.getByLabel(translate("en", "access.newPin.label")).fill(newPin)
    await page.getByLabel(translate("en", "access.newPin.repeat")).fill(newPin)
    await page
      .getByRole("button", { name: translate("en", "access.save") })
      .click()
    await expect(pinPrompt(page, "en", "access.action.changePin")).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(
      page.getByText(translate("en", "access.status.on"))
    ).toBeVisible()
  })

  await test.step("unblocking asks for it; cancelled, nothing is written", async () => {
    await page
      .getByTestId("access-devices")
      .getByRole("listitem")
      .filter({ hasText: "Kitchen tablet" })
      .getByRole("button", { name: translate("en", "access.device.unblock") })
      .click()
    const prompt = pinPrompt(page, "en", "access.action.unblock")
    await expect(prompt).toBeVisible()
    await cancelPrompt(prompt)
    await expect(prompt).toBeHidden()
    expect(
      await page.evaluate(
        async (id) => (await window.__e2eReadDevice?.(id))?.pinUnblockToken,
        kitchenId
      )
    ).toBeNull()
  })

  await test.step("turning off asks for it, and only the new PIN does", async () => {
    await page
      .getByRole("button", { name: translate("en", "access.turnOff") })
      .click()
    await typePin(page, "en", ownerPin)
    await expect(
      page.getByText(
        translate("en", "access.pin.wrong").replace("{count}", "4")
      )
    ).toBeVisible()
    await typePin(page, "en", newPin)
    // The wrong one is shown to the owner first (access/0006).
    await page
      .getByRole("button", {
        name: translate("en", "access.attempts.continue"),
      })
      .click()
    await expect(
      page.getByText(translate("en", "access.status.off"))
    ).toBeVisible()
  })

  await test.step("turning on again can reuse the PIN, after entering it", async () => {
    await page
      .getByRole("button", { name: translate("en", "access.turnOn") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "access.wizard.keepPin") })
      .click()
    await expect(pinPrompt(page, "en", "access.action.enable")).toBeVisible()
    await typePin(page, "en", newPin)
    await page
      .getByRole("button", { name: translate("en", "access.turnOn") })
      .click()
    await expect(
      page.getByText(translate("en", "access.status.on"))
    ).toBeVisible()
  })
})

test("a PIN session ends on a screen the device covers itself, and in the background", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on from inside the app, keeping its session", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await openSettingsFromHome(page)
    await openSettingsEntry(page, "en", "access.title")
    await turnOnAccessControl(page, "en", { navigate: false })
  })

  const itemsHeading = page.getByRole("heading", {
    name: translate("en", "catalog.items.title"),
  })

  await test.step("a free screen keeps the session going", async () => {
    await goBackInApp(page)
    await openMenuTab(page, "en", "nav.catalog")
    await expect(itemsHeading).toBeVisible()
  })

  await test.step("the app going to the background ends it", async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      })
      document.dispatchEvent(new Event("visibilitychange"))
      Reflect.deleteProperty(document, "visibilityState")
    })
    await expect(routeLock(page, "access.permission.catalog")).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(itemsHeading).toBeVisible()
  })

  await test.step("going home, which the device covers, ends it", async () => {
    await menuHome(page, "en").click()
    await expect(
      page.getByRole("button", { name: translate("en", "home.pay") })
    ).toBeVisible()
    await openMenuTabFromHome(page, "en", "nav.catalog")
    await expect(routeLock(page, "access.permission.catalog")).toBeVisible()
  })
})

test("a device without sell returns to its PIN screen when the session times out", async ({
  seededPage: page,
}) => {
  await page.clock.install()

  await test.step("turn access control on from inside the app, this device set to None", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await openSettingsFromHome(page)
    await openSettingsEntry(page, "en", "access.title")
    await turnOnAccessControl(page, "en", { preset: "none", navigate: false })
  })

  await test.step("five idle minutes on the settings list send it home, locked", async () => {
    await goBackInApp(page)
    await page
      .getByRole("heading", { name: translate("en", "settings.title") })
      .waitFor()
    await page.clock.fastForward("05:10")
    await expect(routeLock(page, "access.permission.sell")).toBeVisible()
    expect(new URL(page.url()).pathname).toBe("/")
  })
})

test("switching account ends the PIN session, also when switching back", async ({
  seededPage: page,
}) => {
  // A second account is a whole new local database.
  test.setTimeout(90_000)

  await test.step("turn access control on from inside the app, keeping its session", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await openSettingsFromHome(page)
    await openSettingsEntry(page, "en", "access.title")
    await turnOnAccessControl(page, "en", { navigate: false })
  })

  await test.step("create a second account without access control", async () => {
    await goBackInApp(page)
    await openSettingsEntry(page, "en", "settings.accounts.nav.title")
    await page
      .getByRole("button", { name: translate("en", "accountChoice.new.title") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.create.confirm.confirm"),
      })
      .click()
    await completeOnboardingDefaults(page, "en")
  })

  await test.step("switching back to the locked account asks for the PIN", async () => {
    await openSettingsFromHome(page)
    await openSettingsEntry(page, "en", "settings.accounts.nav.title")
    await page
      .getByTestId("account-list")
      .getByRole("listitem")
      .first()
      .getByRole("button", {
        name: translate("en", "settings.accounts.list.switch"),
      })
      .click()
    await expect(routeLock(page, "access.permission.admin")).toBeVisible()
  })
})

test("Settings → Access edits, renames and removes devices", async ({
  seededPage: page,
}) => {
  await page.evaluate(async () => {
    await window.__e2eSeedDevice?.({ name: "Old tablet", blocked: false })
  })
  await test.step("turn access control on", () =>
    turnOnAccessControl(page, "en"))

  const devices = page.getByTestId("access-devices").getByRole("listitem")
  const thisDevice = devices.filter({
    hasText: translate("en", "access.device.this"),
  })

  await test.step("a preset is a starting point the owner can adjust", async () => {
    await thisDevice
      .getByRole("button", {
        name: translate("en", "access.device.permissions"),
      })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox").click()
    await page
      .getByRole("option", {
        name: translate("en", "access.preset.manager"),
        exact: true,
      })
      .click()
    await expect(
      dialog.getByRole("checkbox", {
        name: translate("en", "access.permission.settings"),
      })
    ).toBeChecked()
    await dialog
      .getByRole("checkbox", {
        name: translate("en", "access.permission.admin"),
      })
      .click()
    await expect(
      dialog.getByText(translate("en", "access.device.adminWarning"))
    ).toBeVisible()
    await dialog
      .getByRole("button", { name: translate("en", "access.save") })
      .click()
    await expect(
      thisDevice.getByText(translate("en", "access.preset.owner"), {
        exact: true,
      })
    ).toBeVisible()
  })

  await test.step("renaming a device shows its new name", async () => {
    await thisDevice
      .getByRole("button", { name: translate("en", "access.device.rename") })
      .click()
    await page
      .getByLabel(translate("en", "access.device.name"))
      .fill("Front till")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: translate("en", "access.save") })
      .click()
    await expect(devices.filter({ hasText: "Front till" })).toHaveCount(1)
  })

  await test.step("removing another device takes it off the list", async () => {
    await devices
      .filter({ hasText: "Old tablet" })
      .getByRole("button", { name: translate("en", "access.device.remove") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "access.device.remove.confirm"),
      })
      .click()
    await expect(devices.filter({ hasText: "Old tablet" })).toHaveCount(0)
    await expect(devices).toHaveCount(1)
  })
})

test("a typed URL neither removes an account nor reopens onboarding", async ({
  seededPage: page,
}) => {
  test.setTimeout(90_000)

  await test.step("create a second account; the first one is now inactive", async () => {
    await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
    await page
      .getByRole("button", { name: translate("en", "accountChoice.new.title") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "settings.accounts.create.confirm.confirm"),
      })
      .click()
    await completeOnboardingDefaults(page, "en")
  })

  await test.step("a restore URL naming the other account removes nothing", async () => {
    const [firstAccount] = await deviceAccountIds(page)
    if (firstAccount === undefined) throw new Error("No device account")
    await page.goto(
      `/restore-account?source=onboarding&previous=${firstAccount}&created=true`,
      { waitUntil: "domcontentloaded" }
    )
    await page.waitForURL((url) => url.pathname === "/")
    await expect.poll(() => deviceAccountIds(page)).toHaveLength(2)
  })

  await test.step("onboarding is not shown to an onboarded account", async () => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/")
    await expect(
      page.getByRole("button", { name: translate("en", "home.pay") })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: translate("en", "onboarding.title") })
    ).toHaveCount(0)
  })
})
