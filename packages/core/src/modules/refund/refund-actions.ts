import {
  createIdFromString,
  err,
  type InferRow,
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import type { RequireExactlyOne } from "type-fest"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { cashRegisterAccountByIdQuery } from "../account/account-queries.ts"
import { createCashRegisterAccountId } from "../account/account-utils.ts"
import {
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import { deriveCashRefundAccountTransactionId } from "../account-transaction/account-transaction-utils.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import {
  type CashRegisterAccountNotFoundError,
  createCashRegisterAccountNotFoundError,
  createPaymentNotFoundError,
  type PaymentNotFoundError,
} from "../payment/payment-errors.ts"
import { loadPaymentStatus } from "../payment/payment-guards.ts"
import { paymentDetailQuery } from "../payment/payment-queries.ts"
import type { PaymentId, PaymentStatus } from "../payment/payment-types.ts"
import type { PaymentLineId } from "../payment-line/payment-line-types.ts"
import { activeClaimedTransactionsByPaymentIdQuery } from "../reconciliation-claim/reconciliation-claim-queries.ts"
import { calculatePaymentExcess } from "../shared/claimed-amount.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { getFirstOr } from "../shared/result.ts"
import {
  type FiatCurrency,
  Integer,
  NonNegativeInteger,
  type PositiveNumber,
  TimestampMs,
} from "../shared/schema.ts"
import {
  otherClaimedPaymentOfBillQuery,
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "./refund-queries.ts"
import type { RefundId, RefundMethod } from "./refund-types.ts"
import {
  calculateRefundLineAmount,
  deriveRefundableAmount,
  deriveRefundableLines,
  deriveRefundableTipAmount,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
} from "./refund-utils.ts"

const createRefundPaymentNotPaidError = defineError("RefundPaymentNotPaid")<{
  readonly paymentId: PaymentId
  readonly status: PaymentStatus
}>()
export type RefundPaymentNotPaidError = ReturnType<
  typeof createRefundPaymentNotPaidError
>

const createRefundAmountInvalidError = defineError("RefundAmountInvalid")<{
  readonly amount: NonNegativeInteger
  readonly remainingAmount: NonNegativeInteger
}>()
export type RefundAmountInvalidError = ReturnType<
  typeof createRefundAmountInvalidError
>

const createRefundItemsUnavailableError = defineError(
  "RefundItemsUnavailable"
)<{ readonly paymentId: PaymentId }>()
export type RefundItemsUnavailableError = ReturnType<
  typeof createRefundItemsUnavailableError
>

const createRefundLineUnavailableError = defineError("RefundLineUnavailable")<{
  readonly paymentLineId: PaymentLineId
}>()
export type RefundLineUnavailableError = ReturnType<
  typeof createRefundLineUnavailableError
>

const createRefundTipUnavailableError = defineError("RefundTipUnavailable")<{
  readonly paymentId: PaymentId
}>()
export type RefundTipUnavailableError = ReturnType<
  typeof createRefundTipUnavailableError
>

export type RefundPaymentError =
  | PaymentNotFoundError
  | RefundPaymentNotPaidError
  | RefundAmountInvalidError
  | RefundItemsUnavailableError
  | RefundLineUnavailableError
  | CashRegisterAccountNotFoundError

export interface RefundLineInput {
  readonly paymentLineId: PaymentLineId
  readonly quantity: PositiveNumber
}

export interface RefundLineValues extends RefundLineInput {
  readonly amount: NonNegativeInteger
}

const loadRefundLines =
  ({
    paymentId,
    billId,
    lines,
  }: {
    readonly paymentId: PaymentId
    readonly billId: BillId | null
    readonly lines: ReadonlyArray<RefundLineInput>
  }): Task<
    ReadonlyArray<RefundLineValues>,
    RefundItemsUnavailableError | RefundLineUnavailableError,
    EvoluDep
  > =>
  async (run) => {
    const { evolu } = run.deps
    const otherClaimedPayments = await evolu.loadQuery(
      otherClaimedPaymentOfBillQuery(paymentId)
    )
    if (billId === null || otherClaimedPayments.length > 0) {
      return err(createRefundItemsUnavailableError({ paymentId }))
    }

    const [paymentLines, refundedLines] = await Promise.all([
      evolu.loadQuery(refundablePaymentLinesQuery(paymentId)),
      evolu.loadQuery(refundLinesByPaymentIdQuery(paymentId)),
    ])
    const refundableLines = deriveRefundableLines(paymentLines, refundedLines)
    const values: RefundLineValues[] = []
    for (const { paymentLineId, quantity } of lines) {
      const refundable = refundableLines.find(
        ({ line }) => line.id === paymentLineId
      )
      const isRepeated = values.some(
        (value) => value.paymentLineId === paymentLineId
      )
      if (
        refundable === undefined ||
        isRepeated ||
        quantity > refundable.remainingQuantity
      ) {
        return err(createRefundLineUnavailableError({ paymentLineId }))
      }
      values.push({
        paymentLineId,
        quantity,
        amount: calculateRefundLineAmount(refundable, quantity),
      })
    }
    return ok(values)
  }

const loadPaidPayment =
  (
    paymentId: PaymentId
  ): Task<
    InferRow<ReturnType<typeof paymentDetailQuery>>,
    PaymentNotFoundError | RefundPaymentNotPaidError,
    EvoluDep & DateDep
  > =>
  async (run) => {
    const paymentResult = getFirstOr(
      await run.deps.evolu.loadQuery(paymentDetailQuery(paymentId)),
      createPaymentNotFoundError({ id: paymentId })
    )
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value
    const status = await run.ok(loadPaymentStatus(payment))
    if (status !== "paid") {
      return err(createRefundPaymentNotPaidError({ paymentId, status }))
    }
    return ok(payment)
  }

/**
 * A refund recorded on staff's word (cash from the register or outside the
 * app), with the cash movement it makes, computed outside the mutation that
 * writes it ({@link upsertRecordedRefundRows}) so several can share a batch.
 */
interface RecordedRefund {
  readonly id: RefundId
  readonly paymentId: PaymentId
  readonly deviceId: DeviceId | null
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly method: RecordedRefundMethod
  readonly refundedAt: TimestampMs
  readonly isTip: boolean
  readonly lines: ReadonlyArray<RefundLineValues>
  /** The cash leaving the register, for a refund from it. */
  readonly cashTransaction: ReturnType<
    typeof computeAccountTransactionRows
  > | null
}

const prepareRecordedRefund =
  ({
    now,
    ...refund
  }: Omit<RecordedRefund, "refundedAt" | "cashTransaction"> & {
    readonly now: Date
  }): Task<RecordedRefund, CashRegisterAccountNotFoundError, EvoluDep> =>
  async (run) => {
    const refundedAt = TimestampMs(now.getTime())
    if (refund.method !== "cashRegister") {
      return ok({ ...refund, refundedAt, cashTransaction: null })
    }
    const accountId = createCashRegisterAccountId(refund.currency)
    const account = getFirstOr(
      await run.deps.evolu.loadQuery(cashRegisterAccountByIdQuery(accountId)),
      createCashRegisterAccountNotFoundError({ id: accountId })
    )
    if (!account.ok) return account
    return ok({
      ...refund,
      refundedAt,
      cashTransaction: computeAccountTransactionRows(
        {
          id: deriveCashRefundAccountTransactionId(refund.id),
          accountId,
          amount: Integer(-refund.amount),
          currency: refund.currency,
          occurredAt: refundedAt,
          note: null,
          internalTransferGroupId: null,
          source: { deviceId: refund.deviceId, source: "manual" },
        },
        now
      ),
    })
  }

const upsertRecordedRefundRows = (
  evolu: EvoluDep["evolu"],
  refund: RecordedRefund,
  options: MutationOptions
): void => {
  evolu.upsert(
    "refund",
    {
      id: refund.id,
      paymentId: refund.paymentId,
      deviceId: refund.deviceId,
      amount: refund.amount,
      currency: refund.currency,
      method: refund.method,
      refundedAt: refund.refundedAt,
      ...(refund.isTip ? { isTip: sqliteTrue } : {}),
      isDeleted: sqliteFalse,
    },
    options
  )
  for (const line of refund.lines) {
    evolu.upsert(
      "refundLine",
      {
        id: createRowId<"RefundLine">(),
        refundId: refund.id,
        paymentId: refund.paymentId,
        paymentLineId: line.paymentLineId,
        quantity: line.quantity,
        amount: line.amount,
        isDeleted: sqliteFalse,
      },
      options
    )
  }
  if (refund.cashTransaction !== null) {
    upsertAccountTransactionRows(evolu, refund.cashTransaction, options)
  }
}

/** The tip is refunded once per payment, whichever way (refund/0004). */
export const tipRefundId = (paymentId: PaymentId): RefundId =>
  createIdFromString<"Refund">(`refund:tip:${paymentId}`)

/**
 * The goods of a paid payment still refundable: what it received for goods
 * and any excess (refund/0003, 0005), less the goods refunded already.
 */
const loadRemainingGoodsAmount =
  (
    payment: InferRow<ReturnType<typeof paymentDetailQuery>>
  ): Task<
    {
      readonly remainingAmount: NonNegativeInteger
      readonly refunds: InferRow<ReturnType<typeof refundsByPaymentIdQuery>>[]
    },
    never,
    EvoluDep
  > =>
  async (run) => {
    const { evolu } = run.deps
    const [refunds, claims] = await Promise.all([
      evolu.loadQuery(refundsByPaymentIdQuery(payment.id)),
      evolu.loadQuery(activeClaimedTransactionsByPaymentIdQuery(payment.id)),
    ])
    const excess = calculatePaymentExcess({ claims, amount: payment.amount })
    const remainingAmount = NonNegativeInteger(
      Math.max(
        0,
        deriveRefundableAmount({ ...payment, excess }) -
          sumGoodsRefundAmounts(refunds)
      )
    )
    return ok({ remainingAmount, refunds: [...refunds] })
  }

export interface GoodsRefundPlan {
  readonly payment: InferRow<ReturnType<typeof paymentDetailQuery>>
  readonly refundLines: ReadonlyArray<RefundLineValues>
  readonly refundAmount: NonNegativeInteger
}

/**
 * What a refund of goods may be: the paid payment, the lines asked for and
 * the amount they come to, checked against what is still refundable. Shared
 * by the refunds that are recorded at once and the one the card terminal
 * must approve first, so neither can ask for more than the other would allow.
 */
export const loadGoodsRefundPlan =
  ({
    paymentId,
    amount,
    lines,
  }: {
    readonly paymentId: PaymentId
    /**
     * Exactly one of the two is given: the callers' types say so. `remaining`
     * asks for every goods amount still refundable.
     */
    readonly amount: NonNegativeInteger | "remaining" | undefined
    readonly lines: ReadonlyArray<RefundLineInput> | undefined
  }): Task<
    GoodsRefundPlan,
    | PaymentNotFoundError
    | RefundPaymentNotPaidError
    | RefundAmountInvalidError
    | RefundItemsUnavailableError
    | RefundLineUnavailableError,
    EvoluDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPaidPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value

    let refundLines: ReadonlyArray<RefundLineValues> = []
    if (lines !== undefined) {
      const linesResult = await run(
        loadRefundLines({
          paymentId,
          billId: payment.billId,
          lines,
        })
      )
      if (!linesResult.ok) return linesResult
      refundLines = linesResult.value
    }

    const { remainingAmount } = await run.ok(loadRemainingGoodsAmount(payment))
    const refundAmount =
      amount === "remaining"
        ? remainingAmount
        : (amount ?? sumRefundAmounts(refundLines))
    if (refundAmount === 0 || refundAmount > remainingAmount) {
      return err(
        createRefundAmountInvalidError({
          amount: refundAmount,
          remainingAmount,
        })
      )
    }

    return ok({ payment, refundLines, refundAmount })
  }

export type TipRefundPlan = {
  readonly payment: InferRow<ReturnType<typeof paymentDetailQuery>>
  readonly tipAmount: NonNegativeInteger
}

/** The tip a payment may still give back, `RefundTipUnavailable` when none. */
export const loadTipRefundPlan =
  (
    paymentId: PaymentId
  ): Task<
    TipRefundPlan,
    | PaymentNotFoundError
    | RefundPaymentNotPaidError
    | RefundTipUnavailableError,
    EvoluDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPaidPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value

    const refunds = await run.deps.evolu.loadQuery(
      refundsByPaymentIdQuery(paymentId)
    )
    const tipAmount = deriveRefundableTipAmount({ ...payment, refunds })
    if (tipAmount === 0) {
      return err(createRefundTipUnavailableError({ paymentId }))
    }
    return ok({ payment, tipAmount })
  }

