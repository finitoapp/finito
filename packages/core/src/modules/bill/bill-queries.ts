import {
  evoluJsonArrayFrom,
  type InferRow,
  type KyselyNotNull,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type { TableId } from "../table/table-types.ts"
import type { BillId } from "./bill-types.ts"

export const billByIdQuery = (idValue: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("bill")
      .selectAll()
      .where("id", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("displayNumber", "is not", null)
      .where("currency", "is not", null)
      .$narrowType<{
        displayNumber: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

/**
 * A cheap, SQL-only approximation of "still open" for list views (the POS
 * floor overview, the assign-table dialog, the split dialog's existing-bill
 * picker, `listOpenBills`) — filters on the best-effort
 * `closedAt`/`canceledAt` cache fields instead of computing coverage for
 * every bill the account has ever had. See `bill.ts`'s doc comment and
 * docs/bill-payment-states.md: this can rarely under- or over-include a
 * bill for a moment after a multi-device race, which is why nothing that
 * needs to be *correct* (guards, the bill detail page) uses this — those
 * derive status live via `deriveBillStatus`/`loadBillStatus`.
 *
 * Embeds `lines`/`items` per row for the same reason `latestBillsQuery` does:
 * every consumer needs each bill's item count and total, and loading those per
 * bill turned a floor view of N open bills into 1 + 2N queries — as N live
 * subscriptions in the React consumers, one set per tile. Folding them in
 * keeps it to a single query however many bills are open, and
 * `calculateBillLineSummaries` reduces `lines`/`items` with the same pure
 * logic the bill detail page uses.
 */
export const openBillsQuery = createQuery((db) =>
  db
    .selectFrom("bill")
    .selectAll()
    .select((eb) => [
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
          // See `billLinesByBillIdQuery` for why the tie-break matters
          // and why it is free in this exact shape.
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
      // The floor view's payment badges: the same inputs `usePendingPayments`
      // reads per bill, folded in for the same one-query reason as above.
      evoluJsonArrayFrom(
        eb
          .selectFrom("payment")
          .select(["payment.id", "payment.canceledAt", "payment.expiresAt"])
          .whereRef("payment.billId", "=", "bill.id")
          .where("payment.isDeleted", "is not", sqliteTrue)
      ).as("payments"),
      evoluJsonArrayFrom(
        eb
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
            "reconciliationClaim.paymentId",
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
          .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
          .where("reconciliationClaim.paymentId", "is not", null)
          .where("reconciliationClaim.accountTransactionId", "is not", null)
          .where("accountTransaction.isDeleted", "is not", sqliteTrue)
          .where("accountTransaction.amount", "is not", null)
          .where("accountTransaction.currency", "is not", null)
          .$narrowType<{
            paymentId: KyselyNotNull
            tipAmount: KyselyNotNull
            paymentAmount: KyselyNotNull
            paymentCurrency: KyselyNotNull
            accountTransactionId: KyselyNotNull
            amount: KyselyNotNull
            currency: KyselyNotNull
          }>()
      ).as("claims"),
    ])
    .where("canceledAt", "is", null)
    .where("closedAt", "is", null)
    .where("isDeleted", "is not", sqliteTrue)
    .where("displayNumber", "is not", null)
    .where("currency", "is not", null)
    .$narrowType<{
      displayNumber: KyselyNotNull
      currency: KyselyNotNull
    }>()
)

/**
 * Every open bill currently assigned to one table. Read by `deleteTable`:
 * the POS floor view only renders non-deleted tables plus the bills with no
 * table at all, so deleting an occupied table would leave its bill with no
 * tile to reach it from.
 */
export const openBillsByTableIdQuery = (tableId: TableId) =>
  createQuery((db) =>
    db
      .selectFrom("bill")
      .select(["id"])
      .where("tableId", "=", tableId)
      .where("canceledAt", "is", null)
      .where("closedAt", "is", null)
      .where("isDeleted", "is not", sqliteTrue)
  )

/**
 * A page of the most recent bills, newest first, regardless of status — the
 * read model behind the `/activity/bills` infinite-scroll list. Pass
 * `limit: pageSize + 1` and slice off the extra row to detect whether more
 * bills remain without a separate count query. Mirrors `latestPaymentsQuery`
 * in `payment-history.tsx`: a flat, paginated list for a history view, not a
 * lock/coverage computation.
 *
 * Embeds each bill's line ledger (`lines`), the item snapshots those lines
 * reference (`items`), and its claimed-transaction rows
 * (`claimedTransactions`) as `evoluJsonArrayFrom` subqueries instead of
 * making `BillHistory` load them per row via separate `billId`-scoped
 * queries (as `useBillLineSummaries`/`useBillCoverage`/`useBillStatus` do
 * for the single-bill detail page). Loading those per row — combined with
 * React's `use()` suspending on each newly-seen query — turned the list
 * into a sequential Suspense waterfall, one round trip per bill. Folding
 * the raw rows into this one query keeps the list to a single round trip
 * regardless of how many bills are shown; `deriveBillHistoryItemSummary` in
 * `bill-utils.ts` then re-derives status/coverage from `lines`/
 * `claimedTransactions` with the same pure logic the detail page uses.
 */
export const latestBillsQuery = (limit: number) =>
  createQuery((db) =>
    db
      .selectFrom("bill")
      .selectAll()
      .select((eb) => [
        // A scalar subquery rather than a join, which would make the
        // unqualified `bill` columns below ambiguous.
        eb
          .selectFrom("table")
          .select("table.name")
          .whereRef("table.id", "=", "bill.tableId")
          .where("table.isDeleted", "is not", sqliteTrue)
          .as("tableName"),
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
            // See `billLinesByBillIdQuery` for why the tie-break matters
            // and why it is free in this exact shape.
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
              "accountTransaction.kind as transactionKind",
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
            .where("accountTransaction.kind", "is not", null)
            .$narrowType<{
              transactionKind: KyselyNotNull
              tipAmount: KyselyNotNull
              paymentAmount: KyselyNotNull
              paymentCurrency: KyselyNotNull
              accountTransactionId: KyselyNotNull
              amount: KyselyNotNull
              currency: KyselyNotNull
            }>()
        ).as("claimedTransactions"),
      ])
      .where("displayNumber", "is not", null)
      .where("currency", "is not", null)
      .where("createdAt", "is not", null)
      .$narrowType<{
        displayNumber: KyselyNotNull
        currency: KyselyNotNull
        createdAt: KyselyNotNull
      }>()
      .orderBy("createdAt", "desc")
      .limit(limit)
  )

/**
 * Every bill's `displayNumber`, oldest first, regardless of status — the
 * source `createBillAtEnd` derives the next sequential number from. Must
 * include closed/canceled bills too so numbers are never reused.
 */
/**
 * The highest bill display number ever issued, over every bill including
 * canceled and closed ones so numbers are never reused — see
 * `loadNextBillDisplayNumber`.
 *
 * `desc limit 1` off the `bill_displayNumber` index, rather than reading every
 * number and keeping the last: this runs on every bill creation, and the
 * numbers grow for the lifetime of the install. At 50k bills SQLite goes from
 * `SCAN bill` + a temp b-tree for the sort to a `SEARCH ... USING COVERING
 * INDEX`, and 50k rows stop crossing the worker boundary.
 */
export const lastBillDisplayNumberQuery = createQuery((db) =>
  db
    .selectFrom("bill")
    .select(["displayNumber"])
    .where("displayNumber", "is not", null)
    .$narrowType<{
      displayNumber: KyselyNotNull
    }>()
    .orderBy("displayNumber", "desc")
    .limit(1)
)

/**
 * An `openBillsQuery` row: a `BillRow` plus the embedded `lines`/`items` every
 * consumer reduces through `calculateBillLineSummaries`.
 */
export type OpenBillRow = InferRow<typeof openBillsQuery>
