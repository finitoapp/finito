import type { Page } from "@playwright/test"

import { ownerPin, turnOnAccessControl, typePin } from "./support/access.ts"
import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"

/**
 * The approval page of an account request another app sends (account/0008).
 * Playwright cannot send an Android intent, so the e2e bridge opens the page
 * with a requester that records its answers.
 */

const caller = "Finito"

const simulateRequest = async (
  page: Page,
  { requesterName = caller }: { readonly requesterName?: string } = {}
) => {
  await page.waitForFunction(
    () => typeof window.__e2eSimulateAccountShareRequest === "function"
  )
  await page.evaluate(
    (options) => window.__e2eSimulateAccountShareRequest?.(options),
    { callerLabel: caller, requesterName, code: "482913" }
  )
}

const answers = (page: Page) =>
  page.evaluate(() => window.__e2eAccountShareAnswers?.() ?? [])

const requestHeading = (page: Page) =>
  page.getByText(
    translate("en", "accountShare.caller").replace("{caller}", caller)
  )

test("an approved request hands the active account to the app that asked", async ({
  seededPage: page,
}) => {
  await test.step("a request arrives", () => simulateRequest(page))
  await test.step("the page shows who asks and the code", async () => {
    await expect(requestHeading(page)).toBeVisible()
    await expect(page.getByText("482 913")).toBeVisible()
    await expect(
      page.getByText(translate("en", "accountShare.mismatch.title"))
    ).toHaveCount(0)
  })
  await test.step("approve", () =>
    page
      .getByRole("button", { name: translate("en", "accountShare.approve") })
      .click())
  await test.step("the requester got the account", async () => {
    await expect
      .poll(() => answers(page))
      .toEqual([expect.objectContaining({ approved: true, error: null })])
    const [answer] = await answers(page)
    expect(answer?.accountName).toBeTruthy()
  })
})

test("a declined request, or one left, hands nothing over", async ({
  seededPage: page,
}) => {
  await test.step("decline a request", async () => {
    await simulateRequest(page)
    await page
      .getByRole("button", { name: translate("en", "accountShare.reject") })
      .click()
    await expect
      .poll(() => answers(page))
      .toEqual([{ approved: false, error: "rejected", accountName: null }])
  })
  await test.step("leave the next request's page", async () => {
    await simulateRequest(page, { requesterName: "Totally Finito" })
    await expect(
      page.getByText(translate("en", "accountShare.mismatch.title"))
    ).toBeVisible()
    await page
      .getByRole("button", { name: translate("en", "nav.back") })
      .click()
    await expect.poll(async () => (await answers(page)).length).toBe(2)
    expect((await answers(page))[1]).toEqual({
      approved: false,
      error: "rejected",
      accountName: null,
    })
  })
})

test("with access control on, the request waits for the owner PIN", async ({
  seededPage: page,
}) => {
  await test.step("turn access control on, this device set to Basic", () =>
    turnOnAccessControl(page, "en"))
  // A fresh load ends the PIN session the wizard started.
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await test.step("a request arrives behind the PIN", async () => {
    await simulateRequest(page)
    await expect(requestHeading(page)).toHaveCount(0)
    await typePin(page, "en", ownerPin)
  })
  await test.step("the page opens after the PIN", async () => {
    await expect(requestHeading(page)).toBeVisible()
    await expect(page.getByText("482 913")).toBeVisible()
  })
})
