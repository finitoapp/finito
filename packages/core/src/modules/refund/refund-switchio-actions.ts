import {
  createIdFromString,
  err,
  ok,
  type Result,
  sqliteFalse,
  sqliteTrue,
  type Task,
  type UpsertValues,
} from "@evolu/common"

import type { DateDep, EvoluOwnerDep, UuidDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  interpretSwitchioRefundResult,
  type SwitchioCardRefundResult,
  type SwitchioNativePayResult,
  type SwitchioRefundDep,
  type SwitchioRefundError,
} from "../../switchio.ts"
import { deriveSwitchioRefundAccountTransactionId } from "../account-transaction/account-transaction-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import { optionalNonEmptyString255 } from "../payment/payment-actions.ts"
import type { PaymentNotFoundError } from "../payment/payment-errors.ts"
import {
  paymentCardSwitchioRefundSourceQuery,
  paymentDetailQuery,
} from "../payment/payment-queries.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { currencyNumericCodes } from "../shared/money.ts"
import {
  type NonEmptyString,
  NonEmptyString255,
  type NonNegativeInteger,
  TimestampMs,
} from "../shared/schema.ts"
import type {
  CardSwitchioRefundAttemptRow,
  cardSwitchioRefundAttempt,
} from "./refund.ts"
import {
  loadGoodsRefundPlan,
  loadTipRefundPlan,
  type RefundAmountInvalidError,
  type RefundItemsUnavailableError,
  type RefundLineInput,
  type RefundLineUnavailableError,
  type RefundPaymentNotPaidError,
  type RefundTipUnavailableError,
} from "./refund-actions.ts"
import {
  computeCardRefundRows,
  encodeRefundLines,
  upsertCardRefundRows,
} from "./refund-card-settlement.ts"
import {
  cardSwitchioRefundAttemptByIdQuery,
  cardSwitchioRefundAttemptByTransactionIdQuery,
  cardSwitchioRefundAttemptsByPaymentIdQuery,
} from "./refund-queries.ts"
import type { CardSwitchioRefundAttemptId, RefundId } from "./refund-types.ts"

/**
 * Refunding to the card through the SwitchioPay terminal on this phone
 * (refund/0007), by a referral refund that names the payment by the
 * `refundId` its result carried (payment/0009). As with Qerko (qerko/0004),
 * nothing is recorded as a refund until the terminal approved: a
 * `cardSwitchioRefundAttempt` carries it meanwhile.
 *
 * Only the phone that launched SwitchioPay ever gets the answer — through
 * the promise, through the copy `MainActivity` stores when Android killed
 * the app, or by asking the terminal afterwards — so there is no background
 * poll. Another device can only take an attempt away after staff checked.
 */

export const createCardSwitchioRefundNotAvailableError = defineError(
  "CardSwitchioRefundNotAvailable"
)<{ readonly paymentId: PaymentId }>()
export type CardSwitchioRefundNotAvailableError = ReturnType<
  typeof createCardSwitchioRefundNotAvailableError
>

export const createCardSwitchioRefundAttemptRunningError = defineError(
  "CardSwitchioRefundAttemptRunning"
)<{
  readonly paymentId: PaymentId
  readonly attemptId: CardSwitchioRefundAttemptId
}>()
export type CardSwitchioRefundAttemptRunningError = ReturnType<
  typeof createCardSwitchioRefundAttemptRunningError
>

export const createCardSwitchioRefundDeclinedError = defineError(
  "CardSwitchioRefundDeclined"
)<{
  readonly attemptId: CardSwitchioRefundAttemptId
  readonly responseMessage: string | null
}>()
export type CardSwitchioRefundDeclinedError = ReturnType<
  typeof createCardSwitchioRefundDeclinedError
>

export const createCardSwitchioRefundAttemptNotFoundError = defineError(
  "CardSwitchioRefundAttemptNotFound"
)<{ readonly transactionId: string | null }>()
export type CardSwitchioRefundAttemptNotFoundError = ReturnType<
  typeof createCardSwitchioRefundAttemptNotFoundError
>

/** Only the phone that launched SwitchioPay can ask its terminal. */
export const createCardSwitchioRefundOtherDeviceError = defineError(
  "CardSwitchioRefundOtherDevice"
)<{ readonly attemptId: CardSwitchioRefundAttemptId }>()
export type CardSwitchioRefundOtherDeviceError = ReturnType<
  typeof createCardSwitchioRefundOtherDeviceError
