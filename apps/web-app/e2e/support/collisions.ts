import type { Language } from "@payky/web-shared/landing-redirect"
import type { Page } from "@playwright/test"
import { translate } from "./i18n.ts"
import { waitForLocalWriteToSettle } from "./navigation.ts"
import {
  getPaymentIdFromUrl,
  markCashPaidAndSettle,
  startBillAndBeginCashPayment,
} from "./payment.ts"

/**
 * Runner-agnostic: `bin/generate-doc-screenshots.ts` imports these helpers
 * outside the Playwright test runner, so nothing here may call `test.step(...)`
 * — it throws "test.step() can only be called from a test" there.
 */
/**
 * Simulates the CRDT merge race documented in docs/bill-payment-states.md
 * via `window.__e2eSimulateCancelAfterClaim` (see
 * src/components/app/e2e-test-bridge.tsx): cancels the current (already-claimed)
 * payment directly, bypassing `cancelPayment`'s guard, so it ends up
 * canceled+claimed — the collision the payment-detail/payment-history UI
 * surfaces via `confirmPaymentPaidDespiteCancellation`. Assumes the page is
 * still on the `/payment/$paymentId` URL for that payment (e.g. right after
 * `markCashPaid`).
 */
export async function simulateCancelAfterClaim(
  page: Page,
  language: Language
): Promise<void> {
  const paymentId = getPaymentIdFromUrl(page)

  await page.waitForFunction(
    () => typeof window.__e2eSimulateCancelAfterClaim === "function"
  )
  await page.evaluate(
    (id) => window.__e2eSimulateCancelAfterClaim?.(id),
    paymentId
  )

  // Wait for this same page's own reactive query to reflect the
  // cancellation (it renders `paymentWait.canceled` once `canceledAt` is
  // non-null — see `_terminal.payment_.$paymentId.tsx`) before letting the
  // caller navigate away — a full-page navigation right after the bridge
  // call can otherwise race ahead of the in-memory update. Even then, a
  // hard navigation immediately afterward can still occasionally load a
  // snapshot from just before local storage caught up (unlike every other
  // mutation in this file, `simulateCancelAfterClaim` goes through
  // `evolu.update` directly rather than a real domain action, so this is
  // the only place that races a fresh page load this closely) — the extra
  // wait below gives that a moment to settle.
  await page.getByText(translate(language, "paymentWait.canceled")).waitFor()
  await waitForLocalWriteToSettle(page)
}

/**
 * Simulates a second offline device independently settling the current
 * (already cash-claimed) payment through its other prepared method — IBAN —
 * via `window.__e2eSimulateDuplicateSettlement` (see
 * src/components/app/e2e-test-bridge.tsx). Produces the duplicate-settlement
 * collision: the payment ends up claimed for more than its own amount.
 * Assumes the page is still on the `/payment/$paymentId` URL for that
 * payment (e.g. right after `markCashPaid`), and that the payment was
 * created with `createPayment` (which prepares both cash and IBAN).
 */
export async function simulateDuplicateSettlement(page: Page): Promise<void> {
  const paymentId = getPaymentIdFromUrl(page)

  await page.waitForFunction(
    () => typeof window.__e2eSimulateDuplicateSettlement === "function"
  )
  await page.evaluate(
    (id) => window.__e2eSimulateDuplicateSettlement?.(id),
    paymentId
  )
}

/**
 * Simulates another, still-offline device editing `billId`'s line items
 * while a payment against it is in flight, via
 * `window.__e2eSimulateBillModifiedDuringPayment` (see
 * src/components/app/e2e-test-bridge.tsx) — bypasses `requireEditableBill`'s
 * lock, which only prevents this on the *same* device the pending payment
 * is visible on. `mode: "add"` grows the bill's total past the payment's
 * already-fixed amount (underpaid once claimed); `mode: "removeAll"`
 * shrinks it below (overpaid once claimed). See
 * docs/bill-payment-states.md's "Bill payment coverage" section.
 */
export async function simulateBillModifiedDuringPayment(
  page: Page,
  billId: string,
  mode: "add" | "removeAll"
): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__e2eSimulateBillModifiedDuringPayment === "function"
  )
  await page.evaluate(
    ({ id, mode: pickedMode }) =>
      window.__e2eSimulateBillModifiedDuringPayment?.(id, pickedMode),
    { id: billId, mode }
  )
}

/**
 * Creates and pays a *second*, independent payment for `billId` via
 * `window.__e2eCreateAndPaySecondPayment` (see
 * src/components/app/e2e-test-bridge.tsx) — the real `createPayment`/
 * `markPaymentPaidCash` actions, not a bypass. Split payments are an
 * intended capability, but a second device is needed to start one
 * concurrently with the current payment. Produces a genuine overpaid bill
 * once both are claimed.
 */
export async function createAndPaySecondPayment(
  page: Page,
  billId: string
): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__e2eCreateAndPaySecondPayment === "function"
  )
  await page.evaluate(
    (id) => window.__e2eCreateAndPaySecondPayment?.(id),
    billId
  )
}

/**
 * Cancels `billId` directly via `window.__e2eCancelBill` (see
 * src/components/app/e2e-test-bridge.tsx) — the real `cancelBill` action,
 * called directly because the bill page's own UI hides the cart's discard
 * button while a payment is pending, making this transition (allowed by the
 * domain guard, not by the UI) hard to trigger by clicking through. Unlike
 * `simulateCancelAfterClaim`, this goes through the real action (the same
 * one `runMutationWithCompletion`-backed path a UI click would use), so it
 * doesn't need the extra settle time that bypassing the guard does.
 */
export async function cancelBillDirectly(
  page: Page,
  billId: string
): Promise<void> {
  await page.waitForFunction(() => typeof window.__e2eCancelBill === "function")
  await page.evaluate((id) => window.__e2eCancelBill?.(id), billId)
}

/**
 * `startBillAndBeginCashPayment`, then cancels the bill directly while that
 * payment is still pending and confirms it paid anyway — the canceled+funded
 * collision from docs/bill-payment-states.md. Shared setup for every spec
 * that checks how a surface (the bill cart page, the bills list/detail
 * pages, the payment detail page) displays or resolves this collision,
 * instead of each hand-rolling the same cart → payment → cancel → pay
 * sequence.
 */
export async function startCollisionBill(
  page: Page,
  language: Language
): Promise<{ readonly billId: string; readonly paymentPageUrl: string }> {
  const billId = await startBillAndBeginCashPayment(page, language)
  const paymentPageUrl = page.url()
  await cancelBillDirectly(page, billId)
  await markCashPaidAndSettle(page, language)
  return { billId, paymentPageUrl }
}
