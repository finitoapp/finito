import { type InferRow, kyselySql, sqliteTrue } from "@evolu/common"
import type { SqlBool } from "kysely"

import { createQuery } from "../../evolu/schema.ts"
import type { AccountTransactionKind } from "../account-transaction/account-transaction-types.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { BillLineTag } from "../bill-line/bill-line-types.ts"
import type { CatalogCategoryId } from "../catalog-category/catalog-category-types.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { ItemId, ItemLineType } from "../item/item-types.ts"
import type { RefundMethod } from "../refund/refund-types.ts"
import {
  type Currency,
  type FiatCurrency,
  type Integer,
  type NonEmptyString255,
  type PositiveNumber,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import type { StatsRange } from "./sales-stats-types.ts"

/*
 * Every query here aggregates in SQL and returns a few rows per currency, so
 * a month of a busy café (~10 k payments) never crosses into JS row by row.
 * Money is integer minor units in the row's `currency`; nothing is summed
 * across currencies.
 *
 * Every join by `id` also matches `ownerId`. Evolu's tables are `WITHOUT
 * ROWID` with a `(ownerId, id)` primary key, so `id` alone has no index and
 * SQLite builds an automatic one over the whole table on every run
 * (`EXPLAIN QUERY PLAN`: `AUTOMATIC COVERING INDEX`). An account writes all
 * its rows as its one app owner, so the extra equality never drops a row.
 */

type Db = Parameters<Parameters<typeof createQuery>[0]>[0]

const msRange = ({ fromIso, toIso }: StatsRange) =>
  [
    TimestampMsSchema.decode(Date.parse(fromIso)),
    TimestampMsSchema.decode(Date.parse(toIso)),
  ] as const

/**
 * `derivePaymentStatus`'s active claim, exactly as Activity reads it
 * (`latestPaymentsQuery`'s `ownClaimedTransactions`): a live claim whose
 * account transaction is still there. A claim on a deleted transaction is
 * not money that arrived.
 */
const activeClaimOf = (paymentIdSql: ReturnType<typeof kyselySql.ref>) =>
  kyselySql<SqlBool>`exists (
    select 1 from "reconciliationClaim" as "activeClaim"
    join "accountTransaction" as "activeClaimTx"
      on "activeClaimTx"."ownerId" = "activeClaim"."ownerId"
      and "activeClaimTx"."id" = "activeClaim"."accountTransactionId"
    where "activeClaim"."paymentId" = ${paymentIdSql}
      and "activeClaim"."isDeleted" is not ${sqliteTrue}
      and "activeClaimTx"."isDeleted" is not ${sqliteTrue}
      and "activeClaimTx"."kind" is not null
      and "activeClaimTx"."amount" is not null
      and "activeClaimTx"."currency" is not null
  )`

/**
 * The paid payments created in the range, as the derived table `paid`.
 * `paid = confirmedPaidAt OR (not canceled AND active claim)`, which is what
 * `derivePaymentStatus` returns `"paid"` for; expiry does not matter. `gross`
 * is `calculatePaymentBaseAmount`: the amount without its tip.
 */
const paidPayments = (db: Db, { fromIso, toIso }: StatsRange) =>
  db
    .selectFrom("payment")
    .select([
      "payment.id",
      "payment.ownerId",
      "payment.deviceId",
      "payment.billId",
      "payment.amount",
      "payment.tipAmount",
      "payment.createdAt",
    ])
    .select([
      kyselySql<FiatCurrency>`"payment"."currency"`.as("currency"),
      kyselySql<number>`max(0, "payment"."amount" - "payment"."tipAmount")`.as(
        "gross"
      ),
    ])
    .where("payment.createdAt", ">=", fromIso)
    .where("payment.createdAt", "<", toIso)
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where("payment.amount", "is not", null)
    .where("payment.currency", "is not", null)
    .where("payment.tipAmount", "is not", null)
    .where((eb) =>
      eb.or([
        eb("payment.confirmedPaidAt", "is not", null),
        eb.and([
          eb("payment.canceledAt", "is", null),
          activeClaimOf(kyselySql.ref("payment.id")),
        ]),
      ])
    )
    .as("paid")

/**
 * Paid sales per UTC hour (`yyyy-MM-ddTHH`) and currency. The per-hour and
 * per-day chart, the heatmap and the KPI totals are all folded from these
 * rows in JS (`sales-stats-utils.ts`); a month is at most 744 rows per
 * currency.
 */
export const salesByHourQuery = (range: StatsRange) =>
  createQuery((db) =>
    db
      .selectFrom(paidPayments(db, range))
      .select([
        kyselySql<string>`substr("paid"."createdAt", 1, 13)`.as("utcHour"),
        "paid.currency",
        kyselySql<number>`count(*)`.as("count"),
        kyselySql<number>`sum("paid"."gross")`.as("gross"),
        kyselySql<number>`sum("paid"."tipAmount")`.as("tips"),
      ])
      .groupBy([kyselySql`substr("paid"."createdAt", 1, 13)`, "paid.currency"])
      .orderBy("utcHour")
  )
export type SalesByHourRow = InferRow<ReturnType<typeof salesByHourQuery>>

/**
 * Paid sales by the method that settled them — the `kind` of each claimed
 * account transaction, not the method rows a payment offered.
 *
 * - One claim: `amount` is the payment's gross, `tips` its tip.
 * - Several claims (a duplicate settlement, docs/bill-payment-states.md):
 *   each distinct transaction's value in the payment's currency (satoshis
 *   converted at the payment's own rate, as `toPaymentCurrencyAmount` does)
 *   goes to its own kind, tips included, so the methods can add up to more
 *   than revenue — real money, shown as such.
 * - `confirmedPaidAt` without a claim falls back to `"unknown"`.
 *
 * `claimedAmount` is the money that actually arrived through the method
 * (the transaction amounts, tips included): the cash row's is the cash
 * input of `expectedCash`. `count` is distinct payments per method.
 */
export const salesByMethodQuery = (range: StatsRange) =>
  createQuery((db) => {
    // The settling method's own quote, as `quotedAmountSats`.
    const quoted = kyselySql<
      number | null
    >`case "tx"."kind" when 'cashu' then "cashu"."amountSats" when 'lightningAddress' then "lightningAddress"."amountSats" else "btc"."amountSats" end`
    const settlements = db
      .selectFrom(paidPayments(db, range))
      .leftJoin("reconciliationClaim as claim", (join) =>
        join
          .onRef("claim.paymentId", "=", "paid.id")
          .on("claim.isDeleted", "is not", sqliteTrue)
          .on(
            kyselySql<SqlBool>`exists (
              select 1 from "accountTransaction" as "claimTx"
              where "claimTx"."ownerId" = "claim"."ownerId"
                and "claimTx"."id" = "claim"."accountTransactionId"
                and "claimTx"."isDeleted" is not ${sqliteTrue}
                and "claimTx"."kind" is not null
                and "claimTx"."amount" is not null
                and "claimTx"."currency" is not null
            )`
          )
      )
      .leftJoin("accountTransaction as tx", (join) =>
        join
          .onRef("tx.ownerId", "=", "claim.ownerId")
          .onRef("tx.id", "=", "claim.accountTransactionId")
          .on("tx.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentBtc as btc", (join) =>
        join
          .onRef("btc.ownerId", "=", "paid.ownerId")
          .onRef("btc.id", "=", "paid.id")
          .on("btc.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCashu as cashu", (join) =>
        join
          .onRef("cashu.ownerId", "=", "paid.ownerId")
          .onRef("cashu.id", "=", "paid.id")
          .on("cashu.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentLightningAddress as lightningAddress", (join) =>
        join
          .onRef("lightningAddress.ownerId", "=", "paid.ownerId")
          .onRef("lightningAddress.id", "=", "paid.id")
          .on("lightningAddress.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "paid.id as paymentId",
        "paid.currency",
        "paid.gross",
        "paid.tipAmount",
        kyselySql<AccountTransactionKind | null>`"tx"."kind"`.as("kind"),
        kyselySql<number | null>`case
          when "tx"."id" is null then null
          when "tx"."currency" = "paid"."currency" then "tx"."amount"
          when ${quoted} > 0 then cast(round("tx"."amount" * "paid"."amount" * 1.0 / ${quoted}) as integer)
          else 0
        end`.as("claimedAmount"),
        kyselySql<number>`count("tx"."id") over (partition by "paid"."id")`.as(
          "claimCount"
        ),
      ])
      // One row per distinct transaction, as `sumDistinctClaimedAmounts`.
      .groupBy(["paid.id", "tx.id"])
      .as("settlement")

    return db
      .selectFrom(settlements)
      .select([
        kyselySql<
          AccountTransactionKind | "unknown"
        >`coalesce("settlement"."kind", 'unknown')`.as("method"),
        "settlement.currency",
        kyselySql<number>`count(distinct "settlement"."paymentId")`.as("count"),
        kyselySql<number>`sum(case when "settlement"."claimCount" <= 1
          then "settlement"."gross" else "settlement"."claimedAmount" end)`.as(
          "amount"
        ),
        kyselySql<number>`coalesce(sum("settlement"."claimedAmount"), 0)`.as(
          "claimedAmount"
        ),
        kyselySql<number>`sum(case when "settlement"."claimCount" <= 1
          then "settlement"."tipAmount" else 0 end)`.as("tips"),
      ])
      .groupBy(["method", "settlement.currency"])
      .orderBy("method")
  })
export type SalesByMethodRow = InferRow<ReturnType<typeof salesByMethodQuery>>

/**
 * Refunds by the day they were paid out (`refundedAt`), not by the day of
 * the refunded payment, split by `method` and `isTip` (1 for a tip refund,
 * which reduces tips; 0 reduces net revenue).
 */
export const refundsQuery = (range: StatsRange) =>
  createQuery((db) => {
    const [fromMs, toMs] = msRange(range)
    return db
      .selectFrom("refund")
      .select([
        kyselySql<FiatCurrency>`"refund"."currency"`.as("currency"),
        kyselySql<RefundMethod>`"refund"."method"`.as("method"),
        kyselySql<
          0 | 1
        >`case when "refund"."isTip" = ${sqliteTrue} then 1 else 0 end`.as(
          "isTip"
        ),
        kyselySql<number>`count(*)`.as("count"),
        kyselySql<number>`sum("refund"."amount")`.as("amount"),
      ])
      .where("refund.refundedAt", ">=", fromMs)
      .where("refund.refundedAt", "<", toMs)
      .where("refund.isDeleted", "is not", sqliteTrue)
      .where("refund.amount", "is not", null)
      .where("refund.currency", "is not", null)
      .where("refund.method", "is not", null)
      .groupBy(["currency", "method", "isTip"])
  })
export type RefundsRow = InferRow<ReturnType<typeof refundsQuery>>

/**
 * Paid sales per `payment.deviceId`, named by `device.name` — a removed
 * device keeps its name here. `deviceId` is `null` for payments a CLI or
 * import wrote without one.
 */
export const salesByDeviceQuery = (range: StatsRange) =>
  createQuery((db) =>
    db
      .selectFrom(paidPayments(db, range))
      .leftJoin("device", (join) =>
        join
          .onRef("device.ownerId", "=", "paid.ownerId")
          .onRef("device.id", "=", "paid.deviceId")
      )
      .select([
        kyselySql<DeviceId | null>`"paid"."deviceId"`.as("deviceId"),
        kyselySql<string | null>`"device"."name"`.as("deviceName"),
        "paid.currency",
        kyselySql<number>`count(*)`.as("count"),
        kyselySql<number>`sum("paid"."gross")`.as("gross"),
        kyselySql<number>`sum("paid"."tipAmount")`.as("tips"),
      ])
      .groupBy(["paid.deviceId", "paid.currency"])
      .orderBy("gross", "desc")
  )
export type SalesByDeviceRow = InferRow<ReturnType<typeof salesByDeviceQuery>>

/**
 * Paid sales without a bill — the keypad's — which have no items. They make
 * the "Without item" row of the category breakdown.
 */
export const keypadSalesQuery = (range: StatsRange) =>
  createQuery((db) =>
    db
      .selectFrom(paidPayments(db, range))
      .select([
        "paid.currency",
        kyselySql<number>`count(*)`.as("count"),
        kyselySql<number>`sum("paid"."gross")`.as("gross"),
      ])
      // `+` keeps SQLite off `payment_billId`, which would read every keypad
      // sale ever instead of the range on `payment_createdAt`.
      .where(kyselySql<SqlBool>`+"paid"."billId" is null`)
      .groupBy("paid.currency")
  )
export type KeypadSalesRow = InferRow<ReturnType<typeof keypadSalesQuery>>

/**
 * Whether the bill holds a discount line (catalog/0002): any line of it below
 * zero, even one taken off again. Such a bill's VAT is not grouped in SQL but
 * allocated in JS (`discountedBillLinesQuery`, catalog/0003).
 */
const hasDiscountLine = (billIdSql: ReturnType<typeof kyselySql.ref>) =>
  kyselySql<SqlBool>`exists (
    select 1 from "billLine" as "discountLine"
    where "discountLine"."billId" = ${billIdSql}
      and "discountLine"."totalAmount" < 0
  )`

/**
 * The ledger lines of the bills that were closed or canceled in the range,
 * joined with their `item` snapshot.
 *
 * `closed` bills are `closedAt` in the range and either not canceled or
 * confirmed closed despite the cancellation (`deriveBillStatus`; the
 * confirmation writes `closedAt` too). `canceled` bills are `canceledAt` in
 * the range and not confirmed closed. Tip lines are left out of `closed`:
 * a tip is not an item sold, and tips have their own KPI.
 */
const billLinesOf = (
  db: Db,
  range: StatsRange,
  bills: "closed" | "canceled"
) => {
  const [fromMs, toMs] = msRange(range)
  const base = db
    .selectFrom("bill")
    .innerJoin("billLine", "billLine.billId", "bill.id")
    .innerJoin("item", (join) =>
      join
        .onRef("item.ownerId", "=", "billLine.ownerId")
        .onRef("item.id", "=", "billLine.itemId")
    )
    .where("bill.isDeleted", "is not", sqliteTrue)
    .where("bill.currency", "is not", null)
    .where("billLine.itemId", "is not", null)
    .where("billLine.type", "is not", null)
    .where("billLine.kind", "is not", null)
    .where("billLine.quantity", "is not", null)
    .where("billLine.totalAmount", "is not", null)

  return bills === "closed"
    ? base
        .where("bill.closedAt", ">=", fromMs)
        .where("bill.closedAt", "<", toMs)
        .where((eb) =>
          eb.or([
            eb("bill.canceledAt", "is", null),
            eb("bill.confirmedClosedAt", "is not", null),
          ])
        )
        .where("billLine.type", "!=", "tip")
    : base
        .where("bill.canceledAt", ">=", fromMs)
        .where("bill.canceledAt", "<", toMs)
        .where("bill.confirmedClosedAt", "is", null)
}

/**
 * One group of a bill's ledger: the lines `calculateBillLineSummaries` folds
 * into one summary (`createBillLineSummaryId`), over the columns of the
 * derived table `table`.
 */
const ledgerGroupOf = (table: string) =>
  kyselySql`${kyselySql.ref(`${table}.billId`)},
    ${kyselySql.ref(`${table}.catalogItemId`)},
    ${kyselySql.ref(`${table}.itemId`)},
    ${kyselySql.ref(`${table}.type`)}`

/**
 * A bill's lines netted per group as `calculateBillLineSummaries` folds them
 * (payment/0016), keeping only groups whose quantity nets above zero. As the
 * derived table `line`.
 *
 * The fold walks a group's lines in ledger order (`createdAt`, `ownerId`,
 * `id`, as `billLinesByBillIdQuery`) and drops the group whenever its
 * quantity reaches zero or below, so a removal takes only what the line
 * still holds and a later add starts it afresh. Summing the whole group
 * instead read a removal two devices wrote for the same unit as a quantity
 * below zero, which hid the next add from the statistics while the bill
 * charged for it.
 *
 * The fold's running quantity is the plain running sum less its lowest point
 * so far, at most zero, so the group was last emptied at the last line whose
 * running sum is zero or below and the lowest of the group. Only the lines
 * after it count, amounts included. Three window passes, since a window
 * cannot read another in the same select: the running sum, the group's
 * lowest running sum, the last line that reaches it.
 *
 * The amount keeps its sign: a discount group nets below zero (catalog/0002),
 * as the fold sums it. `isDiscount` is 1 for a group of an item priced below
 * zero.
 */
const nettedBillLines = (
  db: Db,
  range: StatsRange,
  bills: "closed" | "canceled"
) => {
  const ledgerLines = billLinesOf(db, range, bills)
    .select([
      kyselySql<BillId>`"bill"."id"`.as("billId"),
      "bill.ownerId",
      kyselySql<FiatCurrency>`"bill"."currency"`.as("currency"),
      "billLine.catalogItemId",
      kyselySql<ItemId>`"billLine"."itemId"`.as("itemId"),
      kyselySql<ItemLineType>`"billLine"."type"`.as("type"),
      kyselySql<string>`"item"."name"`.as("name"),
      kyselySql<string>`"item"."createdAt"`.as("itemCreatedAt"),
      "item.taxRateId",
      // One `item` per group, so its price is every line's.
      kyselySql<0 | 1>`"item"."unitAmount" < 0`.as("isDiscount"),
      kyselySql<number>`case when "billLine"."kind" = 'add'
        then "billLine"."quantity" else -"billLine"."quantity" end`.as(
        "quantity"
      ),
      kyselySql<number>`case when "billLine"."kind" = 'add'
        then "billLine"."totalAmount" else -"billLine"."totalAmount" end`.as(
        "totalAmount"
      ),
      kyselySql<number>`row_number() over (
        partition by "bill"."id", "billLine"."catalogItemId",
          "billLine"."itemId", "billLine"."type"
        order by "billLine"."createdAt", "billLine"."ownerId", "billLine"."id"
      )`.as("position"),
      kyselySql<number>`sum(case when "billLine"."kind" = 'add'
        then "billLine"."quantity" else -"billLine"."quantity" end) over (
        partition by "bill"."id", "billLine"."catalogItemId",
          "billLine"."itemId", "billLine"."type"
        order by "billLine"."createdAt", "billLine"."ownerId", "billLine"."id"
        rows between unbounded preceding and current row
      )`.as("runningQuantity"),
    ])
    .as("ledgerLine")

  const withLowest = db
    .selectFrom(ledgerLines)
    .selectAll("ledgerLine")
    .select(
      kyselySql<number>`min("ledgerLine"."runningQuantity") over (
        partition by ${ledgerGroupOf("ledgerLine")}
      )`.as("lowestRunningQuantity")
    )
    .as("foldedLine")

  const withLastEmptied = db
    .selectFrom(withLowest)
    .selectAll("foldedLine")
    .select(
      kyselySql<number | null>`max(case
        when "foldedLine"."runningQuantity" <= 0
          and "foldedLine"."runningQuantity" = "foldedLine"."lowestRunningQuantity"
        then "foldedLine"."position" end) over (
        partition by ${ledgerGroupOf("foldedLine")}
      )`.as("lastEmptiedAt")
    )
    .as("keptLine")

  return db
    .selectFrom(withLastEmptied)
    .where((eb) =>
      eb.or([
        eb("keptLine.lastEmptiedAt", "is", null),
        eb("keptLine.position", ">", eb.ref("keptLine.lastEmptiedAt")),
      ])
    )
    .select([
      "keptLine.billId",
      "keptLine.ownerId",
      "keptLine.currency",
      "keptLine.catalogItemId",
      "keptLine.itemId",
      "keptLine.name",
      "keptLine.itemCreatedAt",
      "keptLine.taxRateId",
      "keptLine.isDiscount",
      kyselySql<number>`sum("keptLine"."quantity")`.as("quantity"),
      kyselySql<number>`sum("keptLine"."totalAmount")`.as("totalAmount"),
    ])
    .groupBy([
      "keptLine.billId",
      "keptLine.catalogItemId",
      "keptLine.itemId",
      "keptLine.type",
    ])
    .having(kyselySql<SqlBool>`sum("keptLine"."quantity") > 0`)
    .as("line")
}

/**
 * What closed bills sold, by `closedAt`, per product: grouped by
 * `catalogItemId` when the line has one (one product across price changes),
 * else by its frozen `itemId`. `name`/`itemId` are the newest `item`
 * snapshot's. Does not add up to net revenue (keypad sales, tips, partial
 * and over/under payments).
 *
 * `isDiscount` is 1 for a discount (an item priced below zero, catalog/0002),
 * whose `amount` is below zero: the leaderboard shows discounts apart instead
 * of ranking them as items that lost money (`splitItemSales`).
 */
export const itemSalesQuery = (range: StatsRange) =>
  createQuery((db) =>
    db
      .selectFrom(nettedBillLines(db, range, "closed"))
      .select([
        kyselySql<CatalogItemId | null>`"line"."catalogItemId"`.as(
          "catalogItemId"
        ),
        // SQLite takes bare columns from the row `max()` picked.
        kyselySql<string>`max("line"."itemCreatedAt")`.as("latestAt"),
        "line.itemId",
        "line.name",
        "line.currency",
        // Not `max()`: a second one would unpin the bare columns above.
        kyselySql<0 | 1>`sum("line"."isDiscount") > 0`.as("isDiscount"),
        kyselySql<number>`sum("line"."quantity")`.as("quantity"),
        kyselySql<number>`sum("line"."totalAmount")`.as("amount"),
      ])
      .groupBy([
        kyselySql`coalesce("line"."catalogItemId", "line"."itemId")`,
        "line.currency",
      ])
      .orderBy("amount", "desc")
  )
export type ItemSalesRow = InferRow<ReturnType<typeof itemSalesQuery>>

/**
 * `itemSalesQuery` per catalog category (`catalogItem.categoryId`).
 * `categoryId`/`categoryName` are `null` for "Uncategorized": no category,
 * or a line without a catalog item (a manual amount). A deleted category
 * keeps its name, as history should.
 *
 * Discounts are left out (catalog/0003): the leaderboard already shows them
 * apart (`splitItemSales`), and summed in here they would lower a category
 * or take "Uncategorized" below zero.
 */
export const categorySalesQuery = (range: StatsRange) =>
  createQuery((db) =>
    db
      .selectFrom(nettedBillLines(db, range, "closed"))
      .where(kyselySql<SqlBool>`"line"."isDiscount" = 0`)
      .leftJoin("catalogItem", (join) =>
        join
          .onRef("catalogItem.ownerId", "=", "line.ownerId")
          .onRef("catalogItem.id", "=", "line.catalogItemId")
      )
      .leftJoin("catalogCategory", (join) =>
        join
          .onRef("catalogCategory.ownerId", "=", "catalogItem.ownerId")
          .onRef("catalogCategory.id", "=", "catalogItem.categoryId")
      )
      .select([
        kyselySql<CatalogCategoryId | null>`"catalogCategory"."id"`.as(
          "categoryId"
        ),
        kyselySql<string | null>`"catalogCategory"."name"`.as("categoryName"),
        "line.currency",
        kyselySql<number>`sum("line"."quantity")`.as("quantity"),
        kyselySql<number>`sum("line"."totalAmount")`.as("amount"),
      ])
      .groupBy(["catalogCategory.id", "line.currency"])
      .orderBy("amount", "desc")
  )
export type CategorySalesRow = InferRow<ReturnType<typeof categorySalesQuery>>

/**
 * The netted lines of the closed bills without a discount, counted per
 * (currency, tax rate, line total). VAT is split per line and then summed
 * (`calculateTaxRecap`), so the distinct line totals are what it needs —
 * `salesTaxRecap` in `sales-stats-utils.ts` turns these into `TaxRecap` rows.
 *
 * A bill with a discount is left to `discountedBillLinesQuery`: its VAT is
 * counted from net lines (catalog/0003), which takes `allocateDiscount`'s
 * per-line rounding, not a sum SQL could group.
 */
export const taxRecapQuery = (range: StatsRange) =>
  createQuery((db) =>
    db
      .selectFrom(nettedBillLines(db, range, "closed"))
      .where((eb) => eb.not(hasDiscountLine(kyselySql.ref("line.billId"))))
      .select([
        "line.currency",
        kyselySql<TaxRateId | null>`"line"."taxRateId"`.as("taxRateId"),
        "line.totalAmount as lineAmount",
        kyselySql<number>`count(*)`.as("lineCount"),
      ])
      .groupBy(["line.currency", "line.taxRateId", "line.totalAmount"])
  )
export type TaxRecapQueryRow = InferRow<ReturnType<typeof taxRecapQuery>>

/**
 * Every ledger line of the closed bills with a discount, with what
 * `calculateBillLineSummaries` reads of its `item`, in the order it folds
 * them (`billLinesByBillIdQuery`'s). `salesTaxRecap` folds each bill, spreads
 * its discount with `allocateDiscount` — the same function a payment freezes
 * its lines with, so an unchanged bill's VAT here is its payment's — and adds
 * the net lines to `taxRecapQuery`'s. Discounted bills are few, so their
 * lines cross into JS one by one.
 */
export const discountedBillLinesQuery = (range: StatsRange) =>
  createQuery((db) =>
    billLinesOf(db, range, "closed")
      .where(hasDiscountLine(kyselySql.ref("bill.id")))
      .select([
        kyselySql<BillId>`"billLine"."billId"`.as("billId"),
        kyselySql<FiatCurrency>`"bill"."currency"`.as("currency"),
        "billLine.catalogItemId",
        kyselySql<ItemId>`"billLine"."itemId"`.as("itemId"),
        kyselySql<ItemLineType>`"billLine"."type"`.as("type"),
        kyselySql<BillLineTag>`"billLine"."kind"`.as("kind"),
        kyselySql<PositiveNumber>`"billLine"."quantity"`.as("quantity"),
        kyselySql<Integer>`"billLine"."totalAmount"`.as("totalAmount"),
        kyselySql<NonEmptyString255>`"item"."name"`.as("name"),
        "item.description",
        kyselySql<FiatCurrency>`"item"."currency"`.as("itemCurrency"),
        "item.taxRateId",
      ])
      .orderBy("billLine.createdAt", "asc")
      .orderBy("billLine.ownerId", "asc")
      .orderBy("billLine.id", "asc")
  )
export type DiscountedBillLineRow = InferRow<
  ReturnType<typeof discountedBillLinesQuery>
>

export type SalesSignal = "canceledPayment" | "canceledBill" | "manualIban"

/**
 * What may look off, per currency (`count` and `amount` each):
 *
 * - `canceledPayment` — `canceledAt` in the range and not confirmed paid;
 *   `amount` is what was charged, tip included.
 * - `canceledBill` — `canceledAt` in the range and not confirmed closed,
 *   with the total of the goods discarded with it: only its groups that net
 *   above zero, so a discount added before discarding cannot zero the
 *   signal (payment/0015). A bill canceled with no goods on it is not
 *   counted.
 * - `manualIban` — a bank transfer confirmed by hand (`source = "manual"`,
 *   transaction `kind = "iban"`), `claimedAt` in the range: the pattern
 *   access/0002 guards with `confirm`. Manual cash is normal and not here.
 */
export const signalsQuery = (range: StatsRange) =>
  createQuery((db) => {
    const [fromMs, toMs] = msRange(range)
    const canceledPayments = db
      .selectFrom("payment")
      .select([
        kyselySql<SalesSignal>`'canceledPayment'`.as("signal"),
        kyselySql<Currency>`"payment"."currency"`.as("currency"),
        kyselySql<number>`count(*)`.as("count"),
        kyselySql<number>`sum("payment"."amount")`.as("amount"),
      ])
      .where("payment.canceledAt", ">=", fromMs)
      .where("payment.canceledAt", "<", toMs)
      .where("payment.confirmedPaidAt", "is", null)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .groupBy("payment.currency")

    const canceledBills = db
      .selectFrom(nettedBillLines(db, range, "canceled"))
      .select([
        kyselySql<SalesSignal>`'canceledBill'`.as("signal"),
        kyselySql<Currency>`"line"."currency"`.as("currency"),
        kyselySql<number>`count(distinct "line"."billId")`.as("count"),
        kyselySql<number>`sum("line"."totalAmount")`.as("amount"),
      ])
      .where("line.totalAmount", ">", 0)
      .groupBy("line.currency")

    const manualIban = db
      .selectFrom("reconciliationClaim as claim")
      .innerJoin("accountTransaction as tx", (join) =>
        join
          .onRef("tx.ownerId", "=", "claim.ownerId")
          .onRef("tx.id", "=", "claim.accountTransactionId")
      )
      .select([
        kyselySql<SalesSignal>`'manualIban'`.as("signal"),
        kyselySql<Currency>`"tx"."currency"`.as("currency"),
        kyselySql<number>`count(*)`.as("count"),
        kyselySql<number>`sum("tx"."amount")`.as("amount"),
      ])
      // `+` keeps SQLite on `reconciliationClaim_claimedAt`: without
      // statistics it prefers the equality on `reconciliationClaim_source`,
      // and `"manual"` is every cash claim ever.
      .where(kyselySql<SqlBool>`+"claim"."source" = 'manual'`)
      .where("claim.claimedAt", ">=", fromMs)
      .where("claim.claimedAt", "<", toMs)
      .where("claim.isDeleted", "is not", sqliteTrue)
      .where("tx.kind", "=", "iban")
      .where("tx.isDeleted", "is not", sqliteTrue)
      .where("tx.currency", "is not", null)
      .groupBy("tx.currency")

    return canceledPayments.unionAll(canceledBills).unionAll(manualIban)
  })
export type SignalsRow = InferRow<ReturnType<typeof signalsQuery>>
