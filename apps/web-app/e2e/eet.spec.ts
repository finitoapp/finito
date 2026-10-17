import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { Page } from "@playwright/test"
import { addCatalogItem } from "./support/bill.ts"
import {
  createAndPaySecondPayment,
  simulateDuplicateSettlement,
} from "./support/collisions.ts"
import {
  createEetCertificateFile,
  enableEetWithGeneratedCertificate,
  type FakeEet,
  routeFakeEet,
  seedEetSaleFromAnotherDevice,
  selectEetSandbox,
} from "./support/eet.ts"
import { expect, test } from "./support/fixtures.ts"
import { nameParam, translate, translateValue } from "./support/i18n.ts"
import { pickInlineToggle, toggleInlineSwitch } from "./support/inline-edit.ts"
import {
  contentNav,
  gotoPage,
  gotoPosOverview,
  waitForLocalWriteToSettle,
} from "./support/navigation.ts"
import { seedOnboarding } from "./support/onboarding.ts"
import {
  createPayment,
  enterAmount,
  enterCashReceived,
  getPaymentIdFromUrl,
  markCashPaid,
  markCashPaidAndSettle,
  openRefundScreen,
  pickRefundChoice,
  prepareIbanPayment,
  refundAction,
  refundChoiceButton,
  refundConfirmButton,
  refundFromPaymentDetail,
  refundMethodRadio,
  refundTipFromPaymentDetail,
  startBillAndBeginCashPayment,
} from "./support/payment.ts"

const eetStatusOf = (page: Page) => page.getByTestId("eet-sale-status")

const eetDeliveryTimeout = { timeout: 20_000 }

async function takeCashPayment(page: Page, amount?: string): Promise<string> {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await createPayment(page, "en", amount)
  await page
    .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
    .click()
  const paymentId = getPaymentIdFromUrl(page)
  await markCashPaidAndSettle(page, "en")
  return paymentId
}

const lastReportedAmount = () =>
  fakeEet.production.requests.at(-1)?.data.celk_trzba

async function openPaymentDetail(page: Page, paymentId: string): Promise<void> {
  await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")
}

let fakeEet: FakeEet

test.beforeEach(async ({ page }) => {
  fakeEet = await routeFakeEet(page)
  await seedOnboarding(page, "en", { fiatCurrency: "CZK" })
})

test("EET starts off and turns on after a certificate and an establishment number", async ({
  page,
}) => {
  await test.step("the settings list always offers EET, switched off", async () => {
    await gotoPage(page, "/settings", "en", "settings.title")
    const entry = page.getByRole("link", {
      name: new RegExp(translate("en", "settings.eet.title")),
    })
    await expect(entry).toContainText(translate("en", "settings.eet.nav.off"))
    await entry.click()
    await page
      .getByRole("heading", { name: translate("en", "settings.eet.title") })
      .waitFor()
  })

  await test.step("the switch stays disabled and names what is missing", async () => {
    await expect(
      page.getByRole("switch", {
        name: translate("en", "settings.eet.enabled.label"),
      })
    ).toBeDisabled()
    await expect(
      page.getByText(
        translate("en", "settings.eet.enabled.missing").replace(
          "{missing}",
          [
            translate("en", "settings.eet.gap.certificate"),
            translate("en", "settings.eet.gap.establishment"),
          ].join(", ")
        )
      )
    ).toBeVisible()
  })

  await test.step("a generated certificate imports and EET turns on", async () => {
    await enableEetWithGeneratedCertificate(page, "en")
    await expect(
      page.getByRole("switch", {
        name: translate("en", "settings.eet.enabled.label"),
      })
    ).toBeChecked()
  })

  await test.step("the settings list shows EET on", async () => {
    await gotoPage(page, "/settings", "en", "settings.title")
    await expect(
      page.getByRole("link", {
        name: new RegExp(translate("en", "settings.eet.title")),
      })
    ).toContainText(translate("en", "settings.eet.nav.production"))
  })
})

