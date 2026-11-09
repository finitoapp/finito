import { expect, test } from "./support/fixtures.ts"
import { translate } from "./support/i18n.ts"
import { gotoPage, waitForLocalWriteToSettle } from "./support/navigation.ts"
import {
  createPayment,
  escapeRegExp,
  getPaymentIdFromUrl,
  openRefundScreen,
  refundConfirmButton,
  refundMethodRadio,
} from "./support/payment.ts"
import {
  pairQerko,
  qerkoLegalEntityName,
  qerkoPairingCode,
  qerkoTerminalTid,
  routeFakeQerko,
} from "./support/qerko-mocks.ts"

const t = (key: Parameters<typeof translate>[1]) => translate("en", key)

// Every test pairs through the wizard first, and the suite runs its workers in
// parallel: the default 30 s is tight for that under load.
test.describe.configure({ timeout: 90_000 })

test("pair with Qerko: the wizard asks for the code and a terminal, and the method turns on", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)

  await test.step("a wrong code says how many attempts are left", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts/qerko-terminal",
      "en",
      "settings.qerkoTerminal.title"
    )
    await page
      .getByLabel(
        t("settings.qerkoTerminal.company.identificationNumber.label")
      )
      .fill("12345678")
    await page
      .getByRole("button", { name: t("settings.qerkoTerminal.requestCode") })
      .click()
    await page
      .getByLabel(t("settings.qerkoTerminal.code.label"))
      .pressSequentially("0000")
    await page
      .getByRole("button", { name: t("settings.qerkoTerminal.code.confirm") })
      .click()
    await expect(
      page.getByText(
        t("settings.qerkoTerminal.code.invalid").replace("{count}", "2")
      )
    ).toBeVisible()
  })

  await test.step("the right code lists the terminals", async () => {
    await page
      .getByLabel(t("settings.qerkoTerminal.code.label"))
      .pressSequentially(qerkoPairingCode)
    await page
      .getByRole("button", { name: t("settings.qerkoTerminal.code.confirm") })
      .click()
    await expect(page.getByText(qerkoTerminalTid)).toBeVisible()
    // Only activated terminals are offered.
    await expect(page.getByText("TID-OFF")).toHaveCount(0)
  })

  await test.step("choosing one shows the paired view and turns the method on", async () => {
    await page
      .getByRole("button", {
        name: t("settings.qerkoTerminal.terminals.choose"),
      })
      .click()
    await expect(
      page.getByText(t("settings.qerkoTerminal.paired.title"))
    ).toBeVisible()
    await expect(page.getByText(new RegExp(qerkoLegalEntityName))).toBeVisible()
    // The chosen terminal is tested without asking.
    await expect(
      page.getByText(t("settings.qerkoTerminal.test.connected"))
    ).toBeVisible()
    await gotoPage(
      page,
      "/settings/payment-accounts",
      "en",
      "settings.paymentAccounts.title"
    )
    await expect(
      page.getByRole("switch", {
        name: t("settings.qerkoTerminal.enabled.label"),
      })
    ).toBeChecked()
  })

  await test.step("the pairing asked for a terminal-payments key in the sandbox", () => {
    expect(qerko.requests.map(({ path }) => path)).toContain("request-pairing")
  })
})

