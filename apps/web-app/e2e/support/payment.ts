import type { Language } from "@payky/app-shared/i18n/resources"
import type { Locator, Page } from "@playwright/test"
import { startBillWithCoffee } from "./bill.ts"
import { translate } from "./i18n.ts"
import { waitForLocalWriteToSettle } from "./navigation.ts"

/**
 * Runner-agnostic: `bin/generate-doc-screenshots.ts` imports these helpers
 * outside the Playwright test runner, so nothing here may call `test.step(...)`
 * — it throws "test.step() can only be called from a test" there.
 */
export async function enterAmount(
  page: Page,
  language: Language,
  amount = "5.9"
): Promise<void> {
  for (const key of amount) {
    await page
      .getByRole("button", {
        name: key === "." ? translate(language, "home.keypad.decimal") : key,
        exact: true,
      })
      .click()
  }
}

export async function createPayment(
  page: Page,
  language: Language,
  amount?: string
): Promise<void> {
  await enterAmount(page, language, amount)
  await page
    .getByRole("button", { name: translate(language, "home.pay") })
    .click()

  const ibanTab = page.getByRole("tab", {
    name: translate(language, "paymentWait.method.iban"),
  })
  const skipTipButton = page.getByRole("button", {
    name: translate(language, "paymentTip.none"),
  })
  await ibanTab.or(skipTipButton).first().waitFor()

  if (await skipTipButton.isVisible()) {
    await skipTipButton.click()
    await ibanTab.waitFor()
  }
}

export async function enterCashReceived(
  page: Page,
  language: Language,
  received: string
): Promise<void> {
  await page
    .getByLabel(translate(language, "paymentWait.cashPaid.received"))
    .fill(received)
}

export async function markCashPaid(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", {
      name: translate(language, "paymentWait.cashPaid.action"),
    })
    .click()
  await page
    .getByTestId("payment-paid-panel")
    .getByText(translate(language, "paymentWait.paid"))
    .waitFor()
}

/**
 * `markCashPaid`, then waits for that write to settle (see
 * `waitForLocalWriteToSettle`) before the caller navigates away or reloads —
 * a hard navigation right after `markCashPaid` can otherwise race ahead of
 * it and load a stale snapshot.
 */
export async function markCashPaidAndSettle(
  page: Page,
  language: Language
): Promise<void> {
  await markCashPaid(page, language)
  await waitForLocalWriteToSettle(page)
}

/**
 * Selects the Lightning/Spark tab on the payment-wait screen and waits for
 * the invoice to finish preparing (the QR code becomes renderable), so the
 * payment has an `lnInvoice`/`sparkInvoice` for `markSparkPaid` to match
 * against.
 */
export async function prepareSparkPayment(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("tab", {
      name: translate(language, "paymentWait.method.lightning"),
    })
    .click()
  // The button also contains a spinner `<svg>` (lucide's LoaderCircleIcon)
  // while preparing, so match the QR code's own class rather than any `svg`.
  await page
    .getByRole("button", { name: translate(language, "paymentWait.copyQr") })
    .locator("svg.size-full")
    .waitFor()
}

/** Reads the payment id off the current `/payment/$paymentId` URL. */
export function getPaymentIdFromUrl(page: Page): string {
  const paymentId = new URL(page.url()).pathname.split("/").pop()
  if (!paymentId) {
    throw new Error(`Could not determine payment id from URL ${page.url()}`)
  }
  return paymentId
}

/**
 * Simulates an incoming Spark transfer settling the current payment via
 * `window.__e2eMarkSparkPaid` (see src/components/app/e2e-test-bridge.tsx) —
 * there is no real counterparty to pay the Lightning invoice in a test run.
 */
export async function markSparkPaid(
  page: Page,
  language: Language
): Promise<void> {
  const paymentId = getPaymentIdFromUrl(page)

  await page.waitForFunction(
    () => typeof window.__e2eMarkSparkPaid === "function"
  )
  await page.evaluate((id) => window.__e2eMarkSparkPaid?.(id), paymentId)
  await page
    .getByTestId("payment-paid-panel")
    .getByText(translate(language, "paymentWait.paid"))
    .waitFor()
}

/**
 * Selects the Cashu tab on the payment-wait screen and waits for the mint's
 * QR. Needs the fake mint (`window.__e2eCashuMint`) and Cashu enabled.
 */
export async function prepareCashuPayment(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("tab", { name: translate(language, "paymentWait.method.cashu") })
    .click()
  await page
    .getByRole("button", { name: translate(language, "paymentWait.copyQr") })
    .locator("svg.size-full")
    .waitFor()
}

/**
 * The customer pays the fake mint's open quotes, and the payment settles once
 * the Cashu job sees it. Returns how many quotes were paid. The fake mint
 * lives in the page, so do not reload before this returns.
 */
