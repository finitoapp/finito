import {
  evoluJsonArrayFrom,
  type InferRow,
  type KyselyNotNull,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { NonEmptyString255, TimestampMs } from "../shared/schema.ts"
import type { TableId } from "../table/table-types.ts"
import type { SelfPayReference } from "./table-self-pay-reference-utils.ts"
import type { SelfPayViewPublicationId } from "./table-self-pay-types.ts"

export const selfPayTablesQuery = createQuery((db) =>
  db
    .selectFrom("table")
    .select(["id", "name", "selfPayEnabled", "selfPayEpoch"])
    .where("selfPayEnabled", "is not", null)
    .where("isDeleted", "is not", sqliteTrue)
    .where("name", "is not", null)
    .$narrowType<{ name: KyselyNotNull; selfPayEnabled: KyselyNotNull }>()
)

export type SelfPayTableRow = InferRow<typeof selfPayTablesQuery>

export const selfPayRelaysQuery = createQuery((db) =>
  db
    .selectFrom("selfPayRelay")
    .select(["url", "isActive"])
    .where("isDeleted", "is not", sqliteTrue)
    .where("url", "is not", null)
    .where("isActive", "is not", null)
    .orderBy("createdAt")
    .$narrowType<{ url: KyselyNotNull; isActive: KyselyNotNull }>()
)

export const selfPayViewPublicationByIdQuery = (id: SelfPayViewPublicationId) =>
  createQuery((db) =>
    db
      .selectFrom("selfPayViewPublication")
      .select("eventCreatedAt")
      .where("id", "=", id)
      .where("isDeleted", "is not", sqliteTrue)
      .where("eventCreatedAt", "is not", null)
      .$narrowType<{ eventCreatedAt: KyselyNotNull }>()
  )

export const selfPayPublishResultsQuery = createQuery((db) =>
  db
    .selectFrom("selfPayViewPublication")
    .select(["tag", "lastPublishJson"])
    .where("isDeleted", "is not", sqliteTrue)
    .where("tag", "is not", null)
    .where("lastPublishJson", "is not", null)
    .$narrowType<{ tag: KyselyNotNull; lastPublishJson: KyselyNotNull }>()
)

export const selfPayPublishResultsByTagQuery = (tag: NonEmptyString255) =>
  createQuery((db) =>
    db
      .selectFrom("selfPayViewPublication")
      .select("lastPublishJson")
      .where("tag", "=", tag)
      .where("isDeleted", "is not", sqliteTrue)
      .where("lastPublishJson", "is not", null)
      .$narrowType<{ lastPublishJson: KyselyNotNull }>()
  )

export const openBillIdsQuery = createQuery((db) =>
  db
    .selectFrom("bill")
    .select(["id", "createdAt"])
    .where("canceledAt", "is", null)
    .where("closedAt", "is", null)
    .where("isDeleted", "is not", sqliteTrue)
)

export const tableSelfPayBillsQuery = (tableId: TableId) =>
  createQuery((db) =>
    db
      .selectFrom("bill")
      .select(["bill.id", "bill.deviceId", "bill.currency", "bill.createdAt"])
      .select((eb) => [
        eb
          .selectFrom("billSelfPayReference")
          .select("billSelfPayReference.reference")
          .whereRef("billSelfPayReference.id", "=", "bill.id")
          .where("billSelfPayReference.isDeleted", "is not", sqliteTrue)
          .as("reference"),
        evoluJsonArrayFrom(
          eb
            .selectFrom("billLine")
            .select([
              "billLine.id",
              "billLine.billId",
              "billLine.deviceId",
              "billLine.catalogItemId",
              "billLine.itemId",
              "billLine.type",
              "billLine.kind",
              "billLine.quantity",
              "billLine.totalAmount",
              "billLine.createdAt",
              "billLine.updatedAt",
              "billLine.isDeleted",
              "billLine.ownerId",
            ])
            .whereRef("billLine.billId", "=", "bill.id")
            .where("billLine.billId", "is not", null)
            .where("billLine.itemId", "is not", null)
            .where("billLine.type", "is not", null)
            .where("billLine.kind", "is not", null)
            .where("billLine.quantity", "is not", null)
            .where("billLine.totalAmount", "is not", null)
            .orderBy("billLine.createdAt", "asc")
            .orderBy("billLine.ownerId", "asc")
            .orderBy("billLine.id", "asc")
            .$narrowType<{
              billId: KyselyNotNull
              itemId: KyselyNotNull
              type: KyselyNotNull
              kind: KyselyNotNull
              quantity: KyselyNotNull
              totalAmount: KyselyNotNull
            }>()
        ).as("lines"),
        evoluJsonArrayFrom(
          eb
            .selectFrom("item")
            .innerJoin("billLine as itemLine", "itemLine.itemId", "item.id")
            .select([
              "item.id",
              "item.catalogItemId",
              "item.name",
              "item.description",
              "item.currency",
              "item.unitAmount",
              "item.taxRateId",
              "item.createdAt",
              "item.updatedAt",
              "item.isDeleted",
              "item.ownerId",
            ])
            .distinct()
            .whereRef("itemLine.billId", "=", "bill.id")
            .where("item.name", "is not", null)
            .where("item.currency", "is not", null)
            .where("item.unitAmount", "is not", null)
            .$narrowType<{
              name: KyselyNotNull
              currency: KyselyNotNull
              unitAmount: KyselyNotNull
            }>()
        ).as("items"),
        evoluJsonArrayFrom(
          eb
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
              "payment.id as paymentId",
              "payment.tipAmount",
              "payment.amount as paymentAmount",
              "payment.currency as paymentCurrency",
              "paymentBtc.amountSats as paymentAmountSats",
              "reconciliationClaim.accountTransactionId",
              "accountTransaction.amount",
              "accountTransaction.currency",
            ])
            .whereRef("payment.billId", "=", "bill.id")
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
        ).as("claimedTransactions"),
        evoluJsonArrayFrom(
          eb
            .selectFrom("selfPayAllocation")
            .select(["selfPayAllocation.lineKey", "selfPayAllocation.amount"])
            .whereRef("selfPayAllocation.billId", "=", "bill.id")
            .where("selfPayAllocation.isDeleted", "is not", sqliteTrue)
            .where("selfPayAllocation.lineKey", "is not", null)
            .where("selfPayAllocation.amount", "is not", null)
            .$narrowType<{ lineKey: KyselyNotNull; amount: KyselyNotNull }>()
        ).as("allocations"),
      ])
      .where("bill.tableId", "=", tableId)
      .where("bill.canceledAt", "is", null)
      .where("bill.closedAt", "is", null)
      .where("bill.isDeleted", "is not", sqliteTrue)
      .where("bill.currency", "is not", null)
      .where("bill.createdAt", "is not", null)
      .$narrowType<{ currency: KyselyNotNull; createdAt: KyselyNotNull }>()
      .orderBy("bill.createdAt", "asc")
  )