test("a wrong certificate password is refused", async ({ page }) => {
  await gotoPage(page, "/settings/eet", "en", "settings.eet.title")
  await page
    .getByLabel(translate("en", "settings.eet.certificate.file.label"))
    .setInputFiles({
      ...(await createEetCertificateFile()),
      mimeType: "application/x-pkcs12",
    })
  await page
    .getByLabel(translate("en", "settings.eet.certificate.password.label"))
    .fill("not-the-password")
  await page
    .getByRole("button", {
      name: translate("en", "settings.eet.certificate.import"),
    })
    .click()

  await expect(
    page.getByText(
      translate("en", "settings.eet.certificate.error.wrongPassword")
    )
  ).toBeVisible()
  await expect(
    page.getByText(translate("en", "settings.eet.certificate.none"))
  ).toBeVisible()
})

test("the sandbox asks first, warns on every terminal screen, and marks the paid screen", async ({
  page,
}) => {
  test.slow()

  await test.step("production shows no sandbox warning", async () => {
    await enableEetWithGeneratedCertificate(page, "en")
    await gotoPage(page, "/settings", "en", "settings.title")
    await expect(page.getByTestId("eet-sandbox-banner")).toHaveCount(0)
  })

  await test.step("canceling the confirmation keeps production", async () => {
    await gotoPage(page, "/settings/eet", "en", "settings.eet.title")
    await selectEetSandbox(page, "en", { confirm: false })
    await expect(page.getByTestId("eet-sandbox-banner")).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: new RegExp(
          translate("en", "settings.eet.environment.production.title")
        ),
      })
    ).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("confirming turns the sandbox on", async () => {
    await selectEetSandbox(page, "en", { confirm: true })
    await expect(page.getByTestId("eet-sandbox-banner")).toBeVisible()
  })

  await test.step("the warning is on home, activity, bill and settings", async () => {
    for (const [path, heading] of [
      ["/activity", "activity.title"],
      ["/settings", "settings.title"],
      ["/bill", "bill.title"],
    ] as const) {
      await gotoPage(page, path, "en", heading)
      await expect(page.getByTestId("eet-sandbox-banner")).toBeVisible()
    }
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("eet-sandbox-banner")).toBeVisible()
  })

  await test.step("the paid screen says the sale went to the test environment", async () => {
    await takeCashPayment(page)
    await expect(
      page
        .getByTestId("payment-paid-panel")
        .getByText(translate("en", "paymentWait.eetSandbox"))
    ).toBeVisible()
  })

  await test.step("tapping the warning opens the EET settings", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await page.getByTestId("eet-sandbox-banner").click()
    await page
      .getByRole("heading", { name: translate("en", "settings.eet.title") })
      .waitFor()
  })
})

test("the connection test and the test sale show EET's answer and record nothing", async ({
  page,
}) => {
  await enableEetWithGeneratedCertificate(page, "en")
  await selectEetSandbox(page, "en", { confirm: true })

  await test.step("the connection test passes in verification mode", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "settings.eet.test.connection"),
      })
      .click()
    const result = page.getByTestId("eet-test-result")
    await expect(result).toContainText(
      translate("en", "settings.eet.test.outcome.verified")
    )
    expect(fakeEet.playground.requests.at(-1)?.header.overeni).toBe("true")
  })

  await test.step("the test sale returns a test POK and both raw messages", async () => {
    await page
      .getByRole("button", { name: translate("en", "settings.eet.test.sale") })
      .click()
    await expect(page.getByTestId("eet-test-pok")).toContainText(/-ff$/u)
    const result = page.getByTestId("eet-test-result")
    await result
      .getByRole("button", {
        name: translate("en", "settings.eet.test.rawRequest"),
      })
      .click()
    await expect(result.locator("pre").first()).toContainText("<tns:Trzba")
    await result
      .getByRole("button", {
        name: translate("en", "settings.eet.test.rawResponse"),
      })
      .click()
    await expect(result.locator("pre").last()).toContainText("Potvrzeni")
  })

  await test.step("no sale record was created", async () => {
    await expect(
      page.getByText(translate("en", "settings.eet.unconfirmed.empty"))
    ).toBeVisible()
    await gotoPage(page, "/activity", "en", "activity.title")
    await expect(contentNav(page, "en").getByRole("link")).toHaveCount(0)
  })
})

