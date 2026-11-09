import type { IndexesConfig } from "@evolu/common/local-first"

import { z } from "zod"
import { AccountId } from "../account/account-types.ts"
import { DeviceId } from "../device/device-types.ts"
import { PaymentId } from "../payment/payment-types.ts"
import { PaymentLineId } from "../payment-line/payment-line-types.ts"
import {
  FiatCurrencySchema,
  type InferTable,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveNumberSchema,
  SqliteTrueSchema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  CardSwitchioRefundAttemptId,
  RefundId,
  RefundLineId,
  RefundMethodSchema,
} from "./refund-types.ts"

export const refund = {
  id: RefundId,
  paymentId: PaymentId,
  deviceId: DeviceId.nullable(),
  amount: NonNegativeIntegerSchema,
  currency: FiatCurrencySchema,
  method: RefundMethodSchema,
  refundedAt: TimestampMsSchema,
  isTip: SqliteTrueSchema.nullable(),
} as const

/**
 * The cash a refund from the cash register handed out of `accountId`
 * (refund/0012), beside the `refund` row under its id. The refund keeps the
 * exact amount it gives back, so a whole refund refunds the whole payment;
 * this is that amount rounded to what the register can hand out, whole
 * crowns for CZK, and what its account transaction and EET storno carry.
 * Like `paymentCashRegister.receivedAmount` for a payment. A cash refund
 * written by an older version has no row: it handed out its `amount`.
 */
export const refundCashRegister = {
  id: RefundId,
  accountId: AccountId,
  handedAmount: NonNegativeIntegerSchema,
} as const

export const refundLine = {
  id: RefundLineId,
  refundId: RefundId,
  paymentId: PaymentId,
  paymentLineId: PaymentLineId,
  quantity: PositiveNumberSchema,
  amount: NonNegativeIntegerSchema,
} as const

/**
 * A refund to the card the Qerko terminal is still working on (qerko/0004).
 * The `refund` row and its money movement exist only once the terminal
 * approved, so everything that reads refunds stays as it is; until then this
 * row is all there is. Its id is the id the refund will have.
 *
 * `pending` is polled until Qerko answers; `unknown` means the card may have
 * been refunded and blocks another attempt until staff dismiss it after
 * checking; `failed` is a definite no, kept so the screen can say so. The
 * goods lines of the refund wait here as `linesJson`, to be written beside
 * the refund when it is approved.
 *
 * `tipAmount` is the tip a refund of the whole payment returns beside the
 * goods, written as the tip's own refund (refund/0011). The column came
 * later: an older version settling such an attempt writes only the goods
 * and takes the attempt away, so the settled row keeps `tipAmount` and
 * `repairQerkoTerminalTipRefunds` writes the tip it left out.
 */
export const qerkoTerminalRefundAttempt = {
  id: RefundId,
  paymentId: PaymentId,
  deviceId: DeviceId.nullable(),
  /** Qerko's UUID for this attempt, stored before the request leaves. */
  transactionId: NonEmptyString255Schema,
  terminalId: NonEmptyString255Schema,
  /** The goods, or the tip when `isTip`. */
  amount: NonNegativeIntegerSchema,
  /** The tip a refund of the whole payment returns with the goods. */
  tipAmount: NonNegativeIntegerSchema.nullable(),
  isTip: SqliteTrueSchema.nullable(),
  linesJson: NonEmptyStringSchema.nullable(),
  status: z.enum(["pending", "failed", "unknown"]),
  failureReason: z.enum(["declined", "cancelled"]).nullable(),
  startedAt: TimestampMsSchema,
} as const

/**
 * A refund to the card the SwitchioPay terminal on one phone is working on,
 * or was (refund/0007). Like {@link qerkoTerminalRefundAttempt}, the `refund`
 * row and its money movement are written only once the terminal approved;
 * until then this row is all there is.
 *
 * Unlike Qerko's, each attempt has its own random id and its row is never
 * reused, so `transactionId` never changes and a result that comes back late
 * — restored after Android killed the app, or asked of the terminal — still
 * finds its attempt after another one began. `refundId` is the refund it
 * will write, fixed when it starts.
 *
 * Only `deviceId`, the phone that launched SwitchioPay, ever gets the result,
 * so only it writes `status` and `failureReason`. Another device only takes
 * the attempt away (`isDeleted`), after staff checked SwitchioPay: a separate
 * column, so neither write overwrites the other. A taken-away attempt is
 * still found by its `transactionId`, and an approved result for it is
 * still recorded, since the money did go back.
 *
 * `pending` is waiting for SwitchioPay; `unknown` means the card may have
 * been refunded and blocks another attempt; `failed` is a definite no, kept
 * so the screen can say so. `kind` says whether the terminal is asked to take
 * the payment back (`reversal`) or to refund to the card (`referralRefund`,
 * refund/0008); `tipAmount` is the tip such an attempt returns beside the
 * goods, written as the tip's own refund.
 */
export const cardSwitchioRefundAttempt = {
  id: CardSwitchioRefundAttemptId,
  paymentId: PaymentId,
  deviceId: DeviceId,
  /** The ECR request id, stored before SwitchioPay is launched. */
  transactionId: NonEmptyString255Schema,
  kind: z.enum(["reversal", "referralRefund"]),
  refundId: RefundId,
  /** The goods, or the tip when `isTip`. */
  amount: NonNegativeIntegerSchema,
  /** The tip a reversal returns together with the goods. */
  tipAmount: NonNegativeIntegerSchema.nullable(),
  isTip: SqliteTrueSchema.nullable(),
  linesJson: NonEmptyStringSchema.nullable(),
  status: z.enum(["pending", "failed", "unknown"]),
  failureReason: z.enum(["declined", "cancelled"]).nullable(),
  startedAt: TimestampMsSchema,
} as const

export const refundIndexes = ((create) => [
  create("refund_paymentId").on("refund").column("paymentId"),
  create("refund_deviceId").on("refund").column("deviceId"),
  // The sales statistics count a refund on the day it was paid out.
  create("refund_refundedAt").on("refund").column("refundedAt"),
  create("refundLine_paymentId").on("refundLine").column("paymentId"),
  create("qerkoTerminalRefundAttempt_paymentId")
    .on("qerkoTerminalRefundAttempt")
    .column("paymentId"),
  create("qerkoTerminalRefundAttempt_status")
    .on("qerkoTerminalRefundAttempt")
    .column("status"),
  create("cardSwitchioRefundAttempt_paymentId")
    .on("cardSwitchioRefundAttempt")
    .column("paymentId"),
  create("cardSwitchioRefundAttempt_transactionId")
    .on("cardSwitchioRefundAttempt")
    .column("transactionId"),
  create("cardSwitchioRefundAttempt_deviceId_status")
    .on("cardSwitchioRefundAttempt")
    .columns(["deviceId", "status"]),
]) satisfies IndexesConfig

export type RefundRow = InferTable<typeof refund>
export type RefundCashRegisterRow = InferTable<typeof refundCashRegister>
export type RefundLineRow = InferTable<typeof refundLine>
export type QerkoTerminalRefundAttemptRow = InferTable<
  typeof qerkoTerminalRefundAttempt
>
export type CardSwitchioRefundAttemptRow = InferTable<
  typeof cardSwitchioRefundAttempt
>
