import {
  createIdFromString,
  err,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"

import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  cancelQerkoPayment,
  type QerkoApiDep,
  type QerkoClientError,
} from "../../integrations/qerko/qerko-client.ts"
import {
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import { deriveQerkoPaymentRefundAccountTransactionId } from "../account-transaction/account-transaction-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import { loadPayment } from "../payment/payment-actions.ts"
import type { PaymentNotFoundError } from "../payment/payment-errors.ts"
import {
  paymentQerkoPaymentByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "../payment/payment-queries.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import {
  loadQerkoCredentials,
  type QerkoPluginNotPairedError,
} from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { Integer, NonNegativeInteger, TimestampMs } from "../shared/schema.ts"
import {
  loadGoodsRefundPlan,
  loadTipRefundPlan,
  type RefundAmountInvalidError,
  type RefundItemsUnavailableError,
  type RefundLineUnavailableError,
  type RefundPaymentNotPaidError,
  type RefundTipUnavailableError,
} from "./refund-actions.ts"
import { refundsByPaymentIdQuery } from "./refund-queries.ts"
import type { RefundId } from "./refund-types.ts"

/**
 * Refunding a Qerko payment (qerko/0010): Qerko cancels the paid Qerko
 * payment, which always returns all of it, so the refund is the whole
 * payment or nothing. It is recorded only once Qerko's answer says
 * `CANCELLED`, as a refund to the card on the terminal is (qerko/0004).
 */

/** The payment was not paid through Qerko, or part of it is refunded already. */
export const createQerkoPaymentRefundNotAvailableError = defineError(
  "QerkoPaymentRefundNotAvailable"
)<{ readonly paymentId: PaymentId }>()
export type QerkoPaymentRefundNotAvailableError = ReturnType<
  typeof createQerkoPaymentRefundNotAvailableError
>

/** Qerko answered the cancellation without cancelling the payment. */
export const createQerkoPaymentRefundNotCancelledError = defineError(
  "QerkoPaymentRefundNotCancelled"
)<{ readonly paymentId: PaymentId; readonly state: string }>()
export type QerkoPaymentRefundNotCancelledError = ReturnType<
  typeof createQerkoPaymentRefundNotCancelledError
>

export type RefundQerkoPaymentError =
  | PaymentNotFoundError
  | RefundPaymentNotPaidError
  | RefundAmountInvalidError
  | RefundItemsUnavailableError
  | RefundLineUnavailableError
  | RefundTipUnavailableError
  | QerkoPaymentRefundNotAvailableError
  | QerkoPaymentRefundNotCancelledError
  | QerkoPluginNotPairedError
  | QerkoClientError

/**
 * The refunds a Qerko payment's cancellation records: its goods and, apart
 * as every tip refund is, its tip. Derived from Qerko's payment id, so two
 * devices refunding it at once record it once.
 */
export const createQerkoPaymentRefundIds = (
  qerkoPaymentId: string
): { readonly goods: RefundId; readonly tip: RefundId } => ({
  goods: createIdFromString<"Refund">(`qerko-payment-refund:${qerkoPaymentId}`),
  tip: createIdFromString<"Refund">(
    `qerko-payment-refund:${qerkoPaymentId}:tip`
  ),
})

/**
 * Refunds all of a payment taken through Qerko: asks Qerko to cancel the
 * paid Qerko payment and, once it says `CANCELLED`, records the refund and
 * the money leaving the Qerko account. Refused before Qerko is asked when
 * nothing was paid through Qerko or part of the payment is refunded already,
 * since Qerko would return all of it.
 */
export const refundQerkoPayment =
  ({
    paymentId,
    deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly deviceId: DeviceId | null
  }): Task<
    RefundId,
    RefundQerkoPaymentError,
    EvoluDep & EvoluOwnerDep & DateDep & QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const notAvailable = err(
      createQerkoPaymentRefundNotAvailableError({ paymentId })
    )

    const [attempts, [method], refunds] = await Promise.all([
      evolu.loadQuery(qerkoPaymentAttemptsByPaymentIdQuery(paymentId)),
      evolu.loadQuery(paymentQerkoPaymentByIdQuery(paymentId)),
      evolu.loadQuery(refundsByPaymentIdQuery(paymentId)),
    ])
    const paid = attempts.find((attempt) => attempt.outcome === "paid")
    if (paid === undefined || method === undefined) return notAvailable

    const ids = createQerkoPaymentRefundIds(paid.qerkoPaymentId)
    // Another device refunded it already: the rows are these.
    if (refunds.some((refund) => refund.id === ids.goods)) return ok(ids.goods)
    if (refunds.length > 0) return notAvailable

    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value

    let tipAmount = NonNegativeInteger(0)
    if (payment.tipAmount > 0) {
      const tipPlan = await run(loadTipRefundPlan(paymentId))
      if (!tipPlan.ok) return tipPlan
      tipAmount = tipPlan.value.tipAmount
    }
    const goodsAmount = NonNegativeInteger(
      Math.max(0, (paid.chargedAmount ?? payment.amount) - tipAmount)
    )
    const goodsPlan = await run(
      loadGoodsRefundPlan({ paymentId, amount: goodsAmount, lines: undefined })
    )
    if (!goodsPlan.ok) return goodsPlan

    const credentials = await run(loadQerkoCredentials("standard"))
    if (!credentials.ok) return credentials
    const cancelled = await run(
      cancelQerkoPayment({
        credentials: credentials.value,
        paymentId: paid.qerkoPaymentId,
      })
    )
    if (!cancelled.ok) return cancelled
    if (cancelled.value.state !== "CANCELLED") {
      return err(
        createQerkoPaymentRefundNotCancelledError({
          paymentId,
          state: cancelled.value.state,
        })
      )
    }

    const now = run.deps.date.now()
    const refundedAt = TimestampMs(now.getTime())
    const parts = [
      { id: ids.goods, amount: goodsAmount, isTip: false },
      ...(tipAmount > 0
        ? [{ id: ids.tip, amount: tipAmount, isTip: true }]
        : []),
    ]
    const transactions = parts.map((part) =>
      computeAccountTransactionRows(
        {
          id: deriveQerkoPaymentRefundAccountTransactionId(part.id),
          accountId: method.accountId,
          kind: "qerkoPayment",
          amount: Integer(-part.amount),
          currency: payment.currency,
          occurredAt: refundedAt,
          note: null,
          internalTransferGroupId: null,
          source: { deviceId, source: "manual" },
        },
        now
      )
    )

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      for (const part of parts) {
        evolu.upsert(
          "refund",
          {
            id: part.id,
            paymentId,
            deviceId,
            amount: part.amount,
            currency: payment.currency,
            method: "qerkoPayment",
            refundedAt,
            ...(part.isTip ? { isTip: sqliteTrue } : {}),
            isDeleted: sqliteFalse,
          },
          mutationOptions
        )
      }
      for (const transaction of transactions) {
        upsertAccountTransactionRows(evolu, transaction, mutationOptions)
      }
    })

    return ok(ids.goods)
  }