test("the official test certificate is picked in one step in the sandbox", async ({
  page,
}) => {
  const officialCertificate = await createEetCertificateFile("CZ9876543210")
  await page.route("**/api/eet/playground-certificates", async (route) => {
    await route.fulfill({
      json: {
        password: "generated-e2e-password",
        certificates: [
          {
            fileName: officialCertificate.name,
            p12Base64: officialCertificate.buffer.toString("base64"),
          },
        ],
      },
      headers: { "access-control-allow-origin": "*" },
    })
  })

  await gotoPage(page, "/settings/eet", "en", "settings.eet.title")
  await expect(
    page.getByRole("button", {
      name: translate("en", "settings.eet.officialTest.show"),
    })
  ).toHaveCount(0)
  await selectEetSandbox(page, "en", { confirm: true })

  await test.step("the downloaded certificates are listed with EIČ and description", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "settings.eet.officialTest.show"),
      })
      .click()
    await expect(page.getByText("CZ9876543210")).toBeVisible()
    await expect(page.getByText("generated e2e taxpayer")).toBeVisible()
  })

  await test.step("picking one stores it as a test certificate", async () => {
    await page
      .getByRole("button", {
        name: nameParam("settings.eet.officialTest.use", "CZ9876543210"),
      })
      .click()
    await expect(page.getByTestId("eet-certificate-eic")).toHaveText(
      "CZ9876543210"
    )
    await expect(
      page.getByText(translate("en", "settings.eet.certificate.testBadge"), {
        exact: true,
      })
    ).toBeVisible()
  })

  await test.step("production cannot be selected with a test certificate", async () => {
    await page
      .getByRole("button", {
        name: new RegExp(
          translate("en", "settings.eet.environment.production.title")
        ),
      })
      .click()
    await expect(
      page
        .getByRole("button", {
          name: new RegExp(
            translate("en", "settings.eet.environment.playground.title")
          ),
        })
        .first()
    ).toHaveAttribute("aria-pressed", "true")
  })
})

test("the official test certificates fall back to the file import when unavailable", async ({
  page,
}) => {
  await page.route("**/api/eet/playground-certificates", async (route) => {
    await route.fulfill({
      status: 502,
      json: { status: "ERROR", reason: "unavailable" },
      headers: { "access-control-allow-origin": "*" },
    })
  })
  await gotoPage(page, "/settings/eet", "en", "settings.eet.title")
  await selectEetSandbox(page, "en", { confirm: true })

  await page
    .getByRole("button", {
      name: translate("en", "settings.eet.officialTest.show"),
    })
    .click()

  await expect(
    page.getByText(
      translate("en", "settings.eet.officialTest.unavailable.title")
    )
  ).toBeVisible()
  await expect(
    page.getByLabel(translate("en", "settings.eet.certificate.file.label"))
  ).toBeVisible()
  await expect(
    page.getByText(translate("en", "settings.eet.certificate.none"))
  ).toBeVisible()
})

test("the payment detail shows a confirmed sale and lets staff resend a pending one", async ({
  page,
}) => {
  test.slow()

  await enableEetWithGeneratedCertificate(page, "en")

  await test.step("a cash payment is confirmed by EET", async () => {
    const paymentId = await takeCashPayment(page)
    await openPaymentDetail(page, paymentId)
    const eet = page.getByTestId("payment-detail-eet")
    await expect(eetStatusOf(page)).toHaveText(
      translate("en", "eet.status.confirmed"),
      eetDeliveryTimeout
    )
    await expect(eet).toContainText(translate("en", "paymentDetail.eet.pok"))
    await expect(eet).toContainText(
      translate("en", "paymentDetail.eet.receivedAt")
    )
  })

  await test.step("a payment EET could not be reached for stays pending", async () => {
    fakeEet.setUnreachable(true)
    const paymentId = await takeCashPayment(page)
    await openPaymentDetail(page, paymentId)
    await expect(eetStatusOf(page)).toHaveText(
      translate("en", "eet.status.pending")
    )
  })

  await test.step("staff resends it and EET confirms it", async () => {
    fakeEet.setUnreachable(false)
    await page
      .getByRole("button", { name: translate("en", "paymentDetail.eet.retry") })
      .click()
    await expect(eetStatusOf(page)).toHaveText(
      translate("en", "eet.status.confirmed"),
      eetDeliveryTimeout
    )
    await expect(
      page.getByRole("button", {
        name: translate("en", "paymentDetail.eet.retry"),
      })
    ).toHaveCount(0)
  })
})