export type TableSelfPayBillRow = InferRow<
  ReturnType<typeof tableSelfPayBillsQuery>
>

export const tableSelfPayConfirmationsQuery = (
  tableId: TableId,
  endedAfter: TimestampMs
) =>
  createQuery((db) =>
    db
      .selectFrom("paymentSelfPay")
      .innerJoin("payment", "payment.id", "paymentSelfPay.id")
      .innerJoin("bill", "bill.id", "payment.billId")
      .innerJoin("reconciliationClaim", (join) =>
        join
          .onRef("reconciliationClaim.paymentId", "=", "payment.id")
          .on("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "payment.billId",
        "paymentSelfPay.pointer",
        "payment.amount",
        "payment.currency",
        "reconciliationClaim.claimedAt",
        "bill.closedAt",
        "bill.canceledAt",
      ])
      .where("bill.tableId", "=", tableId)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("menuOrder")
              .select("menuOrder.id")
              .whereRef("menuOrder.billId", "=", "bill.id")
              .where("menuOrder.isDeleted", "is not", sqliteTrue)
          )
        )
      )
      .where((eb) =>
        eb.or([
          eb("bill.closedAt", "is", null),
          eb("bill.closedAt", ">=", endedAfter),
        ])
      )
      .where((eb) =>
        eb.or([
          eb("bill.canceledAt", "is", null),
          eb("bill.canceledAt", ">=", endedAfter),
        ])
      )
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("paymentSelfPay.pointer", "is not", null)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("reconciliationClaim.claimedAt", "is not", null)
      .$narrowType<{
        pointer: KyselyNotNull
        amount: KyselyNotNull
        currency: KyselyNotNull
        claimedAt: KyselyNotNull
      }>()
      .orderBy("reconciliationClaim.claimedAt", "desc")
      .orderBy("paymentSelfPay.pointer", "asc")
  )

export type TableSelfPayConfirmationRow = InferRow<
  ReturnType<typeof tableSelfPayConfirmationsQuery>
>

