import { type DateIso, type KyselyNotNull, sqliteTrue } from "@evolu/common"
import { sql } from "kysely"

import { createQuery } from "../../evolu/schema.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DateString, TimestampMs } from "../shared/schema.ts"
import type { SelfPayPointer } from "../table-self-pay/table-self-pay-reference-utils.ts"
import type { MenuVersionId } from "./menu-order-types.ts"

export const menuVersionByIdQuery = (id: MenuVersionId) =>
  createQuery((db) =>
    db
      .selectFrom("menuVersion")
      .select(["id", "content"])
      .where("id", "=", id)
      .where("isDeleted", "is not", sqliteTrue)
      .where("content", "is not", null)
      .$narrowType<{ content: KyselyNotNull }>()
  )

export const menuVersionsNewestFirstQuery = createQuery((db) =>
  db
    .selectFrom("menuVersion")
    .select([
      "id",
      sql<string>`coalesce("updatedAt", "createdAt")`.as("onOfferAt"),
    ])
    .where("isDeleted", "is not", sqliteTrue)
    .orderBy("onOfferAt", "desc")
)

export const lastMenuOrderNumberQuery = (day: DateString) =>
  createQuery((db) =>
    db
      .selectFrom("menuOrder")
      .select("number")
      .where("day", "=", day)
      .where("isDeleted", "is not", sqliteTrue)
      .where("number", "is not", null)
      .$narrowType<{ number: KyselyNotNull }>()
      .orderBy("number", "desc")
      .limit(1)
  )

export const menuOrderByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("menuOrder")
      .select(["id", "pointer", "writtenAmount", "acceptedAt", "rejectedAt"])
      .where("billId", "=", billId)
      .where("isDeleted", "is not", sqliteTrue)
  )

export const rejectedMenuOrdersByPointerQuery = (
  pointers: ReadonlyArray<SelfPayPointer>
) =>
  createQuery((db) =>
    db
      .selectFrom("menuOrder")
      .select(["pointer", "number"])
      .where("pointer", "in", pointers)
      .where("rejectedAt", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{ pointer: KyselyNotNull; number: KyselyNotNull }>()
  )

type QueryDb = Parameters<Parameters<typeof createQuery>[0]>[0]

const selectListedMenuOrders = (db: QueryDb) =>
  db
    .selectFrom("menuOrder")
    .innerJoin("bill", "bill.id", "menuOrder.billId")
    .select([
      "menuOrder.id",
      "menuOrder.billId",
      "menuOrder.pointer",
      "menuOrder.number",
      "menuOrder.note",
      "menuOrder.writtenAmount",
      "menuOrder.acceptedAt",
      "menuOrder.servedAt",
      "menuOrder.createdAt",
      "bill.tableId",
      "bill.currency",
    ])
    .select((eb) => {
      const writtenLines = eb
        .selectFrom("billLine")
        .innerJoin("item", "item.id", "billLine.itemId")
        .whereRef("billLine.billId", "=", "menuOrder.billId")
        .where("menuOrder.writtenAmount", "is not", null)
        .where("billLine.isDeleted", "is not", sqliteTrue)
      return [
        writtenLines
          .select(sql<string>`group_concat("item"."name", ', ')`.as("text"))
          .as("writtenText"),
        writtenLines
          .select(sql<number>`sum("billLine"."totalAmount")`.as("arrived"))
          .as("writtenArrived"),
      ]
    })
    .where("menuOrder.isDeleted", "is not", sqliteTrue)
    .where("menuOrder.rejectedAt", "is", null)
    .where("menuOrder.billId", "is not", null)
    .where("menuOrder.pointer", "is not", null)
    .where("menuOrder.number", "is not", null)
    .where("bill.currency", "is not", null)
    .$narrowType<{
      billId: KyselyNotNull
      pointer: KyselyNotNull
      number: KyselyNotNull
      currency: KyselyNotNull
    }>()

export const menuOrdersToServeQuery = createQuery((db) =>
  selectListedMenuOrders(db)
    .where("menuOrder.servedAt", "is", null)
    .orderBy("menuOrder.createdAt", "asc")
)

export const menuOrdersServedSinceQuery = (since: TimestampMs) =>
  createQuery((db) =>
    selectListedMenuOrders(db)
      .where("menuOrder.servedAt", ">=", since)
      .orderBy("menuOrder.servedAt", "desc")
  )

export const recentMenuOrdersQuery = (createdSince: DateIso) =>
  createQuery((db) =>
    db
      .selectFrom("menuOrder")
      .select([
        "id",
        "billId",
        "pointer",
        "number",
        "writtenAmount",
        "acceptedAt",
        "servedAt",
        "rejectedAt",
        "createdAt",
      ])
      .where("isDeleted", "is not", sqliteTrue)
      .where("createdAt", ">=", createdSince)
      .where("billId", "is not", null)
      .where("pointer", "is not", null)
      .where("number", "is not", null)
      .$narrowType<{
        billId: KyselyNotNull
        pointer: KyselyNotNull
        number: KyselyNotNull
      }>()
  )

export const recentMenuOrderClaimsQuery = (createdSince: DateIso) =>
  createQuery((db) =>
    db
      .selectFrom("menuOrder")
      .innerJoin("payment", "payment.billId", "menuOrder.billId")
      .innerJoin(
        "reconciliationClaim",
        "reconciliationClaim.paymentId",
        "payment.id"
      )
      .select(["reconciliationClaim.id", "reconciliationClaim.isDeleted"])
      .where("menuOrder.isDeleted", "is not", sqliteTrue)
      .where("menuOrder.createdAt", ">=", createdSince)
  )