test("another device's sale waits for that device, then is sent from here as a repeat", async ({
  page,
}) => {
  test.slow()
  const waitingText = new RegExp(
    translate("en", "paymentDetail.eet.waitingForDevice")
      .split("{time}")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join(".+"),
    "u"
  )
  const retryButton = page.getByRole("button", {
    name: translate("en", "paymentDetail.eet.retry"),
  })
  let recentPaymentId = ""
  let olderPaymentId = ""

  await test.step("take two cash payments before EET is on", async () => {
    recentPaymentId = await takeCashPayment(page)
    olderPaymentId = await takeCashPayment(page)
  })

  await enableEetWithGeneratedCertificate(page, "en")

  await test.step("a sale another device took 3 minutes ago waits for it", async () => {
    await seedEetSaleFromAnotherDevice(page, recentPaymentId, 3)
    await openPaymentDetail(page, recentPaymentId)
    await expect(page.getByTestId("payment-detail-eet")).toContainText(
      waitingText
    )
    await expect(retryButton).toHaveCount(0)
  })

  await test.step("a sale another device took 11 minutes ago is sent from here", async () => {
    const cashRegisterId = await seedEetSaleFromAnotherDevice(
      page,
      olderPaymentId,
      11
    )
    await openPaymentDetail(page, olderPaymentId)
    await expect(eetStatusOf(page)).toHaveText(
      translate("en", "eet.status.confirmed"),
      eetDeliveryTimeout
    )
    expect(
      fakeEet.production.requests.filter(
        ({ data }) => data.porad_cis === olderPaymentId
      )
    ).toMatchObject([
      { header: { prvni_zaslani: "false" }, data: { id_pokl: cashRegisterId } },
    ])
    expect(
      fakeEet.production.requests.filter(
        ({ data }) => data.porad_cis === recentPaymentId
      )
    ).toEqual([])
  })
})

test("the bill detail shows the EET status of each payment", async ({
  page,
}) => {
  test.slow()

  await enableEetWithGeneratedCertificate(page, "en")
  await addCatalogItem(page, "en", { name: "Coffee", price: "50" })

  await test.step("one payment is rejected and the other confirmed", async () => {
    fakeEet.production.answerNext({
      type: "error",
      code: 4,
      message: "Neplatny podpis SOAP zpravy",
    })
    const billId = await startBillAndBeginCashPayment(page, "en")
    await createAndPaySecondPayment(page, billId)
    await markCashPaid(page, "en")
    await expect
      .poll(() => fakeEet.production.requests.length, eetDeliveryTimeout)
      .toBe(2)
    await waitForLocalWriteToSettle(page)

    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
  })

  await test.step("each payment row carries its own EET status", async () => {
    const statuses = eetStatusOf(page)
    await expect(statuses).toHaveCount(2, eetDeliveryTimeout)
    await expect(
      statuses.filter({ hasText: translate("en", "eet.status.confirmed") })
    ).toHaveCount(1)
    await expect(
      statuses.filter({ hasText: translate("en", "eet.status.rejected") })
    ).toHaveCount(1)
  })
})

