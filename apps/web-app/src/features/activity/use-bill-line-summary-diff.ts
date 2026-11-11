import { itemsByPaymentIdQuery } from "@payky/core/modules/item/item-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentLinesByPaymentIdQuery } from "@payky/core/modules/payment-line/payment-line-queries"
import { paymentLinesToBillLineSummaries } from "@payky/core/modules/payment-line/payment-line-utils"
import { useMemo } from "react"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

/**
 * What `usePaymentLineSummaries` reads, for a screen's
 * `usePreloadEvoluQueries`.
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
  // an item the bill no longer carries, which is exactly what comparing it
  // with the bill (`deriveBillLineSummaryDiff`) is there to report.
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
