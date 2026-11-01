import {
  claimedTransactionsByBillIdQuery,
  paymentsByBillIdQuery,
} from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { billLinesByBillIdQuery } from "@payky/core/modules/bill-line/bill-line-queries"
import { itemsByBillIdQuery } from "@payky/core/modules/item/item-queries"

/**
 * Every query the bill-state hooks read for `billId` (`useBillLineSummaries`,
 * `useBillStatus`, `usePendingPayments`, `useBillCoverage`), for a screen's
 * `usePreloadEvoluQueries`.
 */
export const billStateQueries = (billId: BillId) => [
  billByIdQuery(billId),
  billLinesByBillIdQuery(billId),
  itemsByBillIdQuery(billId),
  paymentsByBillIdQuery(billId),
  claimedTransactionsByBillIdQuery(billId),
]