export interface WholeRefundPlan {
  readonly payment: InferRow<ReturnType<typeof paymentDetailQuery>>
  /** Every goods amount still refundable, 0 once the goods are all back. */
  readonly goodsAmount: NonNegativeInteger
  /** The tip, 0 when there is none or it was refunded (refund/0004). */
  readonly tipAmount: NonNegativeInteger
}

/**
 * Everything a payment may still give back: the goods left and the tip, each
 * exactly, with no cash rounding (refund/0006 only shapes a typed amount's
 * prefill). `RefundAmountInvalid` with nothing remaining when both are gone.
 */
export const loadWholeRefundPlan =
  (
    paymentId: PaymentId
  ): Task<
    WholeRefundPlan,
    PaymentNotFoundError | RefundPaymentNotPaidError | RefundAmountInvalidError,
    EvoluDep & DateDep
  > =>
  async (run) => {
    const paymentResult = await run(loadPaidPayment(paymentId))
    if (!paymentResult.ok) return paymentResult
    const payment = paymentResult.value

    const { remainingAmount, refunds } = await run.ok(
      loadRemainingGoodsAmount(payment)
    )
    const tipAmount = deriveRefundableTipAmount({ ...payment, refunds })
    if (remainingAmount === 0 && tipAmount === 0) {
      return err(
        createRefundAmountInvalidError({
          amount: NonNegativeInteger(0),
          remainingAmount,
        })
      )
    }
    return ok({ payment, goodsAmount: remainingAmount, tipAmount })
  }