export async function markCashuPaid(
  page: Page,
  language: Language
): Promise<number> {
  await page.waitForFunction(
    () => typeof window.__e2eCashuPayQuotes === "function"
  )
  const paid = (await page.evaluate(() => window.__e2eCashuPayQuotes?.())) ?? 0
  // The panel is always mounted and only shown through `aria-hidden`, so
  // its text alone would match before the payment is paid.
  await page
    .locator('[data-testid="payment-paid-panel"][aria-hidden="false"]')
    .getByText(translate(language, "paymentWait.paid"))
    .waitFor({ timeout: 30_000 })
  return paid
}

/**
 * Selects the IBAN tab on the payment-wait screen and waits for the bank QR
 * to finish preparing, so the payment has a `variableSymbol` for
 * `markIbanPaid` to match against.
 */
export async function prepareIbanPayment(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("tab", { name: translate(language, "paymentWait.method.iban") })
    .click()
  await page
    .getByRole("button", { name: translate(language, "paymentWait.copyQr") })
    .locator("svg.size-full")
    .waitFor()
}

/**
 * Simulates an incoming bank transaction settling the current IBAN payment
 * via `window.__e2eMarkIbanPaid` (see src/components/app/e2e-test-bridge.tsx) —
 * there is no real bank transfer in a test run.
 */
export async function markIbanPaid(
  page: Page,
  language: Language
): Promise<void> {
  const paymentId = getPaymentIdFromUrl(page)

  await page.waitForFunction(
    () => typeof window.__e2eMarkIbanPaid === "function"
  )
  await page.evaluate((id) => window.__e2eMarkIbanPaid?.(id), paymentId)
  await page
    .getByTestId("payment-paid-panel")
    .getByText(translate(language, "paymentWait.paid"))
    .waitFor()
}

/**
 * `startBillWithCoffee`, then begins a cash payment for it, skipping the tip
 * screen — shared setup for specs that need a bill mid-payment (coverage-
 * mismatch and collision scenarios). Leaves the page on the payment wait
 * screen, not yet marked paid.
 */
export async function startBillAndBeginCashPayment(
  page: Page,
  language: Language
): Promise<string> {
  const billId = await startBillWithCoffee(page, language)

  await page
    .getByRole("button", { name: translate(language, "home.pay") })
    .click()
  const skipTipButton = page.getByRole("button", {
    name: translate(language, "paymentTip.none"),
  })
  const cashPaidButton = page.getByRole("button", {
    name: translate(language, "paymentWait.cashPaid.action"),
  })
  await skipTipButton.or(cashPaidButton).first().waitFor()
  if (await skipTipButton.isVisible()) {
    await skipTipButton.click()
    await cashPaidButton.waitFor()
  }

  return billId
}

export async function openRefundDialog(
  page: Page,
  language: Language
): Promise<Locator> {
  await page
    .getByRole("button", {
      name: translate(language, "paymentDetail.refunds.action"),
    })
    .click()
  return page.getByRole("dialog")
}

export async function refundFromPaymentDetail(
  page: Page,
  language: Language,
  {
    items = [],
    outside = false,
  }: { readonly items?: ReadonlyArray<string>; readonly outside?: boolean } = {}
): Promise<void> {
  const dialog = await openRefundDialog(page, language)
  if (outside) {
    await dialog
      .getByRole("button", {
        name: translate(language, "refund.dialog.method.outside"),
      })
      .click()
  }
  if (items.length > 0) {
    await dialog
      .getByRole("button", {
        name: translate(language, "refund.dialog.mode.items"),
      })
      .click()
    for (const name of items) {
      await dialog
        .getByRole("button", {
          name: translate(language, "refund.dialog.items.increase").replace(
            "{name}",
            name
          ),
        })
        .click()
    }
  }
  const [confirmPrefix = ""] = translate(
    language,
    "refund.dialog.confirm"
  ).split("{amount}")
  await dialog
    .getByRole("button", { name: new RegExp(`^${confirmPrefix}.+`, "u") })
    .click()
  await dialog.waitFor({ state: "hidden" })
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

export async function refundTipFromPaymentDetail(
  page: Page,
  language: Language
): Promise<void> {
  const [actionPrefix = ""] = translate(
    language,
    "paymentDetail.refunds.tipAction"
  ).split("{amount}")
  await page
    .getByRole("button", {
      name: new RegExp(`^${escapeRegExp(actionPrefix)}`, "u"),
    })
    .click()
  const dialog = page.getByRole("dialog")
  const [confirmPrefix = ""] = translate(
    language,
    "refund.dialog.confirm"
  ).split("{amount}")
  await dialog
    .getByRole("button", {
      name: new RegExp(`^${escapeRegExp(confirmPrefix)}.+`, "u"),
    })
    .click()
  await dialog.waitFor({ state: "hidden" })
}
