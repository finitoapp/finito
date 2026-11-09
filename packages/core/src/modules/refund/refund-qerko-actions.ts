import {
  err,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
  type UpsertValues,
} from "@evolu/common"

import type { DateDep, EvoluOwnerDep, FetchDep, UuidDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  createQerkoTerminalRefund,
  getQerkoTerminalRefundStatus,
  type QerkoApiDep,
  type QerkoClientError,
  type QerkoNotStartedReason,
  type QerkoRefund,
  type QerkoStep,
} from "../../integrations/qerko/qerko-client.ts"
import { deriveQerkoRefundAccountTransactionId } from "../account-transaction/account-transaction-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentNotFoundError } from "../payment/payment-errors.ts"
import { qerkoUnknownAttemptGraceMs } from "../payment/payment-qerko-actions.ts"
import {
  paymentDetailQuery,
  paymentQerkoTerminalByIdQuery,
} from "../payment/payment-queries.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import {
  loadQerkoCredentials,
  type QerkoPluginNotPairedError,
} from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  Integer,
  type NonEmptyString,
  NonEmptyString255,
  type NonNegativeInteger,
  TimestampMs,
} from "../shared/schema.ts"
import type { qerkoTerminalRefundAttempt } from "./refund.ts"
import {
  loadGoodsRefundPlan,
  loadTipRefundPlan,
  loadWholeRefundPlan,
  type RefundAmountInvalidError,
  type RefundItemsUnavailableError,
  type RefundLineInput,
  type RefundLineUnavailableError,
  type RefundPaymentNotPaidError,
  type RefundTipUnavailableError,
  tipRefundId,
} from "./refund-actions.ts"
import {
  computeCardRefundRows,
  encodeRefundLines,
  upsertCardRefundRows,
} from "./refund-card-settlement.ts"
import {
  qerkoTerminalRefundAttemptByIdQuery,
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  qerkoTerminalRefundsMissingTipQuery,
} from "./refund-queries.ts"
import type { RefundId } from "./refund-types.ts"

/**
 * Refunding to the card through the Qerko terminal (qerko/0004). The terminal
 * decides, so nothing is recorded as a refund until it approved: a
 * `qerkoTerminalRefundAttempt` carries the refund in the meantime, and the
 * `refund` row, its lines and the money moving out of the Qerko account are
 * written together when the terminal says approved.
 */

export const createQerkoRefundNotAvailableError = defineError(
  "QerkoRefundNotAvailable"
)<{ readonly paymentId: PaymentId }>()
export type QerkoRefundNotAvailableError = ReturnType<
  typeof createQerkoRefundNotAvailableError
>

export const createQerkoRefundAttemptRunningError = defineError(
  "QerkoRefundAttemptRunning"
)<{ readonly paymentId: PaymentId; readonly refundId: RefundId }>()
export type QerkoRefundAttemptRunningError = ReturnType<
  typeof createQerkoRefundAttemptRunningError
>

export const createQerkoTerminalRefundNotStartedError = defineError(
  "QerkoTerminalRefundNotStarted"
)<{
  readonly paymentId: PaymentId
  readonly reason: QerkoNotStartedReason
}>()
export type QerkoTerminalRefundNotStartedError = ReturnType<
  typeof createQerkoTerminalRefundNotStartedError
>

export const createQerkoTerminalRefundFailedError = defineError(
  "QerkoTerminalRefundFailed"
)<{
  readonly refundId: RefundId
  readonly reason: "declined" | "cancelled"
}>()
export type QerkoTerminalRefundFailedError = ReturnType<
  typeof createQerkoTerminalRefundFailedError
>

export type StartQerkoTerminalRefundError =
  | PaymentNotFoundError
  | RefundPaymentNotPaidError
  | RefundAmountInvalidError
  | RefundItemsUnavailableError
  | RefundLineUnavailableError
  | RefundTipUnavailableError
  | QerkoRefundNotAvailableError
  | QerkoRefundAttemptRunningError
  | QerkoPluginNotPairedError
  | QerkoTerminalRefundNotStartedError
  | QerkoTerminalRefundFailedError
  | QerkoClientError

export type SyncQerkoTerminalRefundError =
  | QerkoPluginNotPairedError
  | QerkoTerminalRefundFailedError
  | QerkoClientError

/** Where a refund to the card stands after one start or poll. */
export type QerkoTerminalRefundProgress =
  | { readonly status: "idle" }
  | { readonly status: "pending"; readonly step: QerkoStep }
  | { readonly status: "refunded" }
  /** The outcome is unknown: the card may have been refunded. */
  | { readonly status: "unresolved" }

