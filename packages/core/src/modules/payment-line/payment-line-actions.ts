import type { MutationOptions } from "@evolu/common"

import { allocateDiscount } from "../bill-line/bill-line-discount-utils.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { removeUndefinedValues } from "../shared/evolu-utils.ts"
import type { PaymentLineRow } from "./payment-line.ts"
import { createPaymentLineId } from "./payment-line-utils.ts"

/**
 * Inserts already-computed payment line rows. Takes the caller's own
 * `MutationOptions` so the writes can join an existing mutation batch
 * instead of always opening a new one.
 */
export const insertPaymentLineRows = (
  evolu: EvoluDep["evolu"],
  lines: ReadonlyArray<Omit<PaymentLineRow, "id">>,
  options: MutationOptions
): void => {
  for (const line of lines) {
    evolu.insert(
      "paymentLine",
      removeUndefinedValues({
        ...line,
        id: createPaymentLineId({
          paymentId: line.paymentId,
          catalogItemId: line.catalogItemId,
          itemId: line.itemId,
          type: line.type,
        }),
      }),
      options
    )
  }
}

/**
 * Freezes a bill's current line-item summaries as `paymentLine` rows tied to
 * `paymentId` — a snapshot of what the bill looked like, from this device's
 * point of view, the instant this payment was created. `payment.amount` is
 * fixed at creation and never renegotiated, but the bill's live total can
 * still drift after that (see docs/bill-payment-states.md's "Bill payment
 * coverage" section) — this is what lets the payment detail page later show
 * *what* changed, not just that the amounts no longer match.
 *
 * Deliberately not derived from `billLine.createdAt` after the fact: under
 * CRDT/multi-device sync, a device can create a payment before it has synced
 * an earlier (by timestamp) edit from another device, so filtering the
 * ledger by "created before this payment" would include changes this device
 * never actually saw. Only capturing the actual computed summaries *at
 * write time* is reliable.
 *
 * Each goods line is frozen with its share of the bill's discount
 * (`allocateDiscount`, catalog/0003), the discount line itself as it stands,
 * below zero, so the payment detail can show it. What the payment's VAT
 * recap, its Qerko receipt and a refund read is then fixed with the payment,
 * whatever the allocation does later.
 */
export const snapshotBillLinesForPayment = (
  evolu: EvoluDep["evolu"],
  paymentId: PaymentId,
  summaries: ReadonlyArray<BillLineSummary>,
  options: MutationOptions
): void => {
  insertPaymentLineRows(
    evolu,
    allocateDiscount(summaries).map((summary) => ({
      paymentId,
      billId: summary.billId,
      catalogItemId: summary.catalogItemId,
      itemId: summary.itemId,
      type: summary.type,
      quantity: summary.quantity,
      totalAmount: summary.totalAmount,
      discountShare: summary.discountShare,
    })),
    options
  )
}
