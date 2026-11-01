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
  const paymentLineQuery = paymentLinesByPaymentIdQuery(paymentId)
  const { data: paymentLineRows } = useEvoluQuery(paymentLineQuery)
  // Scoped to the payment, not the bill: a frozen `paymentLine` can point at
  // an item the bill no longer carries, which is exactly what this diff is
  // here to report.
  const itemQuery = itemsByPaymentIdQuery(paymentId)
  const { data: itemRows } = useEvoluQuery(itemQuery)

  return useMemo(() => {
    if (paymentLineRows.length === 0) return null
    const expected = paymentLinesToBillLineSummaries(paymentLineRows, itemRows)
    return deriveBillLineSummaryDiff(expected, current)
  }, [paymentLineRows, itemRows, current])
}
