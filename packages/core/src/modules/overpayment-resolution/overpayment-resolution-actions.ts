import { err, ok, type Task } from "@evolu/common"
import { z } from "zod"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { AccountTransactionIdsJson } from "../account-transaction/account-transaction-utils.ts"
import type { BillNotFoundError } from "../bill/bill-guards.ts"
import { loadOverpaymentInput } from "../bill/bill-overpayment-guards.ts"
import type { OverpaymentScope } from "../bill/bill-types.ts"
import {
  type BillOverpaymentInput,
  deriveBillOverpayment,
} from "../bill/bill-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentRow } from "../payment/payment.ts"
import { loadPayment } from "../payment/payment-actions.ts"
import {
  createPaymentCanceledError,
  type PaymentCanceledError,
  type PaymentNotFoundError,
} from "../payment/payment-errors.ts"
import { loadPaymentStatus } from "../payment/payment-guards.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { getFirstOr } from "../shared/result.ts"
import { NonNegativeInteger, type PositiveInteger } from "../shared/schema.ts"
import {
  overpaymentResolutionByIdQuery,
  withdrawalsOfOverpaymentResolutionQuery,
} from "./overpayment-resolution-queries.ts"
import type { OverpaymentResolutionId } from "./overpayment-resolution-types.ts"

const createOverpaymentResolutionAboveUnresolvedError = defineError(
  "OverpaymentResolutionAboveUnresolved"
)<{
  readonly amount: PositiveInteger
  readonly unresolved: NonNegativeInteger
}>()
export type OverpaymentResolutionAboveUnresolvedError = ReturnType<
  typeof createOverpaymentResolutionAboveUnresolvedError
>

const createOverpaymentResolutionAbovePaymentError = defineError(
  "OverpaymentResolutionAbovePayment"
)<{
  readonly amount: PositiveInteger
  readonly paymentRoom: NonNegativeInteger
}>()
export type OverpaymentResolutionAbovePaymentError = ReturnType<
  typeof createOverpaymentResolutionAbovePaymentError
>

const createOverpaymentResolutionNotFoundError = defineError(
  "OverpaymentResolutionNotFound"
)<{ readonly id: OverpaymentResolutionId }>()
export type OverpaymentResolutionNotFoundError = ReturnType<
  typeof createOverpaymentResolutionNotFoundError
>

const createOverpaymentResolutionNotWithdrawableError = defineError(
  "OverpaymentResolutionNotWithdrawable"
)<{ readonly id: OverpaymentResolutionId }>()
export type OverpaymentResolutionNotWithdrawableError = ReturnType<
  typeof createOverpaymentResolutionNotWithdrawableError
>

export type RecordOverpaymentResolutionError =
  | PaymentNotFoundError
  | PaymentCanceledError
  | BillNotFoundError
  | OverpaymentResolutionAboveUnresolvedError
  | OverpaymentResolutionAbovePaymentError

export type WithdrawOverpaymentResolutionError =
  | OverpaymentResolutionNotFoundError
  | OverpaymentResolutionNotWithdrawableError

const overpaymentScopeOf = (
  payment: Pick<PaymentRow, "id" | "billId">
): OverpaymentScope =>
  payment.billId === null
    ? { paymentId: payment.id }
    : { billId: payment.billId }

const knownTransactionIdsJsonOf = (input: BillOverpaymentInput) =>
  z.encode(AccountTransactionIdsJson, [
    ...new Set(
      input.transactions.map(({ accountTransactionId }) => accountTransactionId)
    ),
  ])

export const recordOverpaymentResolution =
  ({
    paymentId,
    kind,
    amount,
    deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly kind: "tip" | "kept"
    readonly amount: PositiveInteger
    readonly deviceId: DeviceId | null
  }): Task<
    OverpaymentResolutionId,
    RecordOverpaymentResolutionError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value
    if ((await run.ok(loadPaymentStatus(payment))) === "canceled") {
      return err(createPaymentCanceledError({ id: paymentId }))
    }

    const inputResult = await run(
      loadOverpaymentInput(overpaymentScopeOf(payment))
    )
    if (!inputResult.ok) return inputResult
    const overpayment = deriveBillOverpayment(inputResult.value)
    if (amount > overpayment.unresolved) {
      return err(
        createOverpaymentResolutionAboveUnresolvedError({
          amount,
          unresolved: overpayment.unresolved,
        })
      )
    }
    const paymentRoom =
      overpayment.roomByPayment.get(paymentId) ?? NonNegativeInteger(0)
    if (amount > paymentRoom) {
      return err(
        createOverpaymentResolutionAbovePaymentError({ amount, paymentRoom })
      )
    }

    const { evolu, evoluOwner } = run.deps
    const id = await runMutationWithCompletion(
      (options) =>
        evolu.insert(
          "overpaymentResolution",
          {
            paymentId,
            deviceId,
            kind,
            amount,
            currency: payment.currency,
            knownTransactionIdsJson: knownTransactionIdsJsonOf(
              inputResult.value
            ),
          },
          { ...options, owner: evoluOwner }
        ).id
    )
    return ok(id)
  }

export const withdrawOverpaymentResolution =
  ({
    resolutionId,
    deviceId,
  }: {
    readonly resolutionId: OverpaymentResolutionId
    readonly deviceId: DeviceId | null
  }): Task<
    OverpaymentResolutionId,
    WithdrawOverpaymentResolutionError,
    EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const resolutionResult = getFirstOr(
      await evolu.loadQuery(overpaymentResolutionByIdQuery(resolutionId)),
      createOverpaymentResolutionNotFoundError({ id: resolutionId })
    )
    if (!resolutionResult.ok) return resolutionResult
    const resolution = resolutionResult.value
    const withdrawals = await evolu.loadQuery(
      withdrawalsOfOverpaymentResolutionQuery(resolutionId)
    )
    if (resolution.kind === "withdrawal" || withdrawals.length > 0) {
      return err(
        createOverpaymentResolutionNotWithdrawableError({ id: resolutionId })
      )
    }

    const id = await runMutationWithCompletion(
      (options) =>
        evolu.insert(
          "overpaymentResolution",
          {
            paymentId: resolution.paymentId,
            deviceId,
            kind: "withdrawal",
            amount: NonNegativeInteger(0),
            currency: resolution.currency,
            knownTransactionIdsJson: z.encode(AccountTransactionIdsJson, []),
            withdrawnId: resolutionId,
          },
          { ...options, owner: evoluOwner }
        ).id
    )
    return ok(id)
  }