/**
 * What a refund recorded without Qerko can be: a refund `method` of
 * `qerkoTerminal` is written only once the terminal approved it
 * (`settleQerkoTerminalRefund`), and one of `qerkoPayment` once Qerko
 * cancelled the payment (`refundQerkoPayment`), never on someone's word.
 */
export type RecordedRefundMethod = Exclude<
  RefundMethod,
  "qerkoTerminal" | "qerkoPayment"
>

export const refundPayment =
  ({
    paymentId,
    method,
    deviceId,
    amount,
    lines,
  }: {
    readonly paymentId: PaymentId
    readonly method: RecordedRefundMethod
    readonly deviceId: DeviceId | null
  } & RequireExactlyOne<{
    readonly amount: NonNegativeInteger
    readonly lines: ReadonlyArray<RefundLineInput>
  }>): Task<RefundId, RefundPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const plan = await run(loadGoodsRefundPlan({ paymentId, amount, lines }))
    if (!plan.ok) return plan
    const { payment, refundLines, refundAmount } = plan.value

    const refund = await run(
      prepareRecordedRefund({
        id: createRowId<"Refund">(),
        paymentId,
        deviceId,
        amount: refundAmount,
        currency: payment.currency,
        method,
        isTip: false,
        lines: refundLines,
        now: run.deps.date.now(),
      })
    )
    if (!refund.ok) return refund

    await runMutationWithCompletion((options) => {
      upsertRecordedRefundRows(evolu, refund.value, {
        ...options,
        owner: evoluOwner,
      })
    })

    return ok(refund.value.id)
  }

