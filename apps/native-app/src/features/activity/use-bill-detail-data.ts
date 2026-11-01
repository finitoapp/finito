import { claimedTransactionsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import type { BillCoverageSummary } from "@payky/core/modules/bill/bill-guards"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  calculateClaimedSum,
  deriveBillCoverage,
} from "@payky/core/modules/bill/bill-utils"
import {
  type BillLineSummaryDiff,
  deriveBillLineSummaryDiff,
  deriveBillSummaryTotal,
} from "@payky/core/modules/bill-line/bill-line-utils"
import { itemsByPaymentIdQuery } from "@payky/core/modules/item/item-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentLinesByPaymentIdQuery } from "@payky/core/modules/payment-line/payment-line-queries"
import { paymentLinesToBillLineSummaries } from "@payky/core/modules/payment-line/payment-line-utils"
import { useMemo } from "react"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useBillLineSummaries } from "../shared/use-bill-state.ts"

// Native counterparts of web's `useBillCoverage` and `useBillLineSummaryDiff`:
// the derivations are core's, only the query hooks differ.

/**
 * What `useBillLineSummaryDiff` reads beyond `billStateQueries`, for a
 * screen's `usePreloadEvoluQueries`.
 */
export const billLineSummaryDiffQueries = (paymentId: PaymentId) => [
  paymentLinesByPaymentIdQuery(paymentId),
  itemsByPaymentIdQuery(paymentId),
]

/** Live billTotal/claimedSum/coverage (docs/bill-payment-states.md). */
export function useBillCoverage(billId: BillId): BillCoverageSummary {
  const summaries = useBillLineSummaries(billId)
  const claimedQuery = useMemo(
    () => claimedTransactionsByBillIdQuery(billId),
    [billId]
  )
  const { data: claimedTransactions } = useEvoluQuery(claimedQuery)

  return useMemo(() => {
    const billTotal = deriveBillSummaryTotal(summaries)
    const claimedSum = calculateClaimedSum(claimedTransactions)
    return {
      billTotal,
      claimedSum,
      coverage: deriveBillCoverage(billTotal, claimedSum),
    }
  }, [summaries, claimedTransactions])
}

/**
 * The bill-line snapshot frozen when `paymentId` was created against the
 * bill's current lines; `null` when the payment predates the snapshot.
 */
export function useBillLineSummaryDiff(
  paymentId: PaymentId,
  billId: BillId
): BillLineSummaryDiff | null {
  const current = useBillLineSummaries(billId)
  const lineQuery = useMemo(
    () => paymentLinesByPaymentIdQuery(paymentId),
    [paymentId]
  )
  const { data: paymentLineRows } = useEvoluQuery(lineQuery)
  // Scoped to the payment, not the bill: a frozen `paymentLine` can point at
  // an item the bill no longer carries, which is exactly what this reports.
  const itemQuery = useMemo(() => itemsByPaymentIdQuery(paymentId), [paymentId])
  const { data: itemRows } = useEvoluQuery(itemQuery)

  return useMemo(() => {
    if (paymentLineRows.length === 0) return null
    const expected = paymentLinesToBillLineSummaries(paymentLineRows, itemRows)
    return deriveBillLineSummaryDiff(expected, current)
  }, [paymentLineRows, itemRows, current])
}
