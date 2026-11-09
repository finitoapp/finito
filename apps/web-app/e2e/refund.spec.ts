import { expect, test } from "./support/fixtures.ts"
import { translate, translateValue } from "./support/i18n.ts"
import { gotoPage, waitForLocalWriteToSettle } from "./support/navigation.ts"
import { seedOnboarding } from "./support/onboarding.ts"
import {
  createPayment,
  enterAmount,
  escapeRegExp,
  getPaymentIdFromUrl,
  markCashPaid,
  markIbanPaid,
  openRefundScreen,
  pickRefundChoice,
  prepareIbanPayment,
  refundAction,
  refundChoiceButton,
  refundConfirmButton,
  refundMethodRadio,
} from "./support/payment.ts"

test("refund a whole payment in cash: the goods and the tip come back as two refunds", async ({
  seededPage: page,
}) => {
  const paymentId =
    await test.step("take 100 with a 10% tip in cash", async () => {
      await enterAmount(page, "en", "100")
      await page
        .getByRole("button", { name: translate("en", "home.pay") })
        .click()
      await page
        .getByRole("button", {
          name: translateValue("en", "settings.tips.percentages.value", 10),
        })
        .click()
      await page
        .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
        .click()
      const id = getPaymentIdFromUrl(page)
      await markCashPaid(page, "en")
      await waitForLocalWriteToSettle(page)
      return id
    })

  await test.step("the screen starts on the whole payment, back from the register", async () => {
    await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")
    await openRefundScreen(page, "en")
    await expect(refundChoiceButton(page, "en", "whole")).toBeChecked()
    await expect(refundChoiceButton(page, "en", "whole")).toHaveAccessibleName(
      new RegExp(
        escapeRegExp(
          translate("en", "refund.page.choice.whole.tipIncluded").split(
            "{amount}"
          )[1] ?? ""
        ),
        "u"
      )
    )
    const cashRegister = refundMethodRadio(
      page,
      translate("en", "refund.dialog.method.cashRegister")
    )
    await expect(cashRegister).toBeChecked()
    // The card says what confirming it does.
    await expect(cashRegister).toHaveAccessibleName(
      new RegExp(
        escapeRegExp(
          translate("en", "refund.outcome.cashRegister").split("{amount}")[0] ??
            ""
        ),
        "u"
      )
    )
  })

  await test.step("one confirmation records the goods and the tip", async () => {
    await refundConfirmButton(page).click()
    await expect(
      page.getByText(translate("en", "refund.created"))
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "paymentDetail.title"),
      })
    ).toBeVisible()
    const refunds = page.getByTestId("payment-detail-refund")
    await expect(refunds).toHaveCount(2)
    await expect(
      refunds.filter({
        hasText: `${translate("en", "paymentDetail.refunds.tip")} · `,
      })
    ).toHaveCount(1)
    await expect(refundAction(page, "en")).toHaveCount(0)
  })
})

test("a bank transfer refunded from the cash register: the refund's detail shows the whole crowns handed out and the rounding", async ({
  page,
}) => {
  await seedOnboarding(page, "en", { fiatCurrency: "CZK" })

  const paymentId =
    await test.step("take CZK 63.70 by bank transfer", async () => {
      await createPayment(page, "en", "63.7")
      await prepareIbanPayment(page, "en")
      const id = getPaymentIdFromUrl(page)
      await markIbanPaid(page, "en")
      await waitForLocalWriteToSettle(page)
      return id
    })

  await test.step("refund the whole payment from the register", async () => {
    await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")
    await openRefundScreen(page, "en")
    await pickRefundChoice(page, "en", "whole")
    await refundMethodRadio(
      page,
      translate("en", "refund.dialog.method.cashRegister")
    ).click()
    await refundConfirmButton(page).click()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "paymentDetail.title"),
      })
    ).toBeVisible()
  })

  await test.step("the refund's row opens its detail: CZK 63.70 recorded, CZK 64 handed out", async () => {
    const row = page.getByTestId("payment-detail-refund")
    await expect(row).toHaveCount(1)
    await row.click()
    await expect(
      page.getByRole("heading", { name: translate("en", "refundDetail.title") })
    ).toBeVisible()
    const summary = page.getByTestId("refund-detail")
    await expect(summary).toContainText("CZK 63.70")
    await expect(summary).toContainText(
      translate("en", "refundDetail.what.goods")
    )
    const cash = page.getByTestId("refund-detail-cash")
    await expect(
      cash.getByText(translate("en", "refundDetail.cash.handed")).locator("..")
    ).toContainText("CZK 64.00")
    await expect(
      cash
        .getByText(translate("en", "refundDetail.cash.rounding"))
        .locator("..")
    ).toContainText("+CZK 0.30")
  })

  await test.step("the payment link goes back to the payment detail", async () => {
    await page
      .getByTestId("refund-detail")
      .getByRole("button", {
        name: new RegExp(escapeRegExp("CZK 63.70"), "u"),
      })
      .click()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "paymentDetail.title"),
      })
    ).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/activity/${paymentId}$`, "u"))
  })
})
