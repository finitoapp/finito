import { sha256 } from "@noble/hashes/sha2.js"
import { base32nopad } from "@scure/base"

import type { BillId } from "../bill/bill-types.ts"
import { calculateClaimedSum } from "../bill/bill-utils.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import type { BillLineSummaryId } from "../bill-line/bill-line-types.ts"
import {
  calculateBillLineSummaries,
  deriveBillSummaryTotal,
} from "../bill-line/bill-line-utils.ts"
import { TimestampMs } from "../shared/schema.ts"
import type {
  TableSelfPayBillRow,
  TableSelfPayConfirmationRow,
} from "./table-self-pay-queries.ts"
import {
  deriveBillSelfPayReference,
  deriveSelfPayPointerHash,
  type SelfPayReference,
} from "./table-self-pay-reference-utils.ts"
import {
  fitSelfPayViewIntoEvent,
  type SelfPayView,
  type SelfPayViewBill,
  type SelfPayViewLine,
} from "./table-self-pay-view-utils.ts"

const MAX_CONFIRMATIONS_PER_BILL = 20
const CONFIRMATION_WINDOW_MS = 60 * 60 * 1000
const LINE_KEY_BYTES = 5

export interface SelfPayInstructions {
  readonly payee: string | null
  readonly bank: SelfPayView["bank"]
  readonly lightning: SelfPayView["lightning"]
  readonly selectionKey: SelfPayView["selectionKey"]
  readonly menu: SelfPayView["menu"]
}

export const deriveSelfPayLineKey = (summaryId: BillLineSummaryId): string =>
  base32nopad.encode(
    sha256(new TextEncoder().encode(summaryId)).slice(0, LINE_KEY_BYTES)
  )

export const sumSelfPayAllocationsByLineKey = (
  allocations: ReadonlyArray<{
    readonly lineKey: string
    readonly amount: number
  }>
): ReadonlyMap<string, number> => {
  const allocatedByKey = new Map<string, number>()
  for (const { lineKey, amount } of allocations) {
    allocatedByKey.set(lineKey, (allocatedByKey.get(lineKey) ?? 0) + amount)
  }
  return allocatedByKey
}

export const findOfferedSelfPayReferences = (
  openBills: ReadonlyArray<{ readonly id: BillId; readonly createdAt: string }>
): ReadonlyMap<BillId, SelfPayReference> => {
  const oldestFirst = [...openBills].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
  )
  const taken = new Set<SelfPayReference>()
  const offered = new Map<BillId, SelfPayReference>()
  for (const { id } of oldestFirst) {
    const reference = deriveBillSelfPayReference(id)
    if (!taken.has(reference)) offered.set(id, reference)
    taken.add(reference)
  }
  return offered
}

export const projectSelfPayViewLine = (
  summary: Pick<BillLineSummary, "id" | "name" | "quantity" | "totalAmount">,
  allocatedByKey: ReadonlyMap<string, number>
): SelfPayViewLine => {
  const key = deriveSelfPayLineKey(summary.id)
  return {
    key,
    name: summary.name,
    quantity: summary.quantity,
    totalAmount: summary.totalAmount,
    allocatedAmount: Math.min(
      summary.totalAmount,
      allocatedByKey.get(key) ?? 0
    ),
  }
}

export const projectSelfPayViewBill = (
  row: TableSelfPayBillRow,
  reference: SelfPayReference
): SelfPayViewBill => {
  const summaries = calculateBillLineSummaries(row.lines, row.items)
  const total = deriveBillSummaryTotal(summaries)
  const covered = calculateClaimedSum(row.claimedTransactions)
  const allocatedByKey = sumSelfPayAllocationsByLineKey(row.allocations)
  return {
    reference,
    currency: row.currency,
    total,
    covered,
    remainder: Math.max(0, total - covered),
    lines: summaries.map((summary) =>
      projectSelfPayViewLine(summary, allocatedByKey)
    ),
  }
}

export const selfPayConfirmationsEndedAfter = (version: number): TimestampMs =>
  TimestampMs(version * 1000 - CONFIRMATION_WINDOW_MS)

export const projectSelfPayConfirmations = (
  rows: ReadonlyArray<TableSelfPayConfirmationRow>
): SelfPayView["confirmations"] => {
  const shownByBill = new Map<BillId | null, number>()
  return rows
    .filter(({ billId }) => {
      const shown = shownByBill.get(billId) ?? 0
      shownByBill.set(billId, shown + 1)
      return shown < MAX_CONFIRMATIONS_PER_BILL
    })
    .map(({ pointer, amount, currency, claimedAt }) => ({
      pointerHash: deriveSelfPayPointerHash(pointer),
      amount,
      currency,
      at: Math.floor(claimedAt / 1000),
    }))
}

export const projectTableSelfPayView = ({
  tableName,
  bills,
  confirmations,
  offered,
  instructions,
}: {
  readonly tableName: string
  readonly bills: ReadonlyArray<TableSelfPayBillRow>
  readonly confirmations: ReadonlyArray<TableSelfPayConfirmationRow>
  readonly offered: ReadonlyMap<BillId, SelfPayReference>
  readonly instructions: SelfPayInstructions
}): SelfPayView =>
  fitSelfPayViewIntoEvent({
    v: 1,
    table: tableName,
    enabled: true,
    ...instructions,
    bills: bills.flatMap((row) => {
      const reference = offered.get(row.id)
      return row.deviceId === null || reference === undefined
        ? []
        : [projectSelfPayViewBill(row, reference)]
    }),
    confirmations: projectSelfPayConfirmations(confirmations),
  })
