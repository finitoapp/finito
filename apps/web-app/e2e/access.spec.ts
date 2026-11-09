import type { Page } from "@playwright/test"

import {
  ownerPin,
  readRecoveryPhrase,
  turnOnAccessControl,
  typePin,
} from "./support/access.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage } from "./support/navigation.ts"
import {
  createPayment,
  getPaymentIdFromUrl,
  markCashPaidAndSettle,
  refundAction,
  refundConfirmButton,
} from "./support/payment.ts"

const routeLockHeading = (page: Page, permission: string) =>
  page.getByRole("heading", {
    name: translate("en", "access.pin.why.route").replace(
      "{permission}",
      permission
    ),
  })

const catalogLock = (page: Page) =>
  routeLockHeading(page, translate("en", "access.permission.catalog"))

const itemsHeading = (page: Page) =>
  page.getByRole("heading", { name: translate("en", "catalog.items.title") })

const wrongPinMessage = (attemptsLeft: number) =>
  translate("en", "access.pin.wrong").replace("{count}", String(attemptsLeft))

const typeWrongPins = async (page: Page, count: number) => {
  for (let attempt = 1; attempt <= count; attempt += 1) {
    await typePin(page, "en", "0000")
    if (attempt < 5) {
      await expect(page.getByText(wrongPinMessage(5 - attempt))).toBeVisible()
    }
  }
}

test("turning access control on with the wizard locks what the device was not given", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  await test.step("the device list shows its preset", async () => {
    await expect(
      page
        .getByTestId("access-devices")
        .getByText(translate("en", "access.preset.basic"), { exact: true })
    ).toBeVisible()
  })

  await test.step("adding a device starts next to the device list", async () => {
    await page
      .getByRole("link", { name: translate("en", "access.devices.add") })
      .click()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "accountTransfer.source.title"),
      })
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "accountTransfer.source.permissions"))
    ).toBeVisible()
  })

  await test.step("selling stays open without the PIN", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("button", { name: translate("en", "home.pay") })
    ).toBeVisible()
  })

  await test.step("the catalog asks for the PIN, which opens it", async () => {
    await page.goto("/catalog/items", { waitUntil: "domcontentloaded" })
    await expect(catalogLock(page)).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(itemsHeading(page)).toBeVisible()
  })
})

test("a device with no permissions starts on the PIN screen", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on with this device set to None", () =>
    turnOnAccessControl(page, "en", { preset: "none" }))

  await test.step("home asks for the PIN", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(
      routeLockHeading(page, translate("en", "access.permission.sell"))
    ).toBeVisible()
    await expect(
      page.getByText(
        translate("en", "access.pin.help").replace(
          "{permission}",
          translate("en", "access.permission.sell")
        )
      )
    ).toBeVisible()
  })
})

test("a refund asks for the PIN when its screen opens, naming the permission it needs", async ({
  seededPage: page,
}) => {
  const paymentId = await test.step("take a cash payment", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await createPayment(page, "en", "5")
    const id = getPaymentIdFromUrl(page)
    await markCashPaidAndSettle(page, "en")
    return id
  })

  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))

  await test.step("opening the refund screen asks for the PIN", async () => {
    await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")
    await refundAction(page, "en").click()

    await expect(
      routeLockHeading(page, translate("en", "access.permission.refund"))
    ).toBeVisible()
    await expect(
      page.getByText(
        translate("en", "access.pin.help").replace(
          "{permission}",
          translate("en", "access.permission.refund")
        )
      )
    ).toBeVisible()
  })

  await test.step("the PIN opens the screen and the refund goes through", async () => {
    await typePin(page, "en", ownerPin)
    await refundConfirmButton(page).click()
    await expect(
      page.getByText(translate("en", "refund.created"))
    ).toBeVisible()
  })
})

test("a PIN session ends after five minutes without activity", async ({
  seededPage: page,
}) => {
  await page.clock.install()

  await test.step("turn access control on and open the catalog with the PIN", async () => {
    await turnOnAccessControl(page, "en")
    await page.goto("/catalog/items", { waitUntil: "domcontentloaded" })
    await typePin(page, "en", ownerPin)
    await expect(itemsHeading(page)).toBeVisible()
  })

  await test.step("five idle minutes lock the catalog again", async () => {
    await page.clock.fastForward("05:10")
    await expect(catalogLock(page)).toBeVisible()
  })
})

