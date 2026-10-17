import type { InferRow } from "@evolu/common"
import type {
  overpaymentPaymentsQuery,
  overpaymentTransactionsQuery,
} from "@payky/core/modules/bill/bill-coverage-queries"
import {
  type OverpaymentClocks,
  toBillOverpaymentInput,
} from "@payky/core/modules/bill/bill-overpayment-utils"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { BillOverpaymentInput } from "@payky/core/modules/bill/bill-utils"
import type { overpaymentResolutionsQuery } from "@payky/core/modules/overpayment-resolution/overpayment-resolution-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type { overpaymentRefundsQuery } from "@payky/core/modules/refund/refund-queries"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"

export type OverpaymentEntry =
  | {
      readonly billId: BillId
      readonly billTotal: NonNegativeInteger
      readonly isCanceled: boolean
    }
  | { readonly paymentId: PaymentId }

export interface OverpaymentQueryRows {
  readonly payments: ReadonlyArray<
    InferRow<ReturnType<typeof overpaymentPaymentsQuery>>
  >
  readonly transactions: ReadonlyArray<
    InferRow<ReturnType<typeof overpaymentTransactionsQuery>>
  >
  readonly refunds: ReadonlyArray<
    InferRow<ReturnType<typeof overpaymentRefundsQuery>>
  >
  readonly resolutions: ReadonlyArray<
    InferRow<ReturnType<typeof overpaymentResolutionsQuery>>
  >
}

export const toOverpaymentInputs = (
  entries: ReadonlyArray<OverpaymentEntry>,
  { payments, transactions, refunds, resolutions }: OverpaymentQueryRows,
  clocks: OverpaymentClocks
): ReadonlyMap<string, BillOverpaymentInput> =>
  new Map(
    entries.flatMap(
      (entry): ReadonlyArray<readonly [string, BillOverpaymentInput]> => {
        if ("billId" in entry) {
          const belongs = (row: { readonly billId: BillId | null }) =>
            row.billId === entry.billId
          return [
            [
              entry.billId,
              toBillOverpaymentInput(
                {
                  billTotal: entry.billTotal,
                  isCanceled: entry.isCanceled,
                  payments: payments.filter(belongs),
                  transactions: transactions.filter(belongs),
                  refunds: refunds.filter(belongs),
                  resolutions: resolutions.filter(belongs),
                },
                clocks
              ),
            ],
          ]
        }
        const payment = payments.find(({ id }) => id === entry.paymentId)
        if (payment === undefined) return []
        const belongs = (row: { readonly paymentId: PaymentId }) =>
          row.paymentId === entry.paymentId
        return [
          [
            entry.paymentId,
            toBillOverpaymentInput(
              {
                billTotal: NonNegativeInteger(
                  Math.max(0, payment.amount - payment.tipAmount)
                ),
                isCanceled: false,
                payments: [payment],
                transactions: transactions.filter(belongs),
                refunds: refunds.filter(belongs),
                resolutions: resolutions.filter(belongs),
              },
              clocks
            ),
          ],
        ]
      }
    )
  )