>

/** Where a refund to the card stands after its outcome was applied. */
export type CardSwitchioRefundProgress =
  | { readonly status: "refunded" }
  /** The outcome is unknown: the card may have been refunded. */
  | { readonly status: "unresolved" }
  /** A definite no, or an attempt that ended without refunding. */
  | { readonly status: "idle" }

/** What the terminal's answer leaves of the attempt's own error union. */
type OutcomeError =
  | CardSwitchioRefundDeclinedError
  | Exclude<
      SwitchioRefundError,
      { readonly type: "SwitchioRefundFailed" | "SwitchioResultUnreadable" }
    >

export type StartCardSwitchioRefundError =
  | PaymentNotFoundError
  | RefundPaymentNotPaidError
  | RefundAmountInvalidError
  | RefundItemsUnavailableError
  | RefundLineUnavailableError
  | RefundTipUnavailableError
  | CardSwitchioRefundNotAvailableError
  | CardSwitchioRefundAttemptRunningError
  | OutcomeError

export type SettleRestoredCardSwitchioRefundError =
  | OutcomeError
  | CardSwitchioRefundAttemptNotFoundError

type SettleDeps = EvoluDep & EvoluOwnerDep & DateDep

type AttemptRow = Pick<
  CardSwitchioRefundAttemptRow,
  | "id"
  | "paymentId"
  | "deviceId"
  | "refundId"
  | "amount"
  | "isTip"
  | "linesJson"
> & {
  readonly paymentId: PaymentId
  readonly deviceId: DeviceId
  readonly refundId: RefundId
  readonly amount: NonNegativeInteger
}

/**
 * Writes the refund the terminal approved and takes the attempt away, in one
 * batch. The refund's id was fixed when the attempt started and the money
 * movement's derives from it, so the same approval written twice — through
 * the promise and restored, or restored and asked — writes the same rows.
 * The checks the start made are not made again: the money went back, so
 * what the terminal did is recorded even if another device refunded part of
 * the payment meanwhile.
 */
const settleApprovedAttempt =
  (attempt: AttemptRow): Task<CardSwitchioRefundProgress, never, SettleDeps> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [[card], [payment]] = await Promise.all([
      evolu.loadQuery(paymentCardSwitchioRefundSourceQuery(attempt.paymentId)),
      evolu.loadQuery(paymentDetailQuery(attempt.paymentId)),
    ])
    if (card === undefined || payment === undefined) {
      run.deps.console.warn(
        "[refund] An approved card refund has no payment to record it on",
        { attemptId: attempt.id, paymentId: attempt.paymentId }
      )
      return ok({ status: "unresolved" })
    }

    const rows = computeCardRefundRows(
      {
        refundId: attempt.refundId,
        paymentId: attempt.paymentId,
        deviceId: attempt.deviceId,
        amount: attempt.amount,
        currency: payment.currency,
        method: "cardSwitchio",
        isTip: attempt.isTip,
        linesJson: attempt.linesJson,
        accountId: card.accountId,
        accountTransactionId: deriveSwitchioRefundAccountTransactionId(
          attempt.refundId
        ),
      },
      run.deps.date.now()
    )
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      upsertCardRefundRows(evolu, rows, mutationOptions)
      evolu.update(
        "cardSwitchioRefundAttempt",
        { id: attempt.id, isDeleted: sqliteTrue },
        mutationOptions
      )
    })
    return ok({ status: "refunded" })
  }

/**
 * Applies one answer of the terminal to its attempt: approved writes the
 * refund, a decline keeps the attempt as failed, a refund that never started
 * takes it away, and an unreadable answer leaves it unknown, blocking
 * another refund until it is resolved (payment/0006).
 */