export type RefundPaymentTipError =
  | PaymentNotFoundError
  | RefundPaymentNotPaidError
  | RefundTipUnavailableError
  | CashRegisterAccountNotFoundError

export const refundPaymentTip =
  ({
    paymentId,
    method,
    deviceId,
  }: {
    readonly paymentId: PaymentId
    readonly method: RecordedRefundMethod
    readonly deviceId: DeviceId | null
  }): Task<
    RefundId,
    RefundPaymentTipError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const plan = await run(loadTipRefundPlan(paymentId))
    if (!plan.ok) return plan
    const { payment, tipAmount } = plan.value

    const refund = await run(
      prepareRecordedRefund({
        id: tipRefundId(paymentId),
        paymentId,
        deviceId,
        amount: tipAmount,
        currency: payment.currency,
        method,
        isTip: true,
        lines: [],
        now: run.deps.date.now(),
      })
    )
    if (!refund.ok) return refund

    await runMutationWithCompletion((options) => {
      upsertRecordedRefundRows(evolu, refund.value, {
        ...options,
        owner: evoluOwner,
      })
    })

    return ok(refund.value.id)
  }

export type RefundWholePaymentError =
  | PaymentNotFoundError
  | RefundPaymentNotPaidError
  | RefundAmountInvalidError
  | CashRegisterAccountNotFoundError

