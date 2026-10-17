import type { OpenBillRow } from "@payky/core/modules/bill/bill-queries"
import {
  claimedPaymentIdSet,
  deriveOpenBillTableId,
  derivePendingPaymentIds,
} from "@payky/core/modules/bill/bill-utils"
import {
  calculateBillLineSummaries,
  deriveBillSummaryStats,
} from "@payky/core/modules/bill-line/bill-line-utils"
import {
  type Currency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import type { TableId } from "@payky/core/modules/table/table-types"
import { z } from "zod"

/** The POS overview's pure derivations, shared by web's and native's screens. */

export interface BillWithStats {
  readonly bill: OpenBillRow
  readonly stats: ReturnType<typeof deriveBillSummaryStats>
}

export const TableFilterSchema = z.enum(["all", "occupied", "free"])
export type TableFilter = z.output<typeof TableFilterSchema>

/** Past these a bill reads as forgotten: first a warning, then an alarm. */
const LONG_OPEN_MS = 2 * 60 * 60_000
const VERY_LONG_OPEN_MS = 12 * 60 * 60_000

export const elapsedSeverity = (
  elapsedMs: number
): "normal" | "long" | "veryLong" =>
  elapsedMs >= VERY_LONG_OPEN_MS
    ? "veryLong"
    : elapsedMs >= LONG_OPEN_MS
      ? "long"
      : "normal"

/**
 * Derived from the rows' embedded `lines`/`items`, not a per-bill query.
 * Newest first, in every tile.
 */
export const buildBillRows = (
  openBills: ReadonlyArray<OpenBillRow>
): ReadonlyArray<BillWithStats> =>
  openBills
    .map((bill) => ({
      bill,
      stats: deriveBillSummaryStats(
        calculateBillLineSummaries(bill.lines, bill.items)
      ),
    }))
    .sort((a, b) => b.bill.displayNumber - a.bill.displayNumber)

export const groupBillRowsByTableId = (
  rows: ReadonlyArray<BillWithStats>,
  liveTableIds: ReadonlySet<TableId>
): ReadonlyMap<TableId | null, ReadonlyArray<BillWithStats>> => {
  const map = new Map<TableId | null, ReadonlyArray<BillWithStats>>()
  for (const row of rows) {
    const tableId = deriveOpenBillTableId(row.bill.tableId, liveTableIds)
    map.set(tableId, [...(map.get(tableId) ?? []), row])
  }
  return map
}

/**
 * The summed total of `rows` — or `undefined` when there are none or they are
 * in more than one currency, which have no meaningful sum.
 */
export const sumBillRows = (
  rows: ReadonlyArray<BillWithStats>
):
  | { readonly value: NonNegativeInteger; readonly currency: Currency }
  | undefined => {
  const [first] = rows
  if (
    first === undefined ||
    rows.some(({ bill }) => bill.currency !== first.bill.currency)
  ) {
    return undefined
  }

  return {
    value: NonNegativeInteger(
      rows.reduce((sum, { stats }) => sum + stats.totalAmount, 0)
    ),
    currency: first.bill.currency,
  }
}

/** Where a bill's payment stands, when it is anywhere at all. */
export const billPaymentState = (
  bill: OpenBillRow,
  now: number
): "paymentPending" | "partiallyPaid" | undefined => {
  if (
    derivePendingPaymentIds(
      bill.payments,
      claimedPaymentIdSet(bill.claims),
      new Date(now)
    ).length > 0
  ) {
    return "paymentPending"
  }
  // Still open with a claim behind it: some money is in, not all of it.
  return bill.claims.length > 0 ? "partiallyPaid" : undefined
}

/** The most urgent payment state among a table's bills. */
export const tablePaymentState = (
  rows: ReadonlyArray<BillWithStats>,
  now: number
): "paymentPending" | "partiallyPaid" | undefined => {
  const states = rows.map(({ bill }) => billPaymentState(bill, now))
  return states.includes("paymentPending")
    ? "paymentPending"
    : states.includes("partiallyPaid")
      ? "partiallyPaid"
      : undefined
}

export const matchesTableFilter = (
  filter: TableFilter,
  occupied: boolean
): boolean => filter === "all" || (filter === "occupied") === occupied