const applyRefundOutcome =
  ({
    attempt,
    outcome,
  }: {
    readonly attempt: AttemptRow
    readonly outcome: Result<SwitchioCardRefundResult, SwitchioRefundError>
  }): Task<CardSwitchioRefundProgress, OutcomeError, SettleDeps> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    if (outcome.ok) return run(settleApprovedAttempt(attempt))

    const { error } = outcome
    run.deps.console.warn("[refund] Switchio card refund did not go through", {
      attemptId: attempt.id,
      error,
    })
    const update = (
      values: Partial<
        Omit<UpsertValues<typeof cardSwitchioRefundAttempt>, "id">
      >
    ) =>
      runMutationWithCompletion((options) =>
        evolu.update(
          "cardSwitchioRefundAttempt",
          { id: attempt.id, ...values },
          { ...options, owner: evoluOwner }
        )
      )

    switch (error.type) {
      case "SwitchioResultUnreadable":
        await update({ status: "unknown" })
        return ok({ status: "unresolved" })
      case "SwitchioRefundFailed":
        await update({ status: "failed", failureReason: "declined" })
        return err(
          createCardSwitchioRefundDeclinedError({
            attemptId: attempt.id,
            responseMessage: error.responseMessage,
          })
        )
      case "SwitchioRefundNotStarted":
      case "SwitchioUnavailable":
        await update({ isDeleted: sqliteTrue })
        return err(error)
    }
  }

/**
 * Starts refunding to the card on the SwitchioPay terminal of this phone,
 * for an amount (or goods lines), or the payment's tip. The same checks as
 * any refund decide what may be asked for; on top, the payment must have
 * been taken through SwitchioPay with the `refundId` its result carried.
 *
 * A refund started while another one of the payment is pending or unknown
 * is refused: the card could be refunded twice. The attempt is written
 * before SwitchioPay is launched, so a result that comes back after Android
 * killed the app still finds it.
 */
export const startCardSwitchioRefund =
  ({
    paymentId,
    deviceId,
    ...what
  }: {
    readonly paymentId: PaymentId
    /** This phone: the one whose SwitchioPay will answer. */
    readonly deviceId: DeviceId
  } & (
    | { readonly tip: true }
    | { readonly amount: NonNegativeInteger }
    | { readonly lines: ReadonlyArray<RefundLineInput> }
  )): Task<
    CardSwitchioRefundProgress,
    StartCardSwitchioRefundError,
    SettleDeps & UuidDep & SwitchioRefundDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const attemptId = createRowId<"CardSwitchioRefundAttempt">()

    let currency: keyof typeof currencyNumericCodes
    let amount: NonNegativeInteger
    let linesJson: NonEmptyString | null = null
    let refundId: RefundId
    if ("tip" in what) {
      const plan = await run(loadTipRefundPlan(paymentId))
      if (!plan.ok) return plan
      currency = plan.value.payment.currency
      amount = plan.value.tipAmount
      // The tip is refunded once per payment, whichever way (refund/0004).
      refundId = createIdFromString<"Refund">(`refund:tip:${paymentId}`)
    } else {
      const plan = await run(
        loadGoodsRefundPlan({
          paymentId,
          amount: "amount" in what ? what.amount : undefined,
          lines: "lines" in what ? what.lines : undefined,
        })
      )
      if (!plan.ok) return plan
      currency = plan.value.payment.currency
      amount = plan.value.refundAmount
      if (plan.value.refundLines.length > 0) {
        linesJson = encodeRefundLines(plan.value.refundLines)
      }
      refundId = createIdFromString<"Refund">(`refund:switchio:${attemptId}`)
    }

    const [[card], attempts] = await Promise.all([
      evolu.loadQuery(paymentCardSwitchioRefundSourceQuery(paymentId)),
      evolu.loadQuery(cardSwitchioRefundAttemptsByPaymentIdQuery(paymentId)),
    ])
    if (card === undefined || card.refundId === null) {
      return err(createCardSwitchioRefundNotAvailableError({ paymentId }))
    }
    const running = attempts.find(({ status }) => status !== "failed")
    if (running !== undefined) {
      return err(
        createCardSwitchioRefundAttemptRunningError({
          paymentId,
          attemptId: running.id,
        })
      )
    }

    const transactionId = NonEmptyString255(run.deps.uuid.create())
    const attempt = {
      id: attemptId,
      paymentId,
      deviceId,
      transactionId,
      kind: "referralRefund",
      refundId,
      amount,
      tipAmount: null,
      linesJson,
      status: "pending",
      failureReason: null,
      startedAt: TimestampMs(run.deps.date.now().getTime()),
      isDeleted: sqliteFalse,
      ...("tip" in what ? { isTip: sqliteTrue } : {}),
    } satisfies UpsertValues<typeof cardSwitchioRefundAttempt>
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      // A definite no of an earlier attempt is only kept to be shown.
      for (const { id } of attempts) {
        evolu.update(
          "cardSwitchioRefundAttempt",
          { id, isDeleted: sqliteTrue },
          mutationOptions
        )
      }
      evolu.upsert("cardSwitchioRefundAttempt", attempt, mutationOptions)
    })

    const outcome = await run.deps.switchioRefund.referralRefund({
      transactionId,
      amount,
      currencyCode: currencyNumericCodes[currency],
      refundId: card.refundId,
    })
    return run(
      applyRefundOutcome({
        attempt: { ...attempt, isTip: attempt.isTip ?? null },
        outcome,
      })
    )
  }

