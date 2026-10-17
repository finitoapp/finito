import {
  createIdFromString,
  type KyselyNotNull,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { BillLineId } from "../bill-line/bill-line-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { ReconciliationClaimId } from "../reconciliation-claim/reconciliation-claim-types.ts"
import type { BillId } from "./bill-types.ts"

export const billClosingCursorId = createIdFromString<"BillClosingCursor">(
  "bill-closing-cursor"
)

export const billClosingCursorQuery = createQuery((db) =>
  db
    .selectFrom("_billClosingCursor")
    .select(["historyRowid"])
    .where("id", "=", billClosingCursorId)
)

export const openListedBillIdsQuery = createQuery((db) =>
  db
    .selectFrom("bill")
    .select(["bill.id"])
    .where("bill.canceledAt", "is", null)
    .where("bill.closedAt", "is", null)
    .where("bill.isDeleted", "is not", sqliteTrue)
)

export const closedBillIdsWithRemovedMoneyQuery = createQuery((db) =>
  db
    .selectFrom("bill")
    .select(["bill.id"])
    .where("bill.canceledAt", "is", null)
    .where("bill.closedAt", "is not", null)
    .where("bill.isDeleted", "is not", sqliteTrue)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("reconciliationClaim")
          .innerJoin("payment", "payment.id", "reconciliationClaim.paymentId")
          .leftJoin(
            "accountTransaction",
            "accountTransaction.id",
            "reconciliationClaim.accountTransactionId"
          )
          .select("reconciliationClaim.id")
          .whereRef("payment.billId", "=", "bill.id")
          .where((removed) =>
            removed.or([
              removed("reconciliationClaim.isDeleted", "=", sqliteTrue),
              removed("accountTransaction.isDeleted", "=", sqliteTrue),
            ])
          )
      )
    )
)

export const billIdsOfBillLinesQuery = (ids: ReadonlyArray<BillLineId>) =>
  createQuery((db) =>
    db
      .selectFrom("billLine")
      .select(["billLine.billId"])
      .distinct()
      .where("billLine.id", "in", ids)
      .where("billLine.billId", "is not", null)
      .$narrowType<{ billId: KyselyNotNull }>()
  )

export const billIdsOfPaymentsQuery = (ids: ReadonlyArray<PaymentId>) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .select(["payment.billId"])
      .distinct()
      .where("payment.id", "in", ids)
      .where("payment.billId", "is not", null)
      .$narrowType<{ billId: KyselyNotNull }>()
  )

export const billIdsOfClaimsQuery = (
  ids: ReadonlyArray<ReconciliationClaimId>
) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin("payment", "payment.id", "reconciliationClaim.paymentId")
      .select(["payment.billId"])
      .distinct()
      .where("reconciliationClaim.id", "in", ids)
      .where("payment.billId", "is not", null)
      .$narrowType<{ billId: KyselyNotNull }>()
  )

export const billIdsOfTransactionsQuery = (
  ids: ReadonlyArray<AccountTransactionId>
) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin("payment", "payment.id", "reconciliationClaim.paymentId")
      .select(["payment.billId"])
      .distinct()
      .where("reconciliationClaim.accountTransactionId", "in", ids)
      .where("payment.billId", "is not", null)
      .$narrowType<{ billId: KyselyNotNull }>()
  )

export const closingClaimsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin("payment", "payment.id", "reconciliationClaim.paymentId")
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
        "reconciliationClaim.isDeleted as isClaimDeleted",
        "accountTransaction.isDeleted as isTransactionDeleted",
        "payment.id as paymentId",
        "payment.tipAmount",
        "payment.amount as paymentAmount",
        "payment.currency as paymentCurrency",
        "paymentBtc.amountSats as paymentAmountSats",
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