test("pair with Qerko without a terminal: the wizard explains who sets one up and lets it be skipped", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  qerko.noTerminals = true

  await gotoPage(
    page,
    "/settings/payment-accounts/qerko-terminal",
    "en",
    "settings.qerkoTerminal.title"
  )
  await page
    .getByLabel(t("settings.qerkoTerminal.company.identificationNumber.label"))
    .fill("12345678")
  await page
    .getByRole("button", { name: t("settings.qerkoTerminal.requestCode") })
    .click()
  await page
    .getByLabel(t("settings.qerkoTerminal.code.label"))
    .pressSequentially(qerkoPairingCode)
  await page
    .getByRole("button", { name: t("settings.qerkoTerminal.code.confirm") })
    .click()

  await test.step("the empty list points to Qerko support", async () => {
    await expect(
      page.getByText(t("settings.qerkoTerminal.terminals.empty"), {
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByText(t("settings.qerkoTerminal.terminals.empty.help"))
    ).toBeVisible()
  })

  await test.step("a terminal activated meanwhile shows up on try again", async () => {
    qerko.noTerminals = false
    await page
      .getByRole("button", {
        name: t("settings.qerkoTerminal.terminals.retry"),
      })
      .click()
    await expect(page.getByText(qerkoTerminalTid)).toBeVisible()
  })

  await test.step("choosing later ends the wizard without a terminal", async () => {
    await page
      .getByRole("button", {
        name: t("settings.qerkoTerminal.terminals.later"),
      })
      .click()
    await expect(
      page.getByText(t("settings.qerkoTerminal.paired.title"))
    ).toBeVisible()
    await expect(
      page.getByText(t("settings.qerkoTerminal.terminal.none"))
    ).toBeVisible()
  })
})

test("a key Qerko no longer accepts: the terminal list offers to pair again", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  qerko.rejectKey = true

  await test.step("changing the terminal says the pairing is refused", async () => {
    await page
      .getByRole("button", {
        name: t("settings.qerkoTerminal.terminal.change"),
      })
      .click()
    await expect(
      page.getByText(t("settings.qerkoTerminal.terminals.keyRejected"))
    ).toBeVisible()
    // Trying again would be pointless.
    await expect(
      page.getByRole("button", {
        name: t("settings.qerkoTerminal.terminals.retry"),
      })
    ).toHaveCount(0)
  })

  await test.step("pairing again unpairs and returns to the wizard", async () => {
    await page
      .getByRole("button", {
        name: t("settings.qerkoTerminal.terminals.keyRejected.action"),
      })
      .click()
    await page
      .getByRole("button", {
        name: t("settings.qerkoTerminal.unpair.confirm.confirm"),
      })
      .click()
    await expect(
      page.getByLabel(
        t("settings.qerkoTerminal.company.identificationNumber.label")
      )
    ).toBeVisible()
  })
})

test("pay on the terminal with a key Qerko refuses: the screen says to pair again", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  qerko.rejectKey = true

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  await expect(
    page.getByText(t("paymentWait.qerko.error.keyRejected"))
  ).toBeVisible()
  await expect(
    page.getByRole("link", {
      name: t("paymentWait.qerko.error.keyRejected.link"),
    })
  ).toBeVisible()
})

test("pay on the terminal: the step shows while it waits, then the payment is paid", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  qerko.holdPayment = true

  await test.step("start the payment on the terminal", async () => {
    await createPayment(page, "en", "5.9")
    await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
    await page
      .getByRole("button", { name: t("paymentWait.qerko.action") })
      .click()
    await expect(
      page.getByText(t("paymentWait.qerko.step.waitingForCard"))
    ).toBeVisible()
  })

  await test.step("the card is approved", async () => {
    qerko.holdPayment = false
    await expect(
      page.getByTestId("payment-paid-panel").getByText(t("paymentWait.paid"))
    ).toBeVisible()
  })
})

test("pay on the terminal: a declined card says so and the payment can be tried again", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  qerko.holdPayment = true
  qerko.paymentOutcome = "declined"

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  await expect(
    page.getByText(t("paymentWait.qerko.step.waitingForCard"))
  ).toBeVisible()

  qerko.holdPayment = false
  await expect(
    page.getByText(t("paymentWait.qerko.failed.declined"))
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: t("paymentWait.qerko.action") })
  ).toBeEnabled()
})

test("pay on the terminal: cancelling a waiting payment frees it", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  qerko.holdPayment = true

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  await page
    .getByRole("button", { name: t("paymentWait.qerko.cancel") })
    .click()

  await expect(
    page.getByText(t("paymentWait.qerko.failed.cancelled"))
  ).toBeVisible()
  expect(qerko.requests.map(({ path }) => path)).toContain(
    "cancel-terminal-payment"
  )
})

test("an unknown result asks staff to check before paying again", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  qerko.paymentOutcome = "unknown"
  qerko.holdPayment = true

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  qerko.holdPayment = false

  await expect(page.getByText(t("paymentWait.qerko.unresolved"))).toBeVisible()
  await page.getByRole("button", { name: t("paymentWait.qerko.retry") }).click()
  await expect(
    page
      .getByRole("alertdialog")
      .getByText(t("paymentWait.qerko.retryUnresolved.title"))
  ).toBeVisible()
})