type QerkoRefundDeps = EvoluDep &
  EvoluOwnerDep &
  DateDep &
  QerkoApiDep &
  FetchDep

/**
 * Writes the refund the terminal approved, and takes the attempt away, in one
 * batch. Every id is derived from the attempt's, so two devices that settle
 * the same attempt write the same rows.
 */
const settleQerkoTerminalRefund =
  (
    refundId: RefundId
  ): Task<
    QerkoTerminalRefundProgress,
    never,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [attempt] = await evolu.loadQuery(
      qerkoTerminalRefundAttemptByIdQuery(refundId)
    )
    // Another device settled it first.
    if (attempt === undefined) return ok({ status: "refunded" })

    const [qerkoPayment] = await evolu.loadQuery(
      paymentQerkoTerminalByIdQuery(attempt.paymentId)
    )
    const [payment] = await evolu.loadQuery(
      paymentDetailQuery(attempt.paymentId)
    )
    if (qerkoPayment === undefined || payment === undefined) {
      return ok({ status: "unresolved" })
    }

    const now = run.deps.date.now()
    const refundRows = (refund: {
      readonly refundId: RefundId
      readonly amount: NonNegativeInteger
      readonly isTip: typeof sqliteTrue | null
      readonly linesJson: NonEmptyString | null
    }) =>
      computeCardRefundRows(
        {
          ...refund,
          paymentId: attempt.paymentId,
          deviceId: attempt.deviceId,
          currency: payment.currency,
          // Both refunds of a whole payment went through this transaction.
          terminal: {
            method: "qerkoTerminal",
            transactionId: attempt.transactionId,
            terminalId: attempt.terminalId,
          },
          accountId: qerkoPayment.accountId,
          accountTransactionId: deriveQerkoRefundAccountTransactionId(
            refund.refundId
          ),
        },
        now
      )
    // A refund of the whole payment returned the tip with the goods: it is
    // written as the tip's own refund (refund/0011).
    const rows = [
      refundRows({ ...attempt, refundId }),
      ...(attempt.isTip === sqliteTrue ||
      attempt.tipAmount === null ||
      attempt.tipAmount === 0
        ? []
        : [
            refundRows({
              refundId: tipRefundId(attempt.paymentId),
              amount: attempt.tipAmount,
              isTip: sqliteTrue,
              linesJson: null,
            }),
          ]),
    ]

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      for (const refund of rows) {
        upsertCardRefundRows(evolu, refund, mutationOptions)
      }
      evolu.update(
        "qerkoTerminalRefundAttempt",
        { id: refundId, isDeleted: sqliteTrue },
        mutationOptions
      )
    })

    return ok({ status: "refunded" })
  }

const applyQerkoRefund =
  ({
    refundId,
    operation,
  }: {
    readonly refundId: RefundId
    readonly operation: QerkoRefund
  }): Task<
    QerkoTerminalRefundProgress,
    QerkoTerminalRefundFailedError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    if (operation.status === "pending") {
      return ok({ status: "pending", step: operation.step })
    }
    if (operation.status === "approved") {
      return run(settleQerkoTerminalRefund(refundId))
    }

    await runMutationWithCompletion((options) =>
      evolu.update(
        "qerkoTerminalRefundAttempt",
        operation.status === "failed"
          ? { id: refundId, status: "failed", failureReason: operation.reason }
          : { id: refundId, status: "unknown" },
        { ...options, owner: evoluOwner }
      )
    )
    if (operation.status === "unknown") return ok({ status: "unresolved" })
    return err(
      createQerkoTerminalRefundFailedError({
        refundId,
        reason: operation.reason,
      })
    )
  }

/**
 * Starts refunding to the card on the terminal that took the payment (qerko/0006),
 * for an amount (or goods lines), the payment's tip, or the `whole` payment —
 * every goods amount still refundable and the tip, which the terminal returns
 * in one go and which is written as two refunds once it approved, the goods'
 * and the tip's (refund/0011). The same checks as any refund decide what may
 * be asked for; on top, the payment must have been taken through Qerko,
 * which hands out the id its refund needs.
 *
 * A refund started while another one of the payment is pending or unknown is
 * refused: the terminal could end up refunding twice.
 */
