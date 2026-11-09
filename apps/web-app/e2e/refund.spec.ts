import { expect, test } from "./support/fixtures.ts"
import { translate, translateValue } from "./support/i18n.ts"
import { gotoPage, waitForLocalWriteToSettle } from "./support/navigation.ts"
import {
  enterAmount,
  getPaymentIdFromUrl,
  markCashPaid,
  openRefundScreen,
  refundAction,
  refundChoiceButton,
  refundConfirmButton,
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
    await expect(refundChoiceButton(page, "en", "whole")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(refundChoiceButton(page, "en", "whole")).toContainText(
      translate("en", "refund.page.choice.whole.tipIncluded").split(
        "{amount}"
      )[1] ?? ""
    )
    await expect(
      page.getByRole("button", {
        name: translate("en", "refund.dialog.method.cashRegister"),
      })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByTestId("refund-outcome")).toContainText(
      translate("en", "refund.outcome.cashRegister").split("{amount}")[0] ?? ""
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