test("five wrong PINs block the device, and the recovery phrase unblocks it", async ({
  seededPage: page,
}) => {
  const phrase = await test.step("note the recovery phrase", () =>
    readRecoveryPhrase(page, "en"))

  await test.step("turn access control on", () =>
    turnOnAccessControl(page, "en"))

  await test.step("five wrong PINs block PIN entry", async () => {
    await page.goto("/catalog/items", { waitUntil: "domcontentloaded" })
    await typeWrongPins(page, 5)
    await expect(
      page.getByText(translate("en", "access.pin.blocked.title"))
    ).toBeVisible()
    await expect(page.locator("[data-pin-pad]")).toHaveCount(0)
  })

  await test.step("the recovery phrase unlocks, showing the attempts first", async () => {
    await page
      .getByRole("button", { name: translate("en", "access.pin.forgot") })
      .click()
    await expect(
      page.getByText(translate("en", "access.phrase.warning"))
    ).toBeVisible()
    await page.getByLabel(translate("en", "access.phrase.label")).fill(phrase)
    await page
      .getByRole("button", { name: translate("en", "access.phrase.submit") })
      .click()
    await expect(
      page.getByTestId("failed-pin-attempts").getByRole("listitem")
    ).toHaveCount(5)
    await page
      .getByRole("button", {
        name: translate("en", "access.attempts.continue"),
      })
      .click()
    await expect(itemsHeading(page)).toBeVisible()
  })
})

test("another device unblocks a blocked one", async ({ seededPage: page }) => {
  const kitchenId = await test.step("a blocked kitchen tablet syncs in", () =>
    page.evaluate(async () => {
      const seed = window.__e2eSeedDevice
      if (seed === undefined) throw new Error("e2e bridge is not ready")
      return seed({ name: "Kitchen tablet", blocked: true })
    }))

  await test.step("turn access control on", () =>
    turnOnAccessControl(page, "en"))

  await test.step("Settings → Access marks it and unblocks it with the PIN", async () => {
    const kitchen = page
      .getByTestId("access-devices")
      .getByRole("listitem")
      .filter({ hasText: "Kitchen tablet" })
    await expect(
      kitchen.getByText(translate("en", "access.device.blocked"))
    ).toBeVisible()
    await kitchen
      .getByRole("button", { name: translate("en", "access.device.unblock") })
      .click()
    await typePin(page, "en", ownerPin)
    await expect
      .poll(() =>
        page.evaluate(
          async (id) => (await window.__e2eReadDevice?.(id))?.pinUnblockToken,
          kitchenId
        )
      )
      .toEqual(expect.any(String))
  })

  await test.step("this device, once blocked, takes an unblock synced from another device", async () => {
    await page.goto("/catalog/items", { waitUntil: "domcontentloaded" })
    await typeWrongPins(page, 5)
    await expect(
      page.getByText(translate("en", "access.pin.blocked.title"))
    ).toBeVisible()

    await page.evaluate(async () => {
      await window.__e2eUnblockThisDevice?.()
    })

    await expect(page.locator("[data-pin-pad]")).toBeVisible()
    await typePin(page, "en", "0000")
    await expect(page.getByText(wrongPinMessage(4))).toBeVisible()
  })

  await test.step("the owner still sees every failed attempt at the next correct PIN", async () => {
    await typePin(page, "en", ownerPin)
    await expect(
      page.getByTestId("failed-pin-attempts").getByRole("listitem")
    ).toHaveCount(6)
  })
})

test("wrong PINs followed by the correct one show the failed attempts", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on", () =>
    turnOnAccessControl(page, "en"))

  await test.step("two wrong PINs on the catalog", async () => {
    await page.goto("/catalog/items", { waitUntil: "domcontentloaded" })
    await typeWrongPins(page, 2)
  })

  await test.step("the correct PIN lists them before going on", async () => {
    await typePin(page, "en", ownerPin)
    const attempts = page
      .getByTestId("failed-pin-attempts")
      .getByRole("listitem")
    await expect(attempts).toHaveCount(2)
    await expect(attempts.first()).toContainText("/catalog/items")
    await page
      .getByRole("button", {
        name: translate("en", "access.attempts.continue"),
      })
      .click()
    await expect(itemsHeading(page)).toBeVisible()
  })

  await test.step("the list was cleared: the next PIN goes straight in", async () => {
    await page.goto("/catalog/tables", { waitUntil: "domcontentloaded" })
    await expect(catalogLock(page)).toBeVisible()
    await typePin(page, "en", ownerPin)
    await expect(page.getByTestId("failed-pin-attempts")).toHaveCount(0)
    await expect(
      page.getByRole("heading", {
        name: translate("en", "catalog.tables.title"),
      })
    ).toBeVisible()
  })
})
