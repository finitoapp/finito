import { useNow } from "@payky/app-shared/use-now"
import {
  claimedTransactionsByBillIdQuery,
  paymentsByBillIdQuery,
} from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  claimedPaymentIdSet,
  deriveBillHistoryItemSummary,
  derivePendingPaymentIds,
} from "@payky/core/modules/bill/bill-utils"
import { billLinesByBillIdQuery } from "@payky/core/modules/bill-line/bill-line-queries"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import {
  calculateBillLineSummaries,
  deriveBillSummaryTotal,
} from "@payky/core/modules/bill-line/bill-line-utils"
import { itemsByBillIdQuery } from "@payky/core/modules/item/item-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useMemo } from "react"
import { useOptionalEvoluQuery } from "../../hooks/use-evolu-query.ts"

// Native counterparts of web's `useBillLineSummaries`, `usePendingPayments`
// and `useBillStatus`: the derivations are core's, only the hooks differ. A bill
// whose row is not written yet (a new cart) simply yields empty results.

/**
 * Every query the hooks below read for `billId`, for a screen's
 * `usePreloadEvoluQueries` (`useBillCoverage` reads only these too).
 */
export const billStateQueries = (billId: BillId) => [
  billByIdQuery(billId),
  billLinesByBillIdQuery(billId),
  itemsByBillIdQuery(billId),
  paymentsByBillIdQuery(billId),
  claimedTransactionsByBillIdQuery(billId),
]

export function useBillLineSummaries(
  billId: BillId
): ReadonlyArray<BillLineSummary> {
  const lineQuery = useMemo(() => billLinesByBillIdQuery(billId), [billId])
  const itemQuery = useMemo(() => itemsByBillIdQuery(billId), [billId])
  const { data: lineRows } = useOptionalEvoluQuery(lineQuery)
  const { data: itemRows } = useOptionalEvoluQuery(itemQuery)

  return useMemo(
    () => calculateBillLineSummaries(lineRows, itemRows),
    [lineRows, itemRows]
  )
}

/**
 * The bill's live payment attempts, which lock cart edits; the same inputs
 * as core's `isBillLocked`, so screen and guard cannot disagree. `useNow`
 * re-renders when the earliest live payment expires.
 */
export function usePendingPayments(billId: BillId): ReadonlyArray<PaymentId> {
  const paymentsQuery = useMemo(() => paymentsByBillIdQuery(billId), [billId])
  const claimedQuery = useMemo(
    () => claimedTransactionsByBillIdQuery(billId),
    [billId]
  )
  const { data: payments } = useOptionalEvoluQuery(paymentsQuery)
  const { data: claimedTransactions } = useOptionalEvoluQuery(claimedQuery)
  const now = useNow(payments.map((payment) => payment.expiresAt))

  return useMemo(
    () =>
      derivePendingPaymentIds(
        payments,
        claimedPaymentIdSet(claimedTransactions),
        now
      ),
    [payments, claimedTransactions, now]
  )
}

/** The bill's derived status; `undefined` until its row exists. */
export function useBillStatus(billId: BillId) {
  const billQuery = useMemo(() => billByIdQuery(billId), [billId])
  const claimedQuery = useMemo(
    () => claimedTransactionsByBillIdQuery(billId),
    [billId]
  )
  const { data: billRows } = useOptionalEvoluQuery(billQuery)
  const { data: claimedTransactions } = useOptionalEvoluQuery(claimedQuery)
  const summaries = useBillLineSummaries(billId)
  const bill = billRows[0]

  return useMemo(() => {
    if (bill === undefined) return undefined

    return deriveBillHistoryItemSummary({
      canceledAt: bill.canceledAt,
      confirmedClosedAt: bill.confirmedClosedAt,
      billTotal: deriveBillSummaryTotal(summaries),
      claimedTransactions,
    })
  }, [bill, summaries, claimedTransactions])
}
