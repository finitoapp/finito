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
import {
  type FiatCurrency,
  Integer,
  type NonEmptyString,
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
 * of the terminal's account. The attempt tables stay each terminal's own;
 * only this part is the same.
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

export interface CardRefund {
  readonly refundId: RefundId
  readonly paymentId: PaymentId
  readonly deviceId: DeviceId | null
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly method: Extract<RefundMethod, "qerkoTerminal" | "cardSwitchio">
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
        kind: refund.method,
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
      method: refund.method,
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
  upsertAccountTransactionRows(evolu, accountTransaction, options)
}