/**
 * Settles a SwitchioPay refund result that came back after Android killed
 * the app, by the request id it echoes. An attempt staff took away meanwhile
 * is still settled: an approved result means the money did go back.
 */
export const settleRestoredCardSwitchioRefund =
  ({
    restored,
  }: {
    readonly restored: SwitchioNativePayResult
  }): Task<
    CardSwitchioRefundProgress,
    SettleRestoredCardSwitchioRefundError,
    SettleDeps
  > =>
  async (run) => {
    const transactionId = optionalNonEmptyString255(restored.transactionId)
    const [attempt] =
      transactionId === null
        ? []
        : await run.deps.evolu.loadQuery(
            cardSwitchioRefundAttemptByTransactionIdQuery(transactionId)
          )
    if (attempt === undefined) {
      return err(
        createCardSwitchioRefundAttemptNotFoundError({
          transactionId: restored.transactionId,
        })
      )
    }
    return run(
      applyRefundOutcome({
        attempt,
        outcome: interpretSwitchioRefundResult(restored),
      })
    )
  }

/**
 * Asks the terminal of this phone what became of an attempt whose result was
 * lost or unreadable, and applies a definite answer. Called only while no
 * refund is waiting on SwitchioPay, so a `pending` attempt the terminal
 * cannot account for becomes `unknown`: nothing will answer it any more.
 */
export const resolveCardSwitchioRefundAttempt =
  ({
    attemptId,
    deviceId,
  }: {
    readonly attemptId: CardSwitchioRefundAttemptId
    readonly deviceId: DeviceId
  }): Task<
    CardSwitchioRefundProgress,
    CardSwitchioRefundDeclinedError | CardSwitchioRefundOtherDeviceError,
    SettleDeps & SwitchioRefundDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [attempt] = await evolu.loadQuery(
      cardSwitchioRefundAttemptByIdQuery(attemptId)
    )
    if (attempt === undefined || attempt.status === "failed") {
      return ok({ status: "idle" })
    }
    if (attempt.deviceId !== deviceId) {
      return err(createCardSwitchioRefundOtherDeviceError({ attemptId }))
    }

    const lookup = await run.deps.switchioRefund.lookup(attempt.transactionId)
    switch (lookup.type) {
      case "approved":
        return run(settleApprovedAttempt(attempt))
      case "declined":
        await runMutationWithCompletion((options) =>
          evolu.update(
            "cardSwitchioRefundAttempt",
            { id: attemptId, status: "failed", failureReason: "declined" },
            { ...options, owner: evoluOwner }
          )
        )
        return err(
          createCardSwitchioRefundDeclinedError({
            attemptId,
            responseMessage: null,
          })
        )
      case "unknown":
        if (attempt.status === "pending") {
          await runMutationWithCompletion((options) =>
            evolu.update(
              "cardSwitchioRefundAttempt",
              { id: attemptId, status: "unknown" },
              { ...options, owner: evoluOwner }
            )
          )
        }
        return ok({ status: "unresolved" })
    }
  }

/**
 * Staff's word that they checked SwitchioPay: the attempt is taken away,
 * which lets another one start. Works from any device, the only way out
 * when the phone that launched it is gone. If the card was refunded after
 * all and that phone's result comes back later, the refund is still written.
 */
export const dismissCardSwitchioRefundAttempt =
  (
    attemptId: CardSwitchioRefundAttemptId
  ): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "cardSwitchioRefundAttempt",
        { id: attemptId, isDeleted: sqliteTrue },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }
