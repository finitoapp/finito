import { claimedPaymentsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { eetSalesByPaymentIdQuery } from "@payky/core/modules/eet/eet-queries"
import {
  paymentCardSwitchioDetailQuery,
  paymentDetailQuery,
  paymentReconciliationsQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentNumberByPaymentIdQuery } from "@payky/core/modules/payment-number/payment-number-queries"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { evoluAtom } from "../../atoms/evolu.ts"
import { billStateQueries } from "../shared/use-bill-state.ts"
import { billLineSummaryDiffQueries } from "./use-bill-detail-data.ts"
import { paymentRefundsQueries } from "./use-payment-refund-state.ts"

/**
 * What a payment's detail and the cards under it read that needs only the
 * payment's id; the bill's card, once the bill is known, reads
 * `paymentBillCardQueries`. Both are the screen's `usePreloadEvoluQueries`.
 */
export const paymentDetailQueries = (paymentId: PaymentId) => [
  paymentDetailQuery(paymentId),
  paymentReconciliationsQuery(paymentId),
  paymentNumberByPaymentIdQuery(paymentId),
  eetSalesByPaymentIdQuery(paymentId),
  qerkoPaymentAttemptsByPaymentIdQuery(paymentId),
  paymentCardSwitchioDetailQuery(paymentId),
  ...paymentRefundsQueries(paymentId),
]

/** What the payment's bill card reads. */
export const paymentBillCardQueries = (
  billId: BillId,
  paymentId: PaymentId
) => [
  ...billStateQueries(billId),
  ...billLineSummaryDiffQueries(paymentId),
  tablesQuery,
  taxRatesQuery,
  claimedPaymentsByBillIdQuery(billId),
]

/**
 * Starts loading a payment's detail as the row that opens it is pressed,
 * its bill's card too when the row knows the bill: otherwise the screen
 * commits its skeleton, and the bill's card suspends a second time once
 * the payment names its bill, which React may hold back up to 300 ms.
 */
export function usePreloadPaymentDetail(): (
  paymentId: PaymentId,
  billId: BillId | null
) => void {
  const evolu = useAtomValue(evoluAtom)
  return useCallback(
    (paymentId: PaymentId, billId: BillId | null) => {
      // Only warms Evolu's cache: the screen reads, and reports, the same
      // queries itself.
      void Promise.allSettled(
        evolu.loadQueries([
          ...paymentDetailQueries(paymentId),
          ...(billId === null ? [] : paymentBillCardQueries(billId, paymentId)),
        ])
      )
    },
    [evolu]
  )
}