test("refund a card payment back to the card through the terminal", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  const paymentId = getPaymentIdFromUrl(page)
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  await expect(
    page.getByTestId("payment-paid-panel").getByText(t("paymentWait.paid"))
  ).toBeVisible()

  await test.step("the refund goes back to the card by default", async () => {
    await waitForLocalWriteToSettle(page)
    await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")
    // The detail names the terminal that took the card.
    await expect(
      page.getByText(
        t("paymentDetail.paymentMethod.qerkoTerminalTid").replace(
          "{tid}",
          qerkoTerminalTid
        )
      )
    ).toBeVisible()
    await openRefundScreen(page, "en")
    // The refund names the terminal the payment was taken on.
    const terminal = refundMethodRadio(
      page,
      t("refund.dialog.method.qerkoTerminalTid").replace(
        "{tid}",
        qerkoTerminalTid
      )
    )
    await expect(terminal).toBeChecked()
    await expect(terminal).toHaveAccessibleName(
      new RegExp(`${escapeRegExp(t("refund.outcome.card"))}$`, "u")
    )
    await refundConfirmButton(page).click()
  })

  await test.step("the terminal's approval is recorded as a refund to the card", async () => {
    // The screen waits for the terminal, then hands back to the payment.
    await expect(page.getByText(t("refund.page.qerko.done"))).toBeVisible()
    await expect(
      page.getByRole("heading", { name: t("paymentDetail.title") })
    ).toBeVisible()
    await expect(page.getByTestId("payment-detail-refund")).toContainText(
      t("paymentDetail.refunds.method.qerkoTerminal")
    )
    expect(
      qerko.requests.find(({ path }) => path === "create-terminal-refund")?.body
    ).toMatchObject({ refundId: "e2e-refund-id", terminalId: "terminal-1" })
  })
})

test("a card refund waiting on a key Qerko refuses: the attempt says to pair again", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  const paymentId = getPaymentIdFromUrl(page)
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  await expect(
    page.getByTestId("payment-paid-panel").getByText(t("paymentWait.paid"))
  ).toBeVisible()
  await waitForLocalWriteToSettle(page)
  await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")

  qerko.holdRefund = true
  await openRefundScreen(page, "en")
  await refundConfirmButton(page).click()
  // The refund screen follows the terminal while it waits for the card.
  const attempt = page.getByTestId("refund-card-progress")
  await expect(
    attempt.getByText(t("paymentWait.qerko.step.waitingForCard"))
  ).toBeVisible()

  qerko.rejectKey = true
  await expect(
    attempt.getByText(t("paymentWait.qerko.error.keyRejected"))
  ).toBeVisible()
  await expect(
    attempt.getByRole("link", {
      name: t("paymentWait.qerko.error.keyRejected.link"),
    })
  ).toBeVisible()
})

test("a card refund when the original terminal is no longer activated: the message says only that terminal can take it", async ({
  seededPage: page,
}) => {
  const qerko = await routeFakeQerko(page)
  await pairQerko(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })

  await createPayment(page, "en", "5.9")
  await page.getByRole("tab", { name: t("paymentWait.method.qerko") }).click()
  const paymentId = getPaymentIdFromUrl(page)
  await page
    .getByRole("button", { name: t("paymentWait.qerko.action") })
    .click()
  await expect(
    page.getByTestId("payment-paid-panel").getByText(t("paymentWait.paid"))
  ).toBeVisible()
  await waitForLocalWriteToSettle(page)
  await gotoPage(page, `/activity/${paymentId}`, "en", "paymentDetail.title")

  qerko.refundNotStarted = "terminalNotActivated"
  await openRefundScreen(page, "en")
  await refundConfirmButton(page).click()

  await expect(
    page.getByText(t("refund.qerko.error.terminalNotActivated"))
  ).toBeVisible()
  // Nothing is recorded, and no other terminal is suggested.
  await expect(page.getByTestId("payment-detail-refund")).toHaveCount(0)
})
