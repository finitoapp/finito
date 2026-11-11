import { claimedTransactionsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import type { BillCoverageSummary } from "@payky/core/modules/bill/bill-guards"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  calculateClaimedSum,
  deriveBillCoverage,
} from "@payky/core/modules/bill/bill-utils"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
import { itemsByPaymentIdQuery } from "@payky/core/modules/item/item-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentLinesByPaymentIdQuery } from "@payky/core/modules/payment-line/payment-line-queries"
import { paymentLinesToBillLineSummaries } from "@payky/core/modules/payment-line/payment-line-utils"
import { useMemo } from "react"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useBillLineSummaries } from "../shared/use-bill-state.ts"

// Native counterparts of web's `useBillCoverage` and `usePaymentLineSummaries`:
// the derivations are core's, only the query hooks differ.

/**
 * What `usePaymentLineSummaries` reads, for a screen's
 * `usePreloadEvoluQueries`.
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
 * The bill lines frozen when `paymentId` was created, each with its frozen
 * `discountShare`; `null` when the payment predates the snapshot.
 */
export function usePaymentLineSummaries(paymentId: PaymentId) {
  const lineQuery = useMemo(
    () => paymentLinesByPaymentIdQuery(paymentId),
    [paymentId]
  )
  const { data: paymentLineRows } = useEvoluQuery(lineQuery)
  // Scoped to the payment, not the bill: a frozen `paymentLine` can point at
  // an item the bill no longer carries, which is exactly what comparing it
  // with the bill (`deriveBillLineSummaryDiff`) reports.
  const itemQuery = useMemo(() => itemsByPaymentIdQuery(paymentId), [paymentId])
  const { data: itemRows } = useEvoluQuery(itemQuery)

  return useMemo(
    () =>
      paymentLineRows.length === 0
        ? null
        : paymentLinesToBillLineSummaries(paymentLineRows, itemRows),
    [paymentLineRows, itemRows]
  )
}
