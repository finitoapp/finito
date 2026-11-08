import {
  evoluJsonArrayFrom,
  type KyselyNotNull,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type { NonEmptyString255 } from "../shared/schema.ts"
import type { CardSwitchioRefundAttemptId, RefundId } from "./refund-types.ts"

const refundColumns = [
  "refund.id",
  "refund.paymentId",
  "refund.deviceId",
  "refund.amount",
  "refund.currency",
  "refund.method",
  "refund.refundedAt",
  "refund.isTip",
] as const

type RefundRequiredColumns = {
  paymentId: KyselyNotNull
  amount: KyselyNotNull
  currency: KyselyNotNull
  method: KyselyNotNull
  refundedAt: KyselyNotNull
}

export const refundsByPaymentIdQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("refund")
      .select(refundColumns)
      .where("refund.paymentId", "=", paymentId)
      .where("refund.isDeleted", "is not", sqliteTrue)
      .where("refund.amount", "is not", null)
      .where("refund.currency", "is not", null)
      .where("refund.method", "is not", null)
      .where("refund.refundedAt", "is not", null)
      .orderBy("refund.refundedAt")
      .orderBy("refund.createdAt")
      .orderBy("refund.id")
      .$narrowType<RefundRequiredColumns>()
  )

const selectRefundSummaries = (
  db: Parameters<Parameters<typeof createQuery>[0]>[0]
) =>
  db
    .selectFrom("refund")
    .innerJoin("payment", "payment.id", "refund.paymentId")
    .leftJoin("paymentCashRegister", (join) =>
      join
        .onRef("paymentCashRegister.id", "=", "payment.id")
        .on("paymentCashRegister.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("paymentBtc", (join) =>
      join
        .onRef("paymentBtc.id", "=", "payment.id")
        .on("paymentBtc.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("paymentCashu", (join) =>
      join
        .onRef("paymentCashu.id", "=", "payment.id")
        .on("paymentCashu.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("paymentLightningAddress", (join) =>
      join
        .onRef("paymentLightningAddress.id", "=", "payment.id")
        .on("paymentLightningAddress.isDeleted", "is not", sqliteTrue)
    )
    .select((eb) => [
      "refund.paymentId",
      "refund.amount",
      "refund.currency",
      "refund.isTip",
      "payment.billId",
      "payment.amount as paymentAmount",
      "payment.tipAmount as paymentTipAmount",
      "payment.currency as paymentCurrency",
      "paymentCashRegister.receivedAmount as cashReceivedAmount",
      evoluJsonArrayFrom(
        eb
          .selectFrom("reconciliationClaim")
          .innerJoin(
            "accountTransaction",
            "accountTransaction.id",
            "reconciliationClaim.accountTransactionId"
          )
          .select([
            "reconciliationClaim.accountTransactionId",
            "accountTransaction.amount",
            "accountTransaction.currency",
            quotedAmountSatsSql({
              kind: "accountTransaction.kind",
              btc: "paymentBtc.amountSats",
              cashu: "paymentCashu.amountSats",
              lightningAddress: "paymentLightningAddress.amountSats",
            }).as("paymentAmountSats"),
          ])
          .whereRef("reconciliationClaim.paymentId", "=", "payment.id")
          .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
          .where("reconciliationClaim.accountTransactionId", "is not", null)
          .where("accountTransaction.isDeleted", "is not", sqliteTrue)
          .where("accountTransaction.amount", "is not", null)
          .where("accountTransaction.currency", "is not", null)
          .$narrowType<{
            accountTransactionId: KyselyNotNull
            amount: KyselyNotNull
            currency: KyselyNotNull
          }>()
      ).as("paymentClaims"),
    ])
    .where("refund.isDeleted", "is not", sqliteTrue)
    .where("refund.paymentId", "is not", null)
    .where("refund.amount", "is not", null)
    .where("refund.currency", "is not", null)
    .where("payment.amount", "is not", null)
    .where("payment.tipAmount", "is not", null)
    .where("payment.currency", "is not", null)
    .$narrowType<{
      paymentId: KyselyNotNull
      amount: KyselyNotNull
      currency: KyselyNotNull
      paymentAmount: KyselyNotNull
      paymentTipAmount: KyselyNotNull
      paymentCurrency: KyselyNotNull
    }>()

export const refundSummariesQuery = createQuery((db) =>
  selectRefundSummaries(db)
)

export const refundSummariesByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    selectRefundSummaries(db).where("payment.billId", "=", billId)
  )

export const refundLinesByPaymentIdQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("refundLine")
      .innerJoin("paymentLine", "paymentLine.id", "refundLine.paymentLineId")
      .innerJoin("item", "item.id", "paymentLine.itemId")
      .select([
        "refundLine.id",
        "refundLine.refundId",
        "refundLine.paymentLineId",
        "refundLine.quantity",
        "refundLine.amount",
        "item.name",
      ])
      .where("refundLine.paymentId", "=", paymentId)
      .where("refundLine.isDeleted", "is not", sqliteTrue)
      .where("refundLine.refundId", "is not", null)
      .where("refundLine.paymentLineId", "is not", null)
      .where("refundLine.quantity", "is not", null)
      .where("refundLine.amount", "is not", null)
      .where("item.name", "is not", null)
      .$narrowType<{
        refundId: KyselyNotNull
        paymentLineId: KyselyNotNull
        quantity: KyselyNotNull
        amount: KyselyNotNull
        name: KyselyNotNull
      }>()
  )

export const refundablePaymentLinesQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentLine")
      .innerJoin("item", "item.id", "paymentLine.itemId")
      .select([
        "paymentLine.id",
        "paymentLine.type",
        "paymentLine.quantity",
        "paymentLine.totalAmount",
        "item.name",
      ])
      .where("paymentLine.paymentId", "=", paymentId)
      .where("paymentLine.isDeleted", "is not", sqliteTrue)
      .where("paymentLine.type", "is not", null)
      .where("paymentLine.quantity", "is not", null)
      .where("paymentLine.totalAmount", "is not", null)
      .where("item.name", "is not", null)
      .orderBy("item.name")
      .orderBy("paymentLine.id")
      .$narrowType<{
        type: KyselyNotNull
        quantity: KyselyNotNull
        totalAmount: KyselyNotNull
        name: KyselyNotNull
      }>()
  )

export const otherClaimedPaymentOfBillQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment as own")
      .innerJoin("payment as other", "other.billId", "own.billId")
      .innerJoin("reconciliationClaim", (join) =>
        join
          .onRef("reconciliationClaim.paymentId", "=", "other.id")
          .on("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      )
      .select(["other.id"])
      .where("own.id", "=", paymentId)
      .where("other.id", "!=", paymentId)
      .where("other.isDeleted", "is not", sqliteTrue)
      .limit(1)
  )

const qerkoRefundAttemptColumns = [
  "id",
  "paymentId",
  "deviceId",
  "transactionId",
  "terminalId",
  "amount",
  "isTip",
  "linesJson",
  "status",
  "failureReason",
  "startedAt",
] as const

type QerkoRefundAttemptRequiredColumns = {
  paymentId: KyselyNotNull
  transactionId: KyselyNotNull
  terminalId: KyselyNotNull
  amount: KyselyNotNull
  status: KyselyNotNull
  startedAt: KyselyNotNull
}

/** The refunds to the card of one payment that have not been written as refunds yet. */
export const qerkoTerminalRefundAttemptsByPaymentIdQuery = (
  paymentId: PaymentId
) =>
  createQuery((db) =>
    db
      .selectFrom("qerkoTerminalRefundAttempt")
      .select(qerkoRefundAttemptColumns)
      .where("paymentId", "=", paymentId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("transactionId", "is not", null)
      .where("terminalId", "is not", null)
      .where("amount", "is not", null)
      .where("status", "is not", null)
      .where("startedAt", "is not", null)
      .orderBy("startedAt", "desc")
      .orderBy("id")
      .$narrowType<QerkoRefundAttemptRequiredColumns>()
  )

export const qerkoTerminalRefundAttemptByIdQuery = (refundId: RefundId) =>
  createQuery((db) =>
    db
      .selectFrom("qerkoTerminalRefundAttempt")
      .select(qerkoRefundAttemptColumns)
      .where("id", "=", refundId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("paymentId", "is not", null)
      .where("transactionId", "is not", null)
      .where("terminalId", "is not", null)
      .where("amount", "is not", null)
      .where("status", "is not", null)
      .where("startedAt", "is not", null)
      .$narrowType<QerkoRefundAttemptRequiredColumns>()
  )

/** Every card refund the terminal is still working on, for the sync job. */
export const pendingQerkoTerminalRefundAttemptsQuery = createQuery((db) =>
  db
    .selectFrom("qerkoTerminalRefundAttempt")
    .select(["id", "transactionId"])
    .where("isDeleted", "is not", sqliteTrue)
    .where("status", "=", "pending")
    .where("transactionId", "is not", null)
    .$narrowType<{ transactionId: KyselyNotNull }>()
)

const cardSwitchioRefundAttemptColumns = [
  "id",
  "paymentId",
  "deviceId",
  "transactionId",
  "kind",
  "refundId",
  "amount",
  "tipAmount",
  "isTip",
  "linesJson",
  "status",
  "failureReason",
  "startedAt",
] as const

type CardSwitchioRefundAttemptRequiredColumns = {
  paymentId: KyselyNotNull
  deviceId: KyselyNotNull
  transactionId: KyselyNotNull
  kind: KyselyNotNull
  refundId: KyselyNotNull
  amount: KyselyNotNull
  status: KyselyNotNull
  startedAt: KyselyNotNull
}

/** The SwitchioPay refunds to the card of one payment not written as refunds yet, newest first. */
export const cardSwitchioRefundAttemptsByPaymentIdQuery = (
  paymentId: PaymentId
) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioRefundAttempt")
      .select(cardSwitchioRefundAttemptColumns)
      .where("paymentId", "=", paymentId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("deviceId", "is not", null)
      .where("transactionId", "is not", null)
      .where("kind", "is not", null)
      .where("refundId", "is not", null)
      .where("amount", "is not", null)
      .where("status", "is not", null)
      .where("startedAt", "is not", null)
      .orderBy("startedAt", "desc")
      .orderBy("id")
      .$narrowType<CardSwitchioRefundAttemptRequiredColumns>()
  )

export const cardSwitchioRefundAttemptByIdQuery = (
  attemptId: CardSwitchioRefundAttemptId
) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioRefundAttempt")
      .select(cardSwitchioRefundAttemptColumns)
      .where("id", "=", attemptId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("paymentId", "is not", null)
      .where("deviceId", "is not", null)
      .where("transactionId", "is not", null)
      .where("kind", "is not", null)
      .where("refundId", "is not", null)
      .where("amount", "is not", null)
      .where("status", "is not", null)
      .where("startedAt", "is not", null)
      .$narrowType<CardSwitchioRefundAttemptRequiredColumns>()
  )

/**
 * The attempt a SwitchioPay result belongs to, by the request id it echoes.
 * Taken-away attempts are included on purpose: staff may have dismissed an
 * attempt whose approved result only comes back later, and that money did
 * go back to the card (refund/0007).
 */
export const cardSwitchioRefundAttemptByTransactionIdQuery = (
  transactionId: NonEmptyString255
) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioRefundAttempt")
      .select(cardSwitchioRefundAttemptColumns)
      .where("transactionId", "=", transactionId)
      .where("paymentId", "is not", null)
      .where("deviceId", "is not", null)
      .where("kind", "is not", null)
      .where("refundId", "is not", null)
      .where("amount", "is not", null)
      .where("status", "is not", null)
      .where("startedAt", "is not", null)
      .$narrowType<CardSwitchioRefundAttemptRequiredColumns>()
  )

/** The attempts one phone launched whose outcome it has not settled yet. */
export const openCardSwitchioRefundAttemptsByDeviceIdQuery = (
  deviceId: DeviceId
) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioRefundAttempt")
      .select(["id", "transactionId", "status"])
      .where("deviceId", "=", deviceId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("status", "in", ["pending", "unknown"])
      .where("transactionId", "is not", null)
      .$narrowType<{ transactionId: KyselyNotNull; status: KyselyNotNull }>()
  )