test("the paid screen appears at once while EET cannot be reached", async ({
  page,
}) => {
  await enableEetWithGeneratedCertificate(page, "en")
  fakeEet.stopAnswering()

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await createPayment(page, "en")
  await page
    .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
    .click()
  await page
    .getByRole("button", {
      name: translate("en", "paymentWait.cashPaid.action"),
    })
    .click()

  await expect
    .poll(fakeEet.unansweredRequestCount, eetDeliveryTimeout)
    .toBeGreaterThan(0)
  await expect(
    page
      .getByTestId("payment-paid-panel")
      .getByText(translate("en", "paymentWait.paid"))
  ).toBeVisible({ timeout: 2_000 })
})

test("tips that belong to employees are left out of the reported sale", async ({
  page,
}) => {
  const tipOption = (key: TranslationKey) =>
    page.getByRole("button", { name: new RegExp(translate("en", key)) })

  await enableEetWithGeneratedCertificate(page, "en")

  await test.step("tips belong to the business until the merchant says otherwise", async () => {
    await expect(
      page.getByText(translate("en", "settings.eet.tip.description"))
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "settings.eet.tip.note"))
    ).toBeVisible()
    await expect(tipOption("settings.eet.tip.business.title")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  await test.step("the merchant says tips belong to employees", async () => {
    await pickInlineToggle(
      page,
      new RegExp(translate("en", "settings.eet.tip.employees.title"))
    )
    await waitForLocalWriteToSettle(page)
  })

  await test.step("a cash payment with a 10% tip is reported as its goods in whole crowns", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await enterAmount(page, "en")
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
    // A whole-crown tip: cash hands out only whole crowns (refund/0012).
    await enterCashReceived(page, "en", "7")
    await markCashPaidAndSettle(page, "en")

    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("6.00")
  })
})

test("a refunded tip reaches EET only while tips belong to the business", async ({
  page,
}) => {
  test.slow()
  const reportedAmounts = () =>
    fakeEet.production.requests.map(({ data }) => data.celk_trzba)
  const payWithTip = async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await enterAmount(page, "en")
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
    await page
      .getByRole("button", {
        name: translate("en", "paymentWait.cashPaid.action"),
      })
      .waitFor()
    const paymentId = getPaymentIdFromUrl(page)
    // A whole-crown tip: cash hands out only whole crowns (refund/0012).
    await enterCashReceived(page, "en", "7")
    await markCashPaidAndSettle(page, "en")
    return paymentId
  }

  await enableEetWithGeneratedCertificate(page, "en")

  await test.step("a tip that belongs to the business is reversed", async () => {
    const paymentId = await payWithTip()
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("7.00")
    await openPaymentDetail(page, paymentId)
    await openRefundScreen(page, "en")
    await pickRefundChoice(page, "en", "part")
    await expect(
      page.getByText(
        translate("en", "refund.dialog.tipHint").replace("{amount}", "CZK 1.00")
      )
    ).toBeVisible()
    await page.goBack()
    await refundTipFromPaymentDetail(page, "en")
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("-1.00")
    await expect(page.getByTestId("payment-detail-refund")).toContainText(
      translate("en", "paymentDetail.refunds.tip")
    )
    await openRefundScreen(page, "en")
    await expect(refundChoiceButton(page, "en", "tip")).toHaveCount(0)
  })

  await test.step("a tip that belongs to employees is not reversed", async () => {
    await gotoPage(page, "/settings/eet", "en", "settings.eet.title")
    await pickInlineToggle(
      page,
      new RegExp(translate("en", "settings.eet.tip.employees.title"))
    )
    await waitForLocalWriteToSettle(page)
    const paymentId = await payWithTip()
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("6.00")
    const sentBefore = reportedAmounts().length
    await openPaymentDetail(page, paymentId)
    await refundTipFromPaymentDetail(page, "en")
    await refundFromPaymentDetail(page, "en", { outside: true })
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("-6.00")
    expect(reportedAmounts().slice(sentBefore)).toEqual(["-6.00"])
  })
})

