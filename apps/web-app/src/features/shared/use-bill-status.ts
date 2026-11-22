import { claimedTransactionsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId, BillStatus } from "@payky/core/modules/bill/bill-types"
import { deriveBillHistoryItemSummary } from "@payky/core/modules/bill/bill-utils"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
import type { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useMemo } from "react"
import { useBillLineSummaries } from "@/features/shared/use-bill-line-summaries.ts"
import { useOptionalEvoluQuery } from "@/hooks/use-evolu-query.ts"

interface BillStatusInfo {
  readonly status: BillStatus
  /**
   * The canceled+funded collision from docs/bill-payment-states.md: the
   * bill was discarded, but its payments already cover its total —
   * `deriveBillStatus` still reads `canceled` until staff explicitly
   * resolves it via `confirmBillClosedDespiteCancellation`.
   */
  readonly hasCancellationCollision: boolean
  readonly claimedSum: NonNegativeInteger
  readonly amountDue: NonNegativeInteger
}

/**
 * Reactive equivalent of `loadBillStatus`: the bill's *derived* display
 * status, recomputed live from `canceledAt`/`confirmedClosedAt` and
 * coverage every time the underlying line/payment/claim rows change. Never
 * reads the best-effort `closedAt` cache — see `bill.ts`'s doc comment and
 * docs/bill-payment-states.md. `undefined` until the bill row has loaded,
 * and for an `undefined` `billId` — a cart whose bill hasn't been lazily
 * created yet.
 */
export function useBillStatus(
  billId: BillId | undefined
): BillStatusInfo | undefined {
  const billQuery = useMemo(
    () => (billId === undefined ? null : billByIdQuery(billId)),
    [billId]
  )
  const claimedQuery = useMemo(
    () =>
      billId === undefined ? null : claimedTransactionsByBillIdQuery(billId),
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
