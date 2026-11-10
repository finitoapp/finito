import type { sqliteTrue } from "@evolu/common"
import { z } from "zod"

import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import { AccountTransactionIdsJson } from "../account-transaction/account-transaction-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import {
  type OverpaymentResolutionId,
  OverpaymentResolutionKindSchema,
} from "../overpayment-resolution/overpayment-resolution-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { ReconciliationClaimId } from "../reconciliation-claim/reconciliation-claim-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import { isTipRefund } from "../refund/refund-utils.ts"
import type { ClaimedAmount } from "../shared/claimed-amount.ts"
import {
  type FiatCurrency,
  NonNegativeInteger,
  NonNegativeIntegerSchema,
  type TimestampMs,
} from "../shared/schema.ts"
import type { SyncClockHex } from "./bill-types.ts"
import type { BillOverpaymentInput, OverpaymentRefund } from "./bill-utils.ts"

export interface OverpaymentRows {
  readonly billTotal: NonNegativeInteger
  readonly isCanceled: boolean
  readonly payments: ReadonlyArray<{
    readonly id: PaymentId
    readonly amount: NonNegativeInteger
    readonly tipAmount: NonNegativeInteger
    readonly currency: FiatCurrency
    readonly cashReceivedAmount: NonNegativeInteger | null
    readonly excessAcknowledgedAt: TimestampMs | null
  }>
  readonly transactions: ReadonlyArray<
    Omit<ClaimedAmount, "paymentAmountSats"> & {
      readonly claimId: ReconciliationClaimId
      readonly paymentId: PaymentId
      readonly paymentAmountSats: NonNegativeInteger | null
    }
  >
  readonly refunds: ReadonlyArray<{
    readonly id: RefundId
    readonly paymentId: PaymentId
    readonly deviceId: DeviceId | null
    readonly amount: NonNegativeInteger
    readonly isTip: typeof sqliteTrue | null
    readonly overpaymentAmount: NonNegativeInteger | null
    readonly knownTransactionIdsJson: string | null
    readonly mainRefundId: RefundId | null
  }>
  readonly resolutions: ReadonlyArray<{
    readonly id: OverpaymentResolutionId
    readonly paymentId: PaymentId
    readonly kind: string
    readonly amount: number
    readonly knownTransactionIdsJson: string
    readonly withdrawnId: OverpaymentResolutionId | null
  }>
}

export interface OverpaymentClocks {
  readonly claims: ReadonlyMap<ReconciliationClaimId, SyncClockHex>
  readonly refunds: ReadonlyMap<RefundId, SyncClockHex>
  readonly resolutions: ReadonlyMap<OverpaymentResolutionId, SyncClockHex>
  readonly acknowledgements: ReadonlyMap<PaymentId, SyncClockHex>
}

const decodeKnownTransactionIds = (
  json: string | null
): ReadonlyArray<AccountTransactionId> | null => {
  if (json === null) return null
  const decoded = z.safeDecode(AccountTransactionIdsJson, json)
  return decoded.success ? decoded.data : null
}

const toOverpaymentRefunds = (
  refunds: OverpaymentRows["refunds"],
  clocks: OverpaymentClocks["refunds"]
): ReadonlyArray<OverpaymentRefund> => {
  const withoutDeviceAmountOf = (row: OverpaymentRows["refunds"][number]) =>
    row.deviceId === null ? row.amount : 0
  return refunds
    .filter(({ mainRefundId }) => mainRefundId === null)
    .map((main) => {
      const parts = [
        main,
        ...refunds.filter(({ mainRefundId }) => mainRefundId === main.id),
      ]
      return {
        id: main.id,
        paymentId: main.paymentId,
        amount: NonNegativeInteger(
          parts.reduce((sum, { amount }) => sum + amount, 0)
        ),
        isTip: isTipRefund(main),
        overpaymentAmount: main.overpaymentAmount,
        knownTransactionIds: decodeKnownTransactionIds(
          main.knownTransactionIdsJson
        ),
        withoutDeviceAmount: NonNegativeInteger(
          parts.reduce((sum, part) => sum + withoutDeviceAmountOf(part), 0)
        ),
        recordClock: clocks.get(main.id) ?? "",
      }
    })
}

export const toBillOverpaymentInput = (
  rows: OverpaymentRows,
  clocks: OverpaymentClocks
): BillOverpaymentInput => ({
  billTotal: rows.billTotal,
  isCanceled: rows.isCanceled,
  payments: rows.payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    tipAmount: payment.tipAmount,
    currency: payment.currency,
    cashReceivedAmount: payment.cashReceivedAmount,
    acknowledgementClock: clocks.acknowledgements.get(payment.id) ?? null,
  })),
  transactions: rows.transactions.map((transaction) => ({
    accountTransactionId: transaction.accountTransactionId,
    paymentId: transaction.paymentId,
    amount: transaction.amount,
    currency: transaction.currency,
    paymentAmount: transaction.paymentAmount,
    paymentCurrency: transaction.paymentCurrency,
    paymentAmountSats: transaction.paymentAmountSats,
    claimClock: clocks.claims.get(transaction.claimId) ?? "",
  })),
  refunds: toOverpaymentRefunds(rows.refunds, clocks.refunds),
  resolutions: rows.resolutions.flatMap((resolution) => {
    const kind = OverpaymentResolutionKindSchema.safeParse(resolution.kind)
    const amount = NonNegativeIntegerSchema.safeParse(resolution.amount)
    return kind.success && amount.success
      ? [
          {
            id: resolution.id,
            paymentId: resolution.paymentId,
            kind: kind.data,
            amount: amount.data,
            knownTransactionIds:
              decodeKnownTransactionIds(resolution.knownTransactionIdsJson) ??
              [],
            withdrawnId: resolution.withdrawnId,
            recordClock: clocks.resolutions.get(resolution.id) ?? "",
          },
        ]
      : []
  }),
})

export const deriveReportedGoodsByPayment = (
  rows: ReadonlyArray<{
    readonly paymentId: PaymentId
    readonly reportedGoods: number
  }>
): ReadonlyMap<PaymentId, NonNegativeInteger> =>
  new Map(
    rows.map(({ paymentId, reportedGoods }) => [
      paymentId,
      NonNegativeInteger(Math.max(0, reportedGoods)),
    ])
  )