/**
 * Gives back everything a payment still may in one step, from the cash
 * register or outside the app: the goods left as one refund and the tip, if
 * any is left, as its own (refund/0004), written in one batch. Each is the
 * refund `refundPayment` and `refundPaymentTip` would record, cash movement
 * included, the tip under its one id per payment. Once nothing is left,
 * another run is refused with `RefundAmountInvalid`, so it never doubles.
 */
export const refundWholePayment =
  ({
    paymentId,
    method,
    deviceId,
  }: {
    readonly paymentId: PaymentId
    /** A card's whole refund goes through its terminal instead. */
    readonly method: Extract<RefundMethod, "cashRegister" | "outside">
    readonly deviceId: DeviceId | null
  }): Task<
    {
      /** The goods' refund, `null` when only the tip was left. */
      readonly goodsRefundId: RefundId | null
      /** The tip's refund, `null` when no tip was left. */
      readonly tipRefundId: RefundId | null
    },
    RefundWholePaymentError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const now = run.deps.date.now()
    const plan = await run(loadWholeRefundPlan(paymentId))
    if (!plan.ok) return plan
    const { payment, goodsAmount, tipAmount } = plan.value

    const parts = [
      ...(goodsAmount === 0
        ? []
        : [{ id: createRowId<"Refund">(), amount: goodsAmount, isTip: false }]),
      ...(tipAmount === 0
        ? []
        : [{ id: tipRefundId(paymentId), amount: tipAmount, isTip: true }]),
    ]
    const refunds: RecordedRefund[] = []
    for (const part of parts) {
      const refund = await run(
        prepareRecordedRefund({
          ...part,
          paymentId,
          deviceId,
          currency: payment.currency,
          method,
          lines: [],
          now,
        })
      )
      if (!refund.ok) return refund
      refunds.push(refund.value)
    }

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      for (const refund of refunds) {
        upsertRecordedRefundRows(evolu, refund, mutationOptions)
      }
    })

    return ok({
      goodsRefundId: refunds.find(({ isTip }) => !isTip)?.id ?? null,
      tipRefundId: refunds.find(({ isTip }) => isTip)?.id ?? null,
    })
  }
