import type { KyselyNotNull } from "@evolu/common"
import { sqliteTrue } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type { BillId, OverpaymentScopes } from "./bill-types.ts"

/**
 * Every payment for a bill that has an active reconciliation claim — money
 * that has actually arrived — regardless of that payment's own
 * canceled/expired display status (see `derivePaymentStatus`). A payment can
 * appear more than once here if it carries more than one active claim.
 *
 * This only tells you *which* payments carry a claim, for display: the bill
 * page and the payment detail list them. It is the looser reading — a claim
 * counts even when its transaction is gone — so the pending-payment lock
 * (`claimedPaymentIdSet`) and coverage math deliberately read
 * `claimedTransactionsByBillIdQuery` instead; see `claimedPaymentIdSet`'s
 * doc comment and docs/bill-payment-states.md.
 */
export const claimedPaymentsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .innerJoin("reconciliationClaim", (join) =>
        join
          .onRef("reconciliationClaim.paymentId", "=", "payment.id")
          .on("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      )
      .select(["payment.id", "payment.amount", "payment.tipAmount"])
      .where("payment.billId", "=", billId)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        tipAmount: KyselyNotNull
      }>()
  )

/**
 * Every distinct account transaction actively claimed against a payment of
 * a bill, one row per claim — the basis for `calculateClaimedSum`, which
 * dedupes by transaction id and sums per payment (minus tip, once per
 * payment). Unlike `claimedPaymentsByBillIdQuery`, this carries the real
 * transaction `amount` rather than the payment's nominal one, so it stays
 * correct when a payment ends up claimed for more (or, mid-split, less)
 * than its own amount.
 *
 * `accountTransaction.amount` is in the transaction's own currency, which
 * for a Lightning/Spark settlement is satoshis against a fiat payment, so
 * the payment's `amount`/`currency` and its `paymentBtc.amountSats` come
 * along as the rate `calculateClaimedSum` converts with. See
 * docs/bill-payment-states.md.
 */
export const claimedTransactionsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .innerJoin("reconciliationClaim", (join) =>
        join
          .onRef("reconciliationClaim.paymentId", "=", "payment.id")
          .on("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      )
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
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
      .select([
        "payment.id as paymentId",
        "payment.tipAmount",
        "payment.amount as paymentAmount",
        "payment.currency as paymentCurrency",
        quotedAmountSatsSql({
          kind: "accountTransaction.kind",
          btc: "paymentBtc.amountSats",
          cashu: "paymentCashu.amountSats",
          lightningAddress: "paymentLightningAddress.amountSats",
        }).as("paymentAmountSats"),
        "reconciliationClaim.accountTransactionId",
        "accountTransaction.amount",
        "accountTransaction.currency",
      ])
      .where("payment.billId", "=", billId)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.tipAmount", "is not", null)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("reconciliationClaim.accountTransactionId", "is not", null)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.currency", "is not", null)
      .$narrowType<{
        tipAmount: KyselyNotNull
        paymentAmount: KyselyNotNull
        paymentCurrency: KyselyNotNull
        accountTransactionId: KyselyNotNull
        amount: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

/**
 * Every non-deleted payment for a bill, with just the fields needed to
 * derive its display status (`derivePaymentStatus`) — used to determine
 * whether the bill currently has a live (pending) payment locking it for
 * edits. See docs/bill-payment-states.md.
 */
export const paymentsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .select(["payment.id", "payment.canceledAt", "payment.expiresAt"])
      .where("payment.billId", "=", billId)
      .where("payment.isDeleted", "is not", sqliteTrue)
  )

export const overpaymentPaymentsQuery = (scopes: OverpaymentScopes) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .leftJoin("paymentCashRegister", (join) =>
        join
          .onRef("paymentCashRegister.id", "=", "payment.id")
          .on("paymentCashRegister.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "payment.id",
        "payment.billId",
        "payment.amount",
        "payment.tipAmount",
        "payment.currency",
        "payment.excessAcknowledgedAt",
        "paymentCashRegister.receivedAmount as cashReceivedAmount",
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
      .where("payment.amount", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .where("payment.currency", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        tipAmount: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

export const overpaymentTransactionsQuery = (scopes: OverpaymentScopes) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .innerJoin("reconciliationClaim", (join) =>
        join
          .onRef("reconciliationClaim.paymentId", "=", "payment.id")
          .on("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      )
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .leftJoin("paymentBtc", (join) =>
        join
          .onRef("paymentBtc.id", "=", "payment.id")
          .on("paymentBtc.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "reconciliationClaim.id as claimId",
        "payment.id as paymentId",
        "payment.billId as billId",
        "payment.amount as paymentAmount",
        "payment.currency as paymentCurrency",
        "paymentBtc.amountSats as paymentAmountSats",
        "reconciliationClaim.accountTransactionId",
        "accountTransaction.amount",
        "accountTransaction.currency",
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
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("reconciliationClaim.accountTransactionId", "is not", null)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.currency", "is not", null)
      .$narrowType<{
        paymentAmount: KyselyNotNull
        paymentCurrency: KyselyNotNull
        accountTransactionId: KyselyNotNull
        amount: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )
