import type { BillLineRow } from "../bill-line/bill-line.ts"
import {
  calculateBillLineSummaries,
  deriveBillSummaryTotal,
} from "../bill-line/bill-line-utils.ts"
import type { ItemRow } from "../item/item.ts"
import { TimestampMs } from "../shared/schema.ts"
import type { SyncClockHex } from "./bill-types.ts"
import { type ClaimedTransaction, calculateClaimedSum } from "./bill-utils.ts"

export interface ClosingLine {
  readonly row: BillLineRow
  readonly clock: SyncClockHex
}

export interface ClosingClaim {
  readonly transaction: ClaimedTransaction
  readonly startClock: SyncClockHex
  readonly endClock: SyncClockHex | null
}

const CLOSED_AT_TOLERANCE_MS = 60_000

export const syncClockMillis = (clock: SyncClockHex): TimestampMs =>
  TimestampMs(Number.parseInt(clock.slice(0, 12), 16))

export const deriveCoveredSinceClock = ({
  lines,
  items,
  claims,
}: {
  readonly lines: ReadonlyArray<ClosingLine>
  readonly items: ReadonlyArray<ItemRow>
  readonly claims: ReadonlyArray<ClosingClaim>
}): SyncClockHex | null => {
  const sortedLines = [...lines].sort((a, b) =>
    a.clock < b.clock ? -1 : Number(a.clock > b.clock)
  )
  const clocks = [
    ...new Set([
      ...lines.map(({ clock }) => clock),
      ...claims.map(({ startClock }) => startClock),
      ...claims.flatMap(({ endClock }) =>
        endClock === null ? [] : [endClock]
      ),
    ]),
  ].sort()

  let coveredSince: SyncClockHex | null = null
  for (const clock of clocks) {
    const total = deriveBillSummaryTotal(
      calculateBillLineSummaries(
        sortedLines.filter((line) => line.clock <= clock).map(({ row }) => row),
        items
      )
    )
    const active = claims
      .filter(
        ({ startClock, endClock }) =>
          startClock <= clock && (endClock === null || endClock > clock)
      )
      .map(({ transaction }) => transaction)
    const isCovered = active.length > 0 && calculateClaimedSum(active) >= total
    coveredSince = isCovered ? (coveredSince ?? clock) : null
  }
  return coveredSince
}

export const deriveClosedAtCorrection = ({
  closedAt,
  coveredSince,
}: {
  readonly closedAt: TimestampMs | null
  readonly coveredSince: SyncClockHex | null
}): { readonly closedAt: TimestampMs | null } | null => {
  if (coveredSince === null)
    return closedAt === null ? null : { closedAt: null }
  const moment = syncClockMillis(coveredSince)
  return closedAt === null ||
    Math.abs(closedAt - moment) > CLOSED_AT_TOLERANCE_MS
    ? { closedAt: moment }
    : null
}