export const startQerkoTerminalRefund =
  ({
    paymentId,
    deviceId,
    ...what
  }: {
    readonly paymentId: PaymentId
    readonly deviceId: DeviceId | null
  } & (
    | { readonly tip: true }
    | { readonly whole: true }
    | { readonly amount: NonNegativeInteger }
    | { readonly lines: ReadonlyArray<RefundLineInput> }
  )): Task<
    QerkoTerminalRefundProgress,
    StartQerkoTerminalRefundError,
    QerkoRefundDeps & UuidDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps

    let payment: { readonly currency: "CZK" | "EUR" | "USD" }
    let refundAmount: NonNegativeInteger
    let tipAmount: NonNegativeInteger | null = null
    let isTip = "tip" in what
    let linesJson: NonEmptyString | null = null
    if ("tip" in what) {
      const plan = await run(loadTipRefundPlan(paymentId))
      if (!plan.ok) return plan
      payment = plan.value.payment
      refundAmount = plan.value.tipAmount
    } else if ("whole" in what) {
      const plan = await run(loadWholeRefundPlan(paymentId))
      if (!plan.ok) return plan
      payment = plan.value.payment
      // Only the tip left is the tip's refund; goods carry the tip beside.
      isTip = plan.value.goodsAmount === 0
      refundAmount = isTip ? plan.value.tipAmount : plan.value.goodsAmount
      if (!isTip && plan.value.tipAmount > 0) tipAmount = plan.value.tipAmount
    } else {
      const plan = await run(
        loadGoodsRefundPlan({
          paymentId,
          amount: "amount" in what ? what.amount : undefined,
          lines: "lines" in what ? what.lines : undefined,
        })
      )
      if (!plan.ok) return plan
      payment = plan.value.payment
      refundAmount = plan.value.refundAmount
      if (plan.value.refundLines.length > 0) {
        linesJson = encodeRefundLines(plan.value.refundLines)
      }
    }
    const refundId = isTip ? tipRefundId(paymentId) : createRowId<"Refund">()

    const [[qerkoPayment], attempts] = await Promise.all([
      evolu.loadQuery(paymentQerkoTerminalByIdQuery(paymentId)),
      evolu.loadQuery(qerkoTerminalRefundAttemptsByPaymentIdQuery(paymentId)),
    ])
    if (
      qerkoPayment === undefined ||
      qerkoPayment.qerkoRefundId === null ||
      qerkoPayment.transactionId === null ||
      qerkoPayment.terminalId === null
    ) {
      return err(createQerkoRefundNotAvailableError({ paymentId }))
    }
    const running = attempts.find(({ status }) => status !== "failed")
    if (running !== undefined) {
      return err(
        createQerkoRefundAttemptRunningError({
          paymentId,
          refundId: running.id,
        })
      )
    }

    const credentials = await run(loadQerkoCredentials("terminalPayments"))
    if (!credentials.ok) return credentials

    // The terminal that took the money, not the one this device pays on now.
    const { terminalId } = qerkoPayment
    const transactionId = NonEmptyString255(run.deps.uuid.create())
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      // A definite no of an earlier attempt is only kept to be shown.
      for (const { id } of attempts) {
        if (id !== refundId) {
          evolu.update(
            "qerkoTerminalRefundAttempt",
            { id, isDeleted: sqliteTrue },
            mutationOptions
          )
        }
      }
      const attempt: UpsertValues<typeof qerkoTerminalRefundAttempt> = {
        id: refundId,
        paymentId,
        deviceId,
        transactionId,
        terminalId,
        amount: refundAmount,
        tipAmount,
        linesJson,
        status: "pending",
        failureReason: null,
        startedAt: TimestampMs(run.deps.date.now().getTime()),
        isDeleted: sqliteFalse,
      }
      evolu.upsert(
        "qerkoTerminalRefundAttempt",
        isTip ? { ...attempt, isTip: sqliteTrue } : attempt,
        mutationOptions
      )
    })

    const created = await run(
      createQerkoTerminalRefund({
        credentials: credentials.value,
        terminalId,
        transactionId,
        refundId: qerkoPayment.qerkoRefundId,
        amount: Integer(refundAmount + (tipAmount ?? 0)),
        currency: payment.currency,
      })
    )
    // A failed request leaves the attempt pending: it may have reached the
    // terminal, and the next poll finds out.
    if (!created.ok) return created

    if (created.value.type === "notStarted") {
      const { reason } = created.value
      await runMutationWithCompletion((options) =>
        run.deps.evolu.update(
          "qerkoTerminalRefundAttempt",
          // An upstream timeout may or may not have reached the terminal.
          reason === "upstreamTimeout"
            ? { id: refundId, status: "unknown" }
            : { id: refundId, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      )
      return err(
        createQerkoTerminalRefundNotStartedError({ paymentId, reason })
      )
    }

    return run(
      applyQerkoRefund({ refundId, operation: created.value.operation })
    )
  }

/**
 * One poll of a refund to the card, settling it when the terminal answered.
 * Safe to call from anywhere and as often as wanted, the payment screen and
 * the background job both do.
 */
export const syncQerkoTerminalRefund =
  (
    refundId: RefundId
  ): Task<
    QerkoTerminalRefundProgress,
    SyncQerkoTerminalRefundError,
    QerkoRefundDeps
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [attempt] = await evolu.loadQuery(
      qerkoTerminalRefundAttemptByIdQuery(refundId)
    )
    if (attempt === undefined) return ok({ status: "idle" })
    if (attempt.status === "unknown") return ok({ status: "unresolved" })
    if (attempt.status !== "pending") return ok({ status: "idle" })

    const credentials = await run(loadQerkoCredentials("terminalPayments"))
    if (!credentials.ok) return credentials

    const polled = await run(
      getQerkoTerminalRefundStatus({
        credentials: credentials.value,
        transactionId: attempt.transactionId,
      })
    )
    if (!polled.ok) return polled

    if (polled.value.type === "unknownTransaction") {
      const age = run.deps.date.now().getTime() - attempt.startedAt
      if (age < qerkoUnknownAttemptGraceMs) {
        // The starting device's request may still be on its way.
        return ok({ status: "pending", step: "connecting" })
      }
      // Qerko never saw it: nothing was refunded, and the attempt ends.
      await runMutationWithCompletion((options) =>
        evolu.update(
          "qerkoTerminalRefundAttempt",
          { id: refundId, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      )
      return ok({ status: "idle" })
    }

    return run(
      applyQerkoRefund({ refundId, operation: polled.value.operation })
    )
  }

/**
 * Staff's word that they checked the terminal after an unknown result: the
 * attempt is taken away, which lets another one start. If the card was
 * refunded after all, it is the merchant's to record.
 */
export const dismissQerkoTerminalRefundAttempt =
  (refundId: RefundId): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "qerkoTerminalRefundAttempt",
        { id: refundId, isDeleted: sqliteTrue },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }

/**
 * Writes the tip of every refund of a whole payment to the card whose goods
 * were written without it. An older version settles such an attempt knowing
 * nothing of its `tipAmount`, and the attempt may be settled on any device
 * (qerko/0005), so the tip the terminal returned would go unrecorded. The
 * tip's refund has its one id per payment (refund/0011) and its money
 * movement derives from it, so a repair that runs twice, or beside a newer
 * settlement, writes the same rows. It is dated as the goods were, and keeps
 * the terminal transaction the taken-away attempt names.
 */
export const repairQerkoTerminalTipRefunds =
  (): Task<number, never, EvoluDep & EvoluOwnerDep> => async (run) => {
    const { evolu, evoluOwner } = run.deps
    const missing = await evolu.loadQuery(qerkoTerminalRefundsMissingTipQuery)
    const rows: Array<ReturnType<typeof computeCardRefundRows>> = []
    for (const attempt of missing) {
      if (attempt.tipAmount === 0) continue
      const [qerkoPayment] = await evolu.loadQuery(
        paymentQerkoTerminalByIdQuery(attempt.paymentId)
      )
      if (qerkoPayment === undefined) continue
      const refundId = tipRefundId(attempt.paymentId)
      rows.push(
        computeCardRefundRows(
          {
            refundId,
            paymentId: attempt.paymentId,
            deviceId: attempt.deviceId,
            amount: attempt.tipAmount,
            currency: attempt.currency,
            // The transaction that returned the goods returned the tip.
            terminal: {
              method: "qerkoTerminal",
              transactionId: attempt.transactionId,
              terminalId: attempt.terminalId,
            },
            isTip: sqliteTrue,
            linesJson: null,
            accountId: qerkoPayment.accountId,
            accountTransactionId:
              deriveQerkoRefundAccountTransactionId(refundId),
          },
          new Date(attempt.refundedAt)
        )
      )
    }
    if (rows.length === 0) return ok(0)

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      for (const refund of rows) {
        upsertCardRefundRows(evolu, refund, mutationOptions)
      }
    })
    return ok(rows.length)
  }
