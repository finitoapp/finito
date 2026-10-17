import {
  evoluJsonArrayFrom,
  type KyselyNotNull,
  kyselySql,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { BillId, OverpaymentScopes } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
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
  "refund.overpaymentAmount",
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
      .select([
        ...refundColumns.filter((column) => column !== "refund.amount"),
        kyselySql<NonNegativeInteger>`"refund"."amount" + coalesce((select sum("withoutDevice"."amount") from "refund" as "withoutDevice" where "withoutDevice"."mainRefundId" = "refund"."id" and "withoutDevice"."isDeleted" is not ${sqliteTrue}), 0)`.as(
          "amount"
        ),
      ])
      .where("refund.paymentId", "=", paymentId)
      .where("refund.mainRefundId", "is", null)
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

/**
 * One refund for its detail screen: the refund with the cash a refund from
 * the register handed out (`refundCashRegister`), the name of the device
 * that recorded it, and what the card terminal answered
 * (`refundCardSwitchio`, `refundQerkoTerminal`). A refund written before any
 * of those rows existed reads them as `null`.
 */
export const refundByIdQuery = (refundId: RefundId) =>
  createQuery((db) =>
    db
      .selectFrom("refund")
      .leftJoin("refundCashRegister", (join) =>
        join
          .onRef("refundCashRegister.id", "=", "refund.id")
          .on("refundCashRegister.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("device", (join) =>
        join
          .onRef("device.id", "=", "refund.deviceId")
          .on("device.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("refundCardSwitchio", (join) =>
        join
          .onRef("refundCardSwitchio.id", "=", "refund.id")
          .on("refundCardSwitchio.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("refundQerkoTerminal", (join) =>
        join
          .onRef("refundQerkoTerminal.id", "=", "refund.id")
          .on("refundQerkoTerminal.isDeleted", "is not", sqliteTrue)
      )
      .select([
        ...refundColumns,
        "refundCashRegister.handedAmount as cashHandedAmount",
        "refundCashRegister.accountId as cashAccountId",
        "device.name as deviceName",
        "refundCardSwitchio.accountId as cardSwitchioAccountId",
        "refundCardSwitchio.transactionId as cardSwitchioTransactionId",
        "refundCardSwitchio.kind as cardSwitchioKind",
        "refundCardSwitchio.authCode as cardSwitchioAuthCode",
        "refundCardSwitchio.sequenceNumber as cardSwitchioSequenceNumber",
        "refundQerkoTerminal.accountId as qerkoTerminalAccountId",
        "refundQerkoTerminal.transactionId as qerkoTerminalTransactionId",
        "refundQerkoTerminal.terminalId as qerkoTerminalTerminalId",
      ])
      .where("refund.id", "=", refundId)
      .where("refund.isDeleted", "is not", sqliteTrue)
      .where("refund.paymentId", "is not", null)
      .where("refund.amount", "is not", null)
      .where("refund.currency", "is not", null)
      .where("refund.method", "is not", null)
      .where("refund.refundedAt", "is not", null)
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
      "refund.overpaymentAmount",
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

const selectRefundLines = (
  db: Parameters<Parameters<typeof createQuery>[0]>[0]
) =>
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

export const refundLinesByPaymentIdQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    selectRefundLines(db).where("refundLine.paymentId", "=", paymentId)
  )

/** The goods lines of one refund, named by their item, for its detail screen. */
export const refundLinesByRefundIdQuery = (refundId: RefundId) =>
  createQuery((db) =>
    selectRefundLines(db)
      .where("refundLine.refundId", "=", refundId)
      .orderBy("item.name")
      .orderBy("refundLine.id")
  )

export const refundablePaymentLinesQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentLine")
      .innerJoin("item", "item.id", "paymentLine.itemId")
      .select([
        "paymentLine.id",
        "paymentLine.billId",
        "paymentLine.catalogItemId",
        "paymentLine.itemId",
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
  "tipAmount",
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

/**
 * Refunds of a whole payment to the card through Qerko whose goods were
 * written but whose tip was not: an older version settled the attempt
 * without knowing its `tipAmount`. The attempt is taken away once settled,
 * so it is read here in that state, and only beside its goods' refund, which
 * is what tells a settled attempt from a dismissed one.
 */
export const qerkoTerminalRefundsMissingTipQuery = createQuery((db) =>
  db
    .selectFrom("qerkoTerminalRefundAttempt as attempt")
    .innerJoin("refund as goods", (join) =>
      join
        .onRef("goods.id", "=", "attempt.id")
        .on("goods.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("refund as tip", (join) =>
      join
        .onRef("tip.paymentId", "=", "attempt.paymentId")
        .on("tip.isTip", "=", sqliteTrue)
        .on("tip.isDeleted", "is not", sqliteTrue)
    )
    .select([
      "attempt.id",
      "attempt.paymentId",
      "attempt.deviceId",
      "attempt.transactionId",
      "attempt.terminalId",
      "attempt.tipAmount",
      "goods.currency",
      "goods.refundedAt",
    ])
    .where("attempt.isDeleted", "=", sqliteTrue)
    .where("attempt.isTip", "is", null)
    .where("attempt.tipAmount", "is not", null)
    .where("attempt.paymentId", "is not", null)
    .where("attempt.transactionId", "is not", null)
    .where("attempt.terminalId", "is not", null)
    .where("goods.currency", "is not", null)
    .where("goods.refundedAt", "is not", null)
    .where("tip.id", "is", null)
    .$narrowType<{
      paymentId: KyselyNotNull
      transactionId: KyselyNotNull
      terminalId: KyselyNotNull
      tipAmount: KyselyNotNull
      currency: KyselyNotNull
      refundedAt: KyselyNotNull
    }>()
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

export const overpaymentRefundsQuery = (scopes: OverpaymentScopes) =>
  createQuery((db) =>
    db
      .selectFrom("refund")
      .innerJoin("payment", "payment.id", "refund.paymentId")
      .select([
        "refund.id",
        "refund.paymentId",
        "payment.billId as billId",
        "refund.deviceId",
        "refund.amount",
        "refund.isTip",
        "refund.purpose",
        "refund.overpaymentAmount",
        "refund.knownTransactionIdsJson",
        "refund.mainRefundId",
      ])
      .where((eb) =>
        eb.or([
          ...(scopes.billIds.length === 0
            ? []
            : [eb("payment.billId", "in", scopes.billIds)]),
          ...(scopes.paymentIds.length === 0
            ? []
            : [eb("payment.id", "in", scopes.paymentIds)]),
        ])
      )
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("refund.isDeleted", "is not", sqliteTrue)
      .where("refund.paymentId", "is not", null)
      .where("refund.amount", "is not", null)
      .$narrowType<{ paymentId: KyselyNotNull; amount: KyselyNotNull }>()
  )