export const tableSelfPayVersionQuery = (tableId: TableId) =>
  createQuery((db) =>
    db
      .selectFrom((eb) =>
        eb
          .selectFrom("table")
          .select([
            "table.createdAt as createdAt",
            "table.updatedAt as updatedAt",
          ])
          .where("table.id", "=", tableId)
          .unionAll(
            eb
              .selectFrom("bill")
              .select([
                "bill.createdAt as createdAt",
                "bill.updatedAt as updatedAt",
              ])
              .where("bill.tableId", "=", tableId)
          )
          .unionAll(
            eb
              .selectFrom("billLine")
              .innerJoin("bill", "bill.id", "billLine.billId")
              .select([
                "billLine.createdAt as createdAt",
                "billLine.updatedAt as updatedAt",
              ])
              .where("bill.tableId", "=", tableId)
          )
          .unionAll(
            eb
              .selectFrom("payment")
              .innerJoin("bill", "bill.id", "payment.billId")
              .select([
                "payment.createdAt as createdAt",
                "payment.updatedAt as updatedAt",
              ])
              .where("bill.tableId", "=", tableId)
          )
          .unionAll(
            eb
              .selectFrom("reconciliationClaim")
              .innerJoin(
                "payment",
                "payment.id",
                "reconciliationClaim.paymentId"
              )
              .innerJoin("bill", "bill.id", "payment.billId")
              .select([
                "reconciliationClaim.createdAt as createdAt",
                "reconciliationClaim.updatedAt as updatedAt",
              ])
              .where("bill.tableId", "=", tableId)
          )
          .unionAll(
            eb
              .selectFrom("selfPayAllocation")
              .innerJoin("bill", "bill.id", "selfPayAllocation.billId")
              .select([
                "selfPayAllocation.createdAt as createdAt",
                "selfPayAllocation.updatedAt as updatedAt",
              ])
              .where("bill.tableId", "=", tableId)
          )
          .unionAll(
            eb
              .selectFrom("billSelfPayReference")
              .innerJoin("bill", "bill.id", "billSelfPayReference.id")
              .select([
                "billSelfPayReference.createdAt as createdAt",
                "billSelfPayReference.updatedAt as updatedAt",
              ])
              .where("bill.tableId", "=", tableId)
          )
          .unionAll(
            eb
              .selectFrom("account")
              .select([
                "account.createdAt as createdAt",
                "account.updatedAt as updatedAt",
              ])
          )
          .unionAll(
            eb
              .selectFrom("accountIban")
              .select([
                "accountIban.createdAt as createdAt",
                "accountIban.updatedAt as updatedAt",
              ])
          )
          .unionAll(
            eb
              .selectFrom("accountSpark")
              .select([
                "accountSpark.createdAt as createdAt",
                "accountSpark.updatedAt as updatedAt",
              ])
          )
          .unionAll(
            eb
              .selectFrom("fioPlugin")
              .select([
                "fioPlugin.createdAt as createdAt",
                "fioPlugin.updatedAt as updatedAt",
              ])
          )
          .unionAll(
            eb
              .selectFrom("monetaPlugin")
              .select([
                "monetaPlugin.createdAt as createdAt",
                "monetaPlugin.updatedAt as updatedAt",
              ])
          )
          .unionAll(
            eb
              .selectFrom("appSettings")
              .select([
                "appSettings.createdAt as createdAt",
                "appSettings.updatedAt as updatedAt",
              ])
          )
          .as("changes")
      )
      .select((eb) => [
        eb.fn.max("changes.createdAt").as("createdAt"),
        eb.fn.max("changes.updatedAt").as("updatedAt"),
      ])
  )

export const billIdsBySelfPayReferenceQuery = (
  reference: SelfPayReference,
  endedAfter: TimestampMs
) =>
  createQuery((db) =>
    db
      .selectFrom("billSelfPayReference")
      .innerJoin("bill", "bill.id", "billSelfPayReference.id")
      .select("billSelfPayReference.id")
      .where("billSelfPayReference.reference", "=", reference)
      .where("billSelfPayReference.isDeleted", "is not", sqliteTrue)
      .where((eb) =>
        eb.or([
          eb("bill.closedAt", "is", null),
          eb("bill.closedAt", ">=", endedAfter),
        ])
      )
      .where((eb) =>
        eb.or([
          eb("bill.canceledAt", "is", null),
          eb("bill.canceledAt", ">=", endedAfter),
        ])
      )
  )

export const selfPayAllocationsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("selfPayAllocation")
      .select(["paymentId", "lineKey", "amount"])
      .where("billId", "=", billId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("paymentId", "is not", null)
      .where("lineKey", "is not", null)
      .where("amount", "is not", null)
      .$narrowType<{
        paymentId: KyselyNotNull
        lineKey: KyselyNotNull
        amount: KyselyNotNull
      }>()
  )

export const tableSelfPayViewVersionIdsQuery = (tableId: TableId) =>
  createQuery((db) =>
    db
      .selectFrom("selfPayViewVersion")
      .innerJoin("bill", "bill.id", "selfPayViewVersion.billId")
      .select("selfPayViewVersion.id")
      .where("bill.tableId", "=", tableId)
      .where("selfPayViewVersion.isDeleted", "is not", sqliteTrue)
  )

export const selfPayViewVersionsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("selfPayViewVersion")
      .select(["id", "content"])
      .where("billId", "=", billId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("content", "is not", null)
      .$narrowType<{ content: KyselyNotNull }>()
  )

export const expiredSelfPayViewVersionsQuery = (endedBefore: TimestampMs) =>
  createQuery((db) =>
    db
      .selectFrom("selfPayViewVersion")
      .innerJoin("bill", "bill.id", "selfPayViewVersion.billId")
      .select("selfPayViewVersion.id")
      .where("selfPayViewVersion.isDeleted", "is not", sqliteTrue)
      .where((eb) =>
        eb.or([
          eb("bill.closedAt", "<", endedBefore),
          eb("bill.canceledAt", "<", endedBefore),
        ])
      )
  )