test("a cash sale is reported as the cash received", async ({ page }) => {
  test.slow()

  await enableEetWithGeneratedCertificate(page, "en")

  await test.step("78.90 confirmed as prefilled is reported rounded to 79.00", async () => {
    await takeCashPayment(page, "78.9")
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("79.00")
  })

  await test.step("78.90 with the change left is reported as 80.00", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await createPayment(page, "en", "78.9")
    await page
      .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
      .click()
    const paymentId = getPaymentIdFromUrl(page)
    await enterCashReceived(page, "en", "77")
    await expect(
      page.getByRole("button", {
        name: translate("en", "paymentWait.cashPaid.action"),
      })
    ).toBeDisabled()
    await enterCashReceived(page, "en", "80")
    await expect(
      page.getByText(
        translate("en", "paymentWait.cashPaid.difference").replace(
          "{amount}",
          "CZK 1.10"
        )
      )
    ).toBeVisible()
    await markCashPaidAndSettle(page, "en")
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("80.00")

    await openPaymentDetail(page, paymentId)
    await expect(
      page.getByText(
        translate("en", "paymentDetail.cashReceived").replace(
          "{amount}",
          "CZK 80.00"
        )
      )
    ).toBeVisible()
    const eetCard = page.getByTestId("payment-detail-eet")
    await expect(
      eetCard.getByText(translate("en", "paymentDetail.eet.amount"))
    ).toBeVisible()
    await expect(eetCard.getByText("CZK 80.00")).toBeVisible()
  })
})

test("refunds of a paid bill reach EET as negative sales", async ({ page }) => {
  test.slow()

  await enableEetWithGeneratedCertificate(page, "en")
  await addCatalogItem(page, "en", { name: "Beer", price: "50" })
  await addCatalogItem(page, "en", { name: "Goulash", price: "150" })

  const { billId, paymentId } =
    await test.step("a bill of 2 beers and a goulash is paid in cash", async () => {
      await gotoPosOverview(page, "en")
      await page
        .getByTestId("no-table-tile")
        .getByRole("link", { name: translate("en", "tables.tile.newBill") })
        .click()
      for (const name of ["Beer", "Beer", "Goulash"]) {
        await page
          .getByRole("button", { name: nameParam("bill.brick.add.aria", name) })
          .click()
      }
      await waitForLocalWriteToSettle(page)
      const billId = new URL(page.url()).searchParams.get("billId") ?? ""
      await page
        .getByRole("button", { name: translate("en", "home.pay") })
        .click()
      const skipTip = page.getByRole("button", {
        name: translate("en", "paymentTip.none"),
      })
      const markPaid = page.getByRole("button", {
        name: translate("en", "paymentWait.cashPaid.action"),
      })
      await skipTip.or(markPaid).first().waitFor()
      if (await skipTip.isVisible()) await skipTip.click()
      await markPaid.waitFor()
      const paymentId = getPaymentIdFromUrl(page)
      await markCashPaidAndSettle(page, "en")
      await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("250.00")
      return { billId, paymentId }
    })

  await test.step("one beer is refunded and reversed", async () => {
    await openPaymentDetail(page, paymentId)
    await refundFromPaymentDetail(page, "en", { items: ["Beer"] })
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("-50.00")
  })

  await test.step("the rest is refunded and reversed", async () => {
    await refundFromPaymentDetail(page, "en")
    await expect.poll(lastReportedAmount, eetDeliveryTimeout).toBe("-200.00")
    // Each refund's row shows only its reversal's status.
    const refunds = page.getByTestId("payment-detail-refund")
    await expect(refunds).toHaveCount(2)
    await expect(refunds.getByTestId("eet-sale-status")).toHaveText(
      [
        translate("en", "eet.status.confirmed"),
        translate("en", "eet.status.confirmed"),
      ],
      eetDeliveryTimeout
    )
    await expect(refundAction(page, "en")).toHaveCount(0)
  })

  await test.step("each refund's detail shows its items and its reversal", async () => {
    for (const expected of [
      { amount: "CZK 50.00", lines: ["1 × Beer"] },
      // The rest went back as an amount, which has no items.
      { amount: "CZK 200.00", lines: [] },
    ]) {
      await page
        .getByTestId("payment-detail-refund")
        .filter({ hasText: expected.amount })
        .click()
      await page
        .getByRole("heading", { name: translate("en", "refundDetail.title") })
        .waitFor()
      const lines = page.getByTestId("refund-detail-lines")
      if (expected.lines.length === 0) await expect(lines).toHaveCount(0)
      for (const line of expected.lines) {
        await expect(lines.getByText(line)).toBeVisible()
      }
      const reversal = page.getByTestId("payment-detail-eet-reversal")
      await expect(reversal).toContainText(expected.amount)
      await expect(reversal.getByTestId("eet-sale-status")).toHaveText(
        translate("en", "eet.status.confirmed")
      )
      await page.goBack()
      await page
        .getByRole("heading", { name: translate("en", "paymentDetail.title") })
        .waitFor()
    }
  })

  await test.step("the payment shows refunded while its bill stays closed", async () => {
    await gotoPage(page, `/activity/bills/${billId}`, "en", "billDetail.title")
    await expect(
      page.getByText(translate("en", "bill.status.closed")).first()
    ).toBeVisible()
    await expect(page.getByTestId("refund-badge")).toHaveText(
      translate("en", "refund.state.full").replace("{amount}", "CZK 250.00")
    )
  })
})

