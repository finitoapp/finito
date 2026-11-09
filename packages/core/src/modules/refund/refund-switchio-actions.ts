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
  interpretSwitchioReversalResult,
  type SwitchioCardRefundResult,
  type SwitchioNativePayResult,
  type SwitchioRefundDep,
  type SwitchioRefundError,
} from "../../switchio.ts"
import { deriveSwitchioRefundAccountTransactionId } from "../account-transaction/account-transaction-utils.ts"
import { cardSwitchioClosuresOfDeviceSinceQuery } from "../card-switchio-closure/card-switchio-closure-queries.ts"
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
  NonNegativeInteger,
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
  refundsByPaymentIdQuery,
} from "./refund-queries.ts"
import { chooseSwitchioRefundKind } from "./refund-switchio-utils.ts"
import type { CardSwitchioRefundAttemptId, RefundId } from "./refund-types.ts"

/**
 * Refunding to the card through the SwitchioPay terminal on this phone
 * (refund/0007): by a reversal, which takes the whole payment back and is
 * cheaper, whenever one can be made (refund/0008), and otherwise by a
 * referral refund that names the payment by the `refundId` its result
 * carried (payment/0009). As with Qerko (qerko/0004),
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

/**
 * The terminal would not take the payment back: most likely its batch was
 * closed outside Finito. A referral refund may still be made.
 */
export const createCardSwitchioReversalDeclinedError = defineError(
  "CardSwitchioReversalDeclined"
)<{
  readonly attemptId: CardSwitchioRefundAttemptId
  readonly responseCode: string | null
  readonly responseMessage: string | null
}>()
export type CardSwitchioReversalDeclinedError = ReturnType<
  typeof createCardSwitchioReversalDeclinedError
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
  | CardSwitchioReversalDeclinedError
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
  | "kind"
  | "refundId"
  | "amount"
  | "tipAmount"
  | "isTip"
  | "linesJson"
> & {
  readonly paymentId: PaymentId
  readonly deviceId: DeviceId
  readonly kind: "reversal" | "referralRefund"
  readonly refundId: RefundId
  readonly amount: NonNegativeInteger
}

/** The tip is refunded once per payment, whichever way (refund/0004). */
const tipRefundId = (paymentId: PaymentId): RefundId =>
  createIdFromString<"Refund">(`refund:tip:${paymentId}`)

/**
 * Writes the refund the terminal approved and takes the attempt away, in one
 * batch. The refund's id was fixed when the attempt started and the money
 * movement's derives from it, so the same approval written twice — through
 * the promise and restored, or restored and asked — writes the same rows.
 * The checks the start made are not made again: the money went back, so
 * what the terminal did is recorded even if another device refunded part of
 * the payment meanwhile. An attempt that returned the tip with the goods (a
 * reversal, or a referral refund of the whole payment) writes it as the
 * tip's own refund beside the goods' (refund/0004).
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
          method: "cardSwitchio",
          accountId: card.accountId,
          accountTransactionId: deriveSwitchioRefundAccountTransactionId(
            refund.refundId
          ),
        },
        now
      )
    const rows = [
      refundRows(attempt),
      ...(attempt.tipAmount === null || attempt.tipAmount === 0
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
          attempt.kind === "reversal"
            ? createCardSwitchioReversalDeclinedError({
                attemptId: attempt.id,
                responseCode: error.responseCode,
                responseMessage: error.responseMessage,
              })
            : createCardSwitchioRefundDeclinedError({
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
 * What a refund to the card through SwitchioPay asks for. Named because the
 * payment screen retries the same request as a referral refund when the
 * terminal declines the reversal.
 */
export type StartCardSwitchioRefundInput = {
  readonly paymentId: PaymentId
  /** This phone: the one whose SwitchioPay will answer. */
  readonly deviceId: DeviceId
  /** A referral refund even where a reversal could be made. */
  readonly referral?: boolean
} & (
  | { readonly tip: true }
  | { readonly whole: true }
  | { readonly amount: NonNegativeInteger }
  | { readonly lines: ReadonlyArray<RefundLineInput> }
)

