import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  type BillLineSummaryDiff,
  deriveBillLineSummaryDiff,
} from "@payky/core/modules/bill-line/bill-line-utils"
import { itemsByPaymentIdQuery } from "@payky/core/modules/item/item-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentLinesByPaymentIdQuery } from "@payky/core/modules/payment-line/payment-line-queries"
import { paymentLinesToBillLineSummaries } from "@payky/core/modules/payment-line/payment-line-utils"
import { useMemo } from "react"
import { useBillLineSummaries } from "@/features/shared/use-bill-line-summaries.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

/**
 * What `useBillLineSummaryDiff` reads beyond `billStateQueries`, for a
 * screen's `usePreloadEvoluQueries`.
 */
export const billLineSummaryDiffQueries = (paymentId: PaymentId) => [
  paymentLinesByPaymentIdQuery(paymentId),
  itemsByPaymentIdQuery(paymentId),
]

/**
 * The bill lines frozen when `paymentId` was created (see
 * `snapshotBillLinesForPayment`), each with its frozen `discountShare`;
 * `null` when the payment predates the snapshot — see
 * `paymentLinesByPaymentIdQuery`'s doc comment.
 */
export function usePaymentLineSummaries(paymentId: PaymentId) {
  const paymentLineQuery = paymentLinesByPaymentIdQuery(paymentId)
  const { data: paymentLineRows } = useEvoluQuery(paymentLineQuery)
  // Scoped to the payment, not the bill: a frozen `paymentLine` can point at
  // an item the bill no longer carries, which is exactly what the diff below
  // is here to report.
  const itemQuery = itemsByPaymentIdQuery(paymentId)
  const { data: itemRows } = useEvoluQuery(itemQuery)

  return useMemo(
    () =>
      paymentLineRows.length === 0
        ? null
        : paymentLinesToBillLineSummaries(paymentLineRows, itemRows),
    [paymentLineRows, itemRows]
  )
}

/**
 * Compares the bill-line snapshot frozen when `paymentId` was created (see
 * `snapshotBillLinesForPayment`) against the bill's current line-item
 * summaries. `null` when there is no snapshot to compare against — the
 * payment was created before this feature existed (the common case for any
 * pre-existing payment) — see `paymentLinesByPaymentIdQuery`'s doc comment.
 */
export function useBillLineSummaryDiff(
  paymentId: PaymentId,
  billId: BillId
): BillLineSummaryDiff | null {
  const current = useBillLineSummaries(billId)
  const expected = usePaymentLineSummaries(paymentId)

  return useMemo(
    () =>
      expected === null ? null : deriveBillLineSummaryDiff(expected, current),
    [expected, current]
  )
}
