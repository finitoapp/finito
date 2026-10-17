import type { Id } from "@evolu/common"
import {
  type OverpaymentEntry,
  toOverpaymentInputs,
} from "@payky/app-shared/overpayment-input"
import type { AppSchema } from "@payky/core/evolu/schema"
import {
  overpaymentPaymentsQuery,
  overpaymentTransactionsQuery,
} from "@payky/core/modules/bill/bill-coverage-queries"
import type { OverpaymentScope } from "@payky/core/modules/bill/bill-types"
import type { BillOverpaymentInput } from "@payky/core/modules/bill/bill-utils"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
import { overpaymentResolutionsQuery } from "@payky/core/modules/overpayment-resolution/overpayment-resolution-queries"
import { overpaymentRefundsQuery } from "@payky/core/modules/refund/refund-queries"
import {
  mapWriteClocks,
  writeClocksQuery,
} from "@payky/core/modules/shared/evolu-history-queries"
import { useDeferredValue, useMemo } from "react"
import { useBillLineSummaries } from "@/features/shared/use-bill-line-summaries.ts"
import { useBillStatus } from "@/features/shared/use-bill-status.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import { useOptionalEvoluQuery } from "@/hooks/use-evolu-query.ts"

const useWriteClocks = <TId extends Id>(
  table: keyof typeof AppSchema,
  ids: ReadonlyArray<TId>,
  column?: string
) => {
  const evolu = useEvolu()
  const loadedIds = useDeferredValue(ids)
  const { data } = useOptionalEvoluQuery(
    loadedIds.length === 0
      ? null
      : writeClocksQuery({
          ownerId: evolu.appOwner.id,
          table,
          column,
          ids: loadedIds,
          pick: "first",
        })
  )
  return useMemo(() => mapWriteClocks(loadedIds, data), [loadedIds, data])
}

export function useOverpaymentInputs(
  entries: ReadonlyArray<OverpaymentEntry>
): ReadonlyMap<string, BillOverpaymentInput> {
  const billIds = entries.flatMap((entry) =>
    "billId" in entry ? [entry.billId] : []
  )
  const paymentIds = entries.flatMap((entry) =>
    "paymentId" in entry ? [entry.paymentId] : []
  )
  const scopes =
    billIds.length + paymentIds.length === 0 ? null : { billIds, paymentIds }
  const { data: payments } = useOptionalEvoluQuery(
    scopes === null ? null : overpaymentPaymentsQuery(scopes)
  )
  const { data: transactions } = useOptionalEvoluQuery(
    scopes === null ? null : overpaymentTransactionsQuery(scopes)
  )
  const { data: refunds } = useOptionalEvoluQuery(
    scopes === null ? null : overpaymentRefundsQuery(scopes)
  )
  const { data: resolutions } = useOptionalEvoluQuery(
    scopes === null ? null : overpaymentResolutionsQuery(scopes)
  )
  const clocks = {
    claims: useWriteClocks(
      "reconciliationClaim",
      useMemo(() => transactions.map(({ claimId }) => claimId), [transactions])
    ),
    refunds: useWriteClocks(
      "refund",
      useMemo(() => refunds.map(({ id }) => id), [refunds])
    ),
    resolutions: useWriteClocks(
      "overpaymentResolution",
      useMemo(() => resolutions.map(({ id }) => id), [resolutions])
    ),
    acknowledgements: useWriteClocks(
      "payment",
      useMemo(
        () =>
          payments
            .filter(({ excessAcknowledgedAt }) => excessAcknowledgedAt !== null)
            .map(({ id }) => id),
        [payments]
      ),
      "excessAcknowledgedAt"
    ),
  }

  return toOverpaymentInputs(
    entries,
    { payments, transactions, refunds, resolutions },
    clocks
  )
}

export function useOverpaymentInput(
  scope: OverpaymentScope
): BillOverpaymentInput | undefined {
  const { billId, paymentId } = scope
  const billStatus = useBillStatus(billId)
  const summaries = useBillLineSummaries(billId)
  const entries: ReadonlyArray<OverpaymentEntry> =
    billId === undefined
      ? [{ paymentId }]
      : billStatus === undefined
        ? []
        : [
            {
              billId,
              billTotal: deriveBillSummaryTotal(summaries),
              isCanceled: billStatus.status === "canceled",
            },
          ]
  return useOverpaymentInputs(entries).get(billId ?? paymentId)
}
