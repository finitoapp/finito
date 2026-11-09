import {
  createIdFromString,
  type MutationOptions,
  sqliteFalse,
  sqliteTrue,
} from "@evolu/common"
import { z } from "zod"

import { jsonCodec } from "../../zod-utils.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { PaymentLineId } from "../payment-line/payment-line-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { removeUndefinedValues } from "../shared/evolu-utils.ts"
import {
  type FiatCurrency,
  Integer,
  type NonEmptyString,
  type NonEmptyString255,
  NonEmptyStringSchema,
  type NonNegativeInteger,
  NonNegativeIntegerSchema,
  type PositiveNumber,
  PositiveNumberSchema,
  TimestampMs,
} from "../shared/schema.ts"
import type { RefundId, RefundMethod } from "./refund-types.ts"

/**
 * What a refund to the card writes once its terminal approved it, for every
 * terminal that refunds that way (Qerko's, qerko/0004; SwitchioPay's,
 * refund/0007): the `refund` row, its goods lines, and the money going out
 * of the terminal's account, and what the terminal answered, in its own
 * detail table. The attempt tables stay each terminal's own; only this part
 * is the same.
 */

interface RefundLineValue {
  readonly paymentLineId: PaymentLineId
  readonly quantity: PositiveNumber
  readonly amount: NonNegativeInteger
}

const RefundLinesJson = jsonCodec(
  z
    .array(
      z.object({
        // A plain string: `PaymentLineId` is a one-way transform, which
        // `z.encode` cannot write. It is checked when the lines are read.
        paymentLineId: z.string(),
        quantity: PositiveNumberSchema,
        amount: NonNegativeIntegerSchema,
      })
    )
    .readonly()
)

/** The goods lines an attempt carries until its refund is written. */
export const encodeRefundLines = (
  lines: ReadonlyArray<RefundLineValue>
): NonEmptyString =>
  NonEmptyStringSchema.decode(
    z.encode(
      RefundLinesJson,
      lines.map(({ paymentLineId, quantity, amount }) => ({
        paymentLineId,
        quantity,
        amount,
      }))
    )
  )

/** The lines {@link encodeRefundLines} wrote; unreadable ones are skipped. */
const decodeRefundLines = (
  linesJson: NonEmptyString | null
): ReadonlyArray<RefundLineValue> =>
  (linesJson === null
    ? []
    : (z.safeDecode(RefundLinesJson, linesJson).data ?? [])
  ).flatMap((line) => {
    const paymentLineId = PaymentLineId.safeParse(line.paymentLineId)
    return paymentLineId.success
      ? [{ ...line, paymentLineId: paymentLineId.data }]
      : []
  })

/**
 * The terminal transaction that refunded to the card, kept under the refund
 * as `refundQerkoTerminal` or `refundCardSwitchio`. A refund of the whole
 * payment writes it under both its refunds, goods and tip.
 */
export type CardRefundTerminal =
  | {
      readonly method: Extract<RefundMethod, "qerkoTerminal">
      readonly transactionId: NonEmptyString255
      readonly terminalId: NonEmptyString255
    }
  | {
      readonly method: Extract<RefundMethod, "cardSwitchio">
      readonly transactionId: NonEmptyString255
      readonly kind: "reversal" | "referralRefund"
      /** What the terminal's receipt prints, when its answer carried it. */
      readonly authCode: NonEmptyString255 | null
      readonly sequenceNumber: NonEmptyString255 | null
    }

export interface CardRefund {
  readonly refundId: RefundId
  readonly paymentId: PaymentId
  readonly deviceId: DeviceId | null
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly terminal: CardRefundTerminal
  readonly isTip: typeof sqliteTrue | null
  readonly linesJson: NonEmptyString | null
  /** The terminal's account the money goes back out of. */
  readonly accountId: AccountId
  readonly accountTransactionId: AccountTransactionId
}

/**
 * The rows of an approved card refund, computed outside the mutation that
 * writes them ({@link upsertCardRefundRows}), so a caller can fold them into
 * its own batch. Every id comes from the caller or derives from the refund's,
 * so writing the same refund twice writes the same rows.
 */
export const computeCardRefundRows = (refund: CardRefund, now: Date) => {
  const refundedAt = TimestampMs(now.getTime())
  return {
    refund,
    refundedAt,
    lines: decodeRefundLines(refund.linesJson),
    accountTransaction: computeAccountTransactionRows(
      {
        id: refund.accountTransactionId,
        accountId: refund.accountId,
        kind: refund.terminal.method,
        amount: Integer(-refund.amount),
        currency: refund.currency,
        occurredAt: refundedAt,
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: refund.deviceId, source: "manual" },
      },
      now
    ),
  }
}

export const upsertCardRefundRows = (
  evolu: EvoluDep["evolu"],
  {
    refund,
    refundedAt,
    lines,
    accountTransaction,
  }: ReturnType<typeof computeCardRefundRows>,
  options: MutationOptions
): void => {
  evolu.upsert(
    "refund",
    {
      id: refund.refundId,
      paymentId: refund.paymentId,
      deviceId: refund.deviceId,
      amount: refund.amount,
      currency: refund.currency,
      method: refund.terminal.method,
      refundedAt,
      ...(refund.isTip === sqliteTrue ? { isTip: sqliteTrue } : {}),
      isDeleted: sqliteFalse,
    },
    options
  )
  for (const line of lines) {
    evolu.upsert(
      "refundLine",
      {
        id: createIdFromString<"RefundLine">(
          `refundLine:${refund.refundId}:${line.paymentLineId}`
        ),
        refundId: refund.refundId,
        paymentId: refund.paymentId,
        paymentLineId: line.paymentLineId,
        quantity: line.quantity,
        amount: line.amount,
        isDeleted: sqliteFalse,
      },
      options
    )
  }
  upsertCardRefundTerminalRow(evolu, refund, options)
  upsertAccountTransactionRows(evolu, accountTransaction, options)
}

const upsertCardRefundTerminalRow = (
  evolu: EvoluDep["evolu"],
  { refundId, accountId, terminal }: CardRefund,
  options: MutationOptions
): void => {
  if (terminal.method === "qerkoTerminal") {
    evolu.upsert(
      "refundQerkoTerminal",
      {
        id: refundId,
        accountId,
        transactionId: terminal.transactionId,
        terminalId: terminal.terminalId,
        isDeleted: sqliteFalse,
      },
      options
    )
    return
  }
  // What the receipt prints is written when known and never erased: the
  // same refund settled again from an answer without it (the terminal asked
  // afterwards) keeps what the first answer said.
  evolu.upsert(
    "refundCardSwitchio",
    removeUndefinedValues({
      id: refundId,
      accountId,
      transactionId: terminal.transactionId,
      kind: terminal.kind,
      authCode: terminal.authCode ?? undefined,
      sequenceNumber: terminal.sequenceNumber ?? undefined,
      isDeleted: sqliteFalse,
    }),
    options
  )
}
