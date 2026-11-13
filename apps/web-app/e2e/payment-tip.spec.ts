import { expect, test } from "./support/fixtures.ts"
import { translate, translateValue } from "./support/i18n.ts"
import { enterAmount, markCashPaid } from "./support/payment.ts"

test("charge with a percentage tip preset then mark cash paid", async ({
  seededPage: page,
}) => {
  await test.step("enter an amount and go to the tip step", async () => {
    await enterAmount(page, "en")
    await page
      .getByRole("button", { name: translate("en", "home.pay") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentTip.title") })
      .waitFor()
  })

  await test.step("pick a percentage tip, which confirms immediately", async () => {
    await page
      .getByRole("button", {
        name: translateValue("en", "settings.tips.percentages.value", 10),
      })
      .click()
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.iban") })
      .waitFor()
  })

  await test.step("mark the payment as paid", () => markCashPaid(page, "en"))

  await test.step("verify the paid confirmation is shown", async () => {
    await expect(
      page
        .getByTestId("payment-paid-panel")
        .getByText(translate("en", "paymentWait.paid"))
    ).toBeVisible()
  })
})

test("the custom tip has a keypad screen of its own, its continue disabled until a tip is typed", async ({
  seededPage: page,
}) => {
  await test.step("enter an amount and go to the tip step", async () => {
    await enterAmount(page, "en")
    await page
      .getByRole("button", { name: translate("en", "home.pay") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentTip.title") })
      .waitFor()
  })

  const continueButton = page.getByRole("button", {
    name: translate("en", "paymentTip.continue"),
  })

  await test.step("the tip step has no confirm button", async () => {
    await expect(continueButton).not.toBeVisible()
  })

  await test.step("the custom tip opens its keypad, nothing typed yet", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentTip.custom.label") })
      .click()
    await expect(continueButton).toBeVisible()
    await expect(continueButton).toBeDisabled()
  })
})

test("charge with a custom tip typed on its keypad", async ({
  seededPage: page,
}) => {
  await test.step("enter an amount and go to the tip step", async () => {
    await enterAmount(page, "en")
    await page
      .getByRole("button", { name: translate("en", "home.pay") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentTip.title") })
      .waitFor()
  })

  await test.step("type a custom tip on its keypad and continue", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentTip.custom.label") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "paymentTip.continue") })
      .waitFor()
    await enterAmount(page, "en", "2.5")
    await page
      .getByRole("button", { name: translate("en", "paymentTip.continue") })
      .click()
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.iban") })
      .waitFor()
  })

  await test.step("mark the payment as paid", () => markCashPaid(page, "en"))

  await test.step("verify the paid confirmation is shown", async () => {
    await expect(
      page
        .getByTestId("payment-paid-panel")
        .getByText(translate("en", "paymentWait.paid"))
    ).toBeVisible()
  })
})

test("charge with no tip then mark cash paid", async ({ seededPage: page }) => {
  await test.step("enter an amount and go to the tip step", async () => {
    await enterAmount(page, "en")
    await page
      .getByRole("button", { name: translate("en", "home.pay") })
      .click()
    await page
      .getByRole("heading", { name: translate("en", "paymentTip.title") })
      .waitFor()
  })

  await test.step("choose no tip, which confirms immediately", async () => {
    await page
      .getByRole("button", { name: translate("en", "paymentTip.none") })
      .click()
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.iban") })
      .waitFor()
  })

  await test.step("mark the payment as paid", () => markCashPaid(page, "en"))

  await test.step("verify the paid confirmation is shown", async () => {
    await expect(
      page
        .getByTestId("payment-paid-panel")
        .getByText(translate("en", "paymentWait.paid"))
    ).toBeVisible()
  })
})

test("a malformed tip link shows a message instead of the error screen", async ({
  seededPage: page,
}) => {
  await page.goto("/payment/tip?amount=abc&currency=CZK", {
    waitUntil: "domcontentloaded",
  })
  await expect(
    page.getByText(translate("en", "paymentTip.invalidLink"))
  ).toBeVisible()
  // This used to throw out of `validateSearch` into the global error boundary.
  await expect(page.getByText(translate("en", "appError.title"))).toHaveCount(0)
})