/**
 * Starts refunding to the card on the SwitchioPay terminal of this phone:
 * an amount (or goods lines), the payment's tip, or the `whole` payment —
 * every goods amount still refundable and the tip. The same checks as any
 * refund decide what may be asked for; on top, the payment must have been
 * taken through SwitchioPay with the `refundId` its result carried.
 *
 * A reversal is made whenever one can be (refund/0008): it is cheaper. When
 * the terminal declines it, `CardSwitchioReversalDeclined` lets the caller
 * offer a referral refund instead, started again with `referral`.
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
    referral = false,
    ...what
  }: StartCardSwitchioRefundInput): Task<
    CardSwitchioRefundProgress,
    StartCardSwitchioRefundError,
    SettleDeps & UuidDep & SwitchioRefundDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const attemptId = createRowId<"CardSwitchioRefundAttempt">()

    let payment: {
      readonly currency: keyof typeof currencyNumericCodes
      readonly amount: NonNegativeInteger
    }
    let goods = NonNegativeInteger(0)
    let tip = NonNegativeInteger(0)
    let linesJson: NonEmptyString | null = null
    if ("tip" in what) {
      const plan = await run(loadTipRefundPlan(paymentId))
      if (!plan.ok) return plan
      payment = plan.value.payment
      tip = plan.value.tipAmount
    } else {
      const plan = await run(
        loadGoodsRefundPlan({
          paymentId,
          amount:
            "whole" in what
              ? "remaining"
              : "amount" in what
                ? what.amount
                : undefined,
          lines: "lines" in what ? what.lines : undefined,
        })
      )
      if (!plan.ok) return plan
      payment = plan.value.payment
      goods = plan.value.refundAmount
      if (plan.value.refundLines.length > 0) {
        linesJson = encodeRefundLines(plan.value.refundLines)
      }
      if ("whole" in what) {
        const tipPlan = await run(loadTipRefundPlan(paymentId))
        if (tipPlan.ok) tip = tipPlan.value.tipAmount
        else if (tipPlan.error.type !== "RefundTipUnavailable") return tipPlan
      }
    }

    const [[card], attempts, refunds] = await Promise.all([
      evolu.loadQuery(paymentCardSwitchioRefundSourceQuery(paymentId)),
      evolu.loadQuery(cardSwitchioRefundAttemptsByPaymentIdQuery(paymentId)),
      evolu.loadQuery(refundsByPaymentIdQuery(paymentId)),
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

    const closedSinceApproval =
      card.deviceId !== null && card.approvedAt !== null
        ? (
            await evolu.loadQuery(
              cardSwitchioClosuresOfDeviceSinceQuery({
                deviceId: card.deviceId,
                since: card.approvedAt,
              })
            )
          ).length > 0
        : true
    const kind = referral
      ? "referralRefund"
      : chooseSwitchioRefundKind({
          deviceId,
          charged: payment.amount,
          requested: { goods, tip },
          refundCount: refunds.length,
          source: card,
          closedSinceApproval,
        })

    // The tip alone is the tip's refund; goods, with or without the tip
    // beside them, are the goods' refund, the tip written as its own.
    const tipOnly = "tip" in what
    const refundId = tipOnly
      ? tipRefundId(paymentId)
      : createIdFromString<"Refund">(
          kind === "reversal"
            ? `refund:reversal:${paymentId}`
            : `refund:switchio:${attemptId}`
        )
    const transactionId = NonEmptyString255(run.deps.uuid.create())
    const attempt = {
      id: attemptId,
      paymentId,
      deviceId,
      transactionId,
      kind,
      refundId,
      amount: tipOnly ? tip : goods,
      tipAmount: tipOnly || tip === 0 ? null : tip,
      linesJson,
      status: "pending",
      failureReason: null,
      startedAt: TimestampMs(run.deps.date.now().getTime()),
      isDeleted: sqliteFalse,
      ...(tipOnly ? { isTip: sqliteTrue } : {}),
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

    const outcome =
      kind === "reversal" && card.transactionId !== null
        ? await run.deps.switchioRefund.reverse({
            transactionId,
            originalTransactionId: card.transactionId,
          })
        : await run.deps.switchioRefund.referralRefund({
            transactionId,
            amount: goods + tip,
            currencyCode: currencyNumericCodes[payment.currency],
            refundId: card.refundId,
          })
    const applied = await run(
      applyRefundOutcome({
        attempt: { ...attempt, isTip: attempt.isTip ?? null },
        outcome,
      })
    )
    // A reversal of a payment already taken back is declined too, and a
    // refund to the card offered after it would pay the customer twice: when
    // the payment reads as reversed, its money is back, so record that.
    if (
      !applied.ok &&
      applied.error.type === "CardSwitchioReversalDeclined" &&
      card.transactionId !== null
    ) {
      const original = await run.deps.switchioRefund.lookup(card.transactionId)
      if (original.type === "approved" && original.reversed) {
        return run(
          settleApprovedAttempt({ ...attempt, isTip: attempt.isTip ?? null })
        )
      }
    }
    return applied
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
        outcome:
          attempt.kind === "reversal"
            ? interpretSwitchioReversalResult(restored)
            : interpretSwitchioRefundResult(restored),
      })
    )
  }

/**
 * Asks the terminal of this phone what became of an attempt whose result was
 * lost or unreadable, and settles it when the terminal says it was approved.
 * The terminal does not find a reversal by its own id, so a reversal is also
 * confirmed by the payment it took back reading as reversed.
 *
 * Nothing the terminal says is taken for "not refunded" (it answers "not
 * found" for a reversal it approved), so the attempt is never marked failed
 * here. Called only while no refund is waiting on SwitchioPay, so a
 * `pending` attempt the terminal cannot account for becomes `unknown`:
 * nothing will answer it any more.
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
    CardSwitchioRefundOtherDeviceError,
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

    const own = await run.deps.switchioRefund.lookup(attempt.transactionId)
    if (own.type === "approved" && !own.reversed) {
      return run(settleApprovedAttempt(attempt))
    }
    if (attempt.kind === "reversal") {
      const [source] = await evolu.loadQuery(
        paymentCardSwitchioRefundSourceQuery(attempt.paymentId)
      )
      const original =
        source?.transactionId === null || source?.transactionId === undefined
          ? null
          : await run.deps.switchioRefund.lookup(source.transactionId)
      if (original?.type === "approved" && original.reversed) {
        return run(settleApprovedAttempt(attempt))
      }
    }

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