test("a payment settled twice reports the extra money, and refunding it reverses only that", async ({
  page,
}) => {
  test.slow()

  await enableEetWithGeneratedCertificate(page, "en")

  const paymentId =
    await test.step("a cash payment is also settled by a bank transfer", async () => {
      await page.goto("/", { waitUntil: "domcontentloaded" })
      await createPayment(page, "en")
      await prepareIbanPayment(page, "en")
      await page
        .getByRole("tab", { name: translate("en", "paymentWait.method.cash") })
        .click()
      const paymentId = getPaymentIdFromUrl(page)
      await markCashPaidAndSettle(page, "en")
      await simulateDuplicateSettlement(page)
      await expect
        .poll(() => fakeEet.production.requests.length, eetDeliveryTimeout)
        .toBe(2)
      return paymentId
    })

  await test.step("the payment detail shows the sale and the extra money sale", async () => {
    await openPaymentDetail(page, paymentId)
    await expect(page.getByTestId("payment-detail-eet-extra")).toContainText(
      translate("en", "paymentDetail.eet.extra.description")
    )
    await expect(eetStatusOf(page)).toHaveText(
      [
        translate("en", "eet.status.confirmed"),
        translate("en", "eet.status.confirmed"),
      ],
      eetDeliveryTimeout
    )
  })

  await test.step("the refund offers the extra money and reverses only it", async () => {
    const extraSale = fakeEet.production.requests.at(1)
    // The refund screen starts on the money above the bill, prefilled with
    // the extra money (refund/0014).
    await openRefundScreen(page, "en")
    await expect(refundChoiceButton(page, "en", "overpayment")).toBeChecked()
    const refundAmount = page.getByLabel(
      translate("en", "refund.dialog.amount.label")
    )
    await expect(refundAmount).toHaveValue("6")
    await refundMethodRadio(
      page,
      translate("en", "refund.dialog.method.outside")
    ).click()
    await expect(refundAmount).toHaveValue("5.9")
    await refundConfirmButton(page).click()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "paymentDetail.title"),
      })
    ).toBeVisible()
    await expect
      .poll(lastReportedAmount, eetDeliveryTimeout)
      .toBe(`-${extraSale?.data.celk_trzba}`)
    await expect(refundAction(page, "en")).toBeVisible()
  })

  await test.step("the history shows the overpayment returned", async () => {
    await gotoPage(page, "/activity", "en", "activity.title")
    await expect(page.getByTestId("refund-badge").first()).toHaveText(
      new RegExp(
        `^${translate("en", "refund.state.overpayment").split("{amount}")[0] ?? ""}`,
        "u"
      )
    )
  })
})

test("EET can be switched off again", async ({ page }) => {
  await enableEetWithGeneratedCertificate(page, "en")

  await toggleInlineSwitch(page, "settings.eet.enabled.label")

  await expect(
    page.getByRole("switch", {
      name: translate("en", "settings.eet.enabled.label"),
    })
  ).not.toBeChecked()
})
