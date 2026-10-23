import type { DateIso, KyselyNotNull } from "@evolu/common"
import { sqliteTrue } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { AccountId } from "../account/account-types.ts"
import type { CashuOperationId } from "../cashu/cashu-types.ts"
import {
  Integer,
  type NonEmptyString,
  type NonEmptyString255,
} from "../shared/schema.ts"
import type { AccountTransactionId } from "./account-transaction-types.ts"

export const accountTransactionSparkByTransferIdQuery = (
  sparkTransferId: NonEmptyString
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransactionSpark")
      .selectAll()
      .where("sparkTransferId", "=", sparkTransferId)
      .where("sparkTransferId", "is not", null)
      .$narrowType<{
        sparkTransferId: KyselyNotNull
      }>()
  )

/**
 * The money on one account transaction: what it was for, and in which
 * currency. Read by the manual-claim path, which is handed only a
 * transaction id but has to tell bill coverage what that claim is worth —
 * a satoshi settlement and a koruna one are not the same number. The sync
 * jobs pass the row they just computed instead of reading it back.
 */
export const accountTransactionAmountByIdQuery = (id: AccountTransactionId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .select([
        "accountTransaction.kind",
        "accountTransaction.amount",
        "accountTransaction.currency",
      ])
      .where("accountTransaction.id", "=", id)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.currency", "is not", null)
      .where("accountTransaction.kind", "is not", null)
      .$narrowType<{
        kind: KyselyNotNull
        amount: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

/**
 * One account's latest transactions, newest first, for the read-only list
 * the withdrawal history points to for withdrawals made before it existed.
 */
// ponytail: fixed page of 200, page with useInfiniteEvoluQuery if accounts outgrow it
export const accountTransactionsByAccountQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .select([
        "accountTransaction.id",
        "accountTransaction.kind",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "accountTransaction.occurredAt",
        "accountTransaction.note",
      ])
      .where("accountTransaction.accountId", "=", accountId)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.occurredAt", "is not", null)
      .where("accountTransaction.kind", "is not", null)
      .orderBy("accountTransaction.occurredAt", "desc")
      .limit(200)
      .$narrowType<{
        kind: KyselyNotNull
        amount: KyselyNotNull
        occurredAt: KyselyNotNull
      }>()
  )

/** Whether an account transaction exists, deleted or not. */
export const accountTransactionExistsQuery = (id: AccountTransactionId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .select(["accountTransaction.id"])
      .where("accountTransaction.id", "=", id)
  )

/** Which of these Cashu operations already have their movement booked. */
export const bookedCashuOperationIdsQuery = (
  cashuOperationIds: ReadonlyArray<CashuOperationId>
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransactionCashu")
      .select(["cashuOperationId"])
      .where(
        "cashuOperationId",
        "in",
        cashuOperationIds.length === 0 ? [null] : cashuOperationIds
      )
      .where("isDeleted", "is not", sqliteTrue)
  )

/**
 * The account's IBAN transactions already recorded under one of
 * `bankReferences` — what a bank sync checks a downloaded statement against,
 * so a transfer is recorded once however often its window is read again.
 * `isClaimed` says whether a payment already holds it, so the sync re-checks
 * only the unclaimed ones for a payment that may have arrived since.
 */
export const ibanTransactionsByBankReferenceQuery = ({
  accountId,
  bankReferences,
}: {
  readonly accountId: AccountId
  readonly bankReferences: ReadonlyArray<NonEmptyString255>
}) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransactionIban")
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "accountTransactionIban.id"
      )
      .select((eb) => [
        "accountTransactionIban.bankReference",
        "accountTransactionIban.id as accountTransactionId",
        eb
          .exists(
            eb
              .selectFrom("reconciliationClaim")
              .select("reconciliationClaim.id")
              .whereRef(
                "reconciliationClaim.accountTransactionId",
                "=",
                "accountTransactionIban.id"
              )
              .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
          )
          .$castTo<0 | 1>()
          .as("isClaimed"),
      ])
      .where("accountTransaction.accountId", "=", accountId)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransactionIban.isDeleted", "is not", sqliteTrue)
      .where("accountTransactionIban.bankReference", "in", bankReferences)
      .where("accountTransactionIban.bankReference", "is not", null)
      .$narrowType<{
        bankReference: KyselyNotNull
      }>()
  )

export const selfPayTransactionByIdQuery = (id: AccountTransactionId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .leftJoin("accountTransactionIban", (join) =>
        join
          .onRef("accountTransactionIban.id", "=", "accountTransaction.id")
          .on("accountTransactionIban.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("accountTransactionLightning", (join) =>
        join
          .onRef("accountTransactionLightning.id", "=", "accountTransaction.id")
          .on("accountTransactionLightning.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "accountTransaction.id",
        "accountTransaction.kind",
        "accountTransaction.accountId",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "accountTransaction.occurredAt",
        "accountTransaction.createdAt",
        "accountTransactionIban.variableSymbol",
        "accountTransactionIban.recipientMessage",
        "accountTransactionLightning.lnInvoice",
        "accountTransactionLightning.paymentHash",
      ])
      .where("accountTransaction.id", "=", id)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.kind", "is not", null)
      .where("accountTransaction.accountId", "is not", null)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.currency", "is not", null)
      .where("accountTransaction.occurredAt", "is not", null)
      .$narrowType<{
        kind: KyselyNotNull
        accountId: KyselyNotNull
        amount: KyselyNotNull
        currency: KyselyNotNull
        occurredAt: KyselyNotNull
      }>()
  )

export const unclaimedIncomingTransactionsSinceQuery = (
  createdSince: DateIso
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .leftJoin("accountTransactionIban", (join) =>
        join
          .onRef("accountTransactionIban.id", "=", "accountTransaction.id")
          .on("accountTransactionIban.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("accountTransactionLightning", (join) =>
        join
          .onRef("accountTransactionLightning.id", "=", "accountTransaction.id")
          .on("accountTransactionLightning.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "accountTransaction.id",
        "accountTransaction.createdAt",
        "accountTransactionIban.recipientMessage",
        "accountTransactionLightning.lnInvoice",
      ])
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.amount", ">", Integer(0))
      .where("accountTransaction.createdAt", ">=", createdSince)
      .where((eb) =>
        eb.or([
          eb("accountTransactionIban.recipientMessage", "is not", null),
          eb("accountTransactionLightning.lnInvoice", "is not", null),
        ])
      )
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("reconciliationClaim")
              .select("reconciliationClaim.id")
              .whereRef(
                "reconciliationClaim.accountTransactionId",
                "=",
                "accountTransaction.id"
              )
              .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
          )
        )
      )
  )
