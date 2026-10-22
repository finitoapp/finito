import { createIdFromString } from "@evolu/common"

import type { BillId } from "../bill/bill-types.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import type { ItemRow } from "../item/item.ts"
import type { ItemLineType } from "../item/item-types.ts"
import { NonNegativeInteger, PositiveNumber } from "../shared/schema.ts"
import type { BillLineRow } from "./bill-line.ts"
import type { BillLineSummary } from "./bill-line-summary.ts"
import type { BillLineSummaryId } from "./bill-line-types.ts"

interface BillLineSummaryIdentityInput {
  readonly billId: BillId
  readonly catalogItemId: BillLineSummary["catalogItemId"]
  readonly itemId: BillLineSummary["itemId"]
  readonly type: ItemLineType
}

/**
 * Measured before anyone optimises it: the `JSON.stringify` + SHA-256 here is
 * 70–100% of `calculateBillLineSummaries`' own cost, and the projection is
 * still 0.065 ms for a 20-line bill, 0.6 ms at 200 lines, 6.3 ms at 2000.
 * A 30-bill floor view costs 1.8 ms for the whole list, and each card
 * `useMemo`s on its own row, so that is a first paint rather than a frame
 * cost. Nothing here is worth a cache; if it ever is, note that every line of
 * the same item re-hashes the same four fields, so a `Map` on that tuple is
 * the cheap win.
 */
export const createBillLineSummaryId = (
  input: BillLineSummaryIdentityInput
): BillLineSummaryId =>
  createIdFromString<"BillLineSummary">(
    JSON.stringify({
      billId: input.billId,
      catalogItemId: input.catalogItemId,
      itemId: input.itemId,
      type: input.type,
    })
  )

export const calculateBillLineSummaries = (
  lineRows: ReadonlyArray<BillLineRow>,
  itemRows: ReadonlyArray<ItemRow>
): ReadonlyArray<BillLineSummary> => {
  const itemsById = new Map(itemRows.map((item) => [item.id, item]))
  const projected = new Map<BillLineSummaryId, BillLineSummary>()

  for (const line of lineRows) {
    const item = itemsById.get(line.itemId)
    if (item === undefined) {
      continue
    }

    const idValue = createBillLineSummaryId({
      billId: line.billId,
      catalogItemId: line.catalogItemId,
      itemId: line.itemId,
      type: line.type,
    })
    const amounts = foldBillLineAmounts(projected.get(idValue), line)

    if (amounts === null) {
      projected.delete(idValue)
      continue
    }

    projected.set(idValue, {
      id: idValue,
      billId: line.billId,
      catalogItemId: line.catalogItemId,
      itemId: line.itemId,
      type: line.type,
      name: item.name,
      description: item.description,
      currency: item.currency,
      ...amounts,
      taxRateId: item.taxRateId,
    })
  }

  return [...projected.values()]
}

const foldBillLineAmounts = (
  existing: Pick<BillLineSummary, "quantity" | "totalAmount"> | undefined,
  line: Pick<BillLineRow, "kind" | "quantity" | "totalAmount">
): Pick<BillLineSummary, "quantity" | "totalAmount"> | null => {
  const direction = line.kind === "add" ? 1 : -1
  const nextQuantity = (existing?.quantity ?? 0) + direction * line.quantity
  const nextTotalAmount =
    (existing?.totalAmount ?? 0) + direction * line.totalAmount

  return nextQuantity <= 0
    ? null
    : {
        quantity: PositiveNumber(nextQuantity),
        totalAmount: NonNegativeInteger(Math.max(0, nextTotalAmount)),
      }
}

type BillEditLine = Pick<
  BillLineRow,
  | "billId"
  | "catalogItemId"
  | "itemId"
  | "type"
  | "kind"
  | "quantity"
  | "totalAmount"
>

export const deriveBillLineAmountsAfterLines = (
  summaries: ReadonlyArray<BillLineSummary>,
  lines: ReadonlyArray<BillEditLine>
): ReadonlyMap<
  BillLineSummaryId,
  Pick<BillLineSummary, "quantity" | "totalAmount">
> => {
  const amounts = new Map<
    BillLineSummaryId,
    Pick<BillLineSummary, "quantity" | "totalAmount">
  >(summaries.map((summary) => [summary.id, summary]))

  for (const line of lines) {
    const idValue = createBillLineSummaryId(line)
    const next = foldBillLineAmounts(amounts.get(idValue), line)
    if (next === null) {
      amounts.delete(idValue)
    } else {
      amounts.set(idValue, next)
    }
  }
  return amounts
}

export const deriveBillTotalAfterLines = (
  summaries: ReadonlyArray<BillLineSummary>,
  lines: ReadonlyArray<BillEditLine>
): NonNegativeInteger =>
  NonNegativeInteger(
    [...deriveBillLineAmountsAfterLines(summaries, lines).values()].reduce(
      (sum, { totalAmount }) => sum + totalAmount,
      0
    )
  )

/**
 * A bill's item count and total, from its already-calculated summaries —
 * shared by every occupancy-style tile/row that shows just those two numbers
 * (the POS floor view's `OccupiedTableSummary`, the split dialog's
 * existing-bill picker) so none of them re-derives its own reduce.
 */
export const deriveBillSummaryStats = (
  summaries: ReadonlyArray<BillLineSummary>
): {
  readonly itemCount: number
  readonly totalAmount: NonNegativeInteger
} => ({
  itemCount: summaries.reduce((sum, summary) => sum + summary.quantity, 0),
  totalAmount: deriveBillSummaryTotal(summaries),
})

/**
 * What a bill's lines add up to. Split out of {@link deriveBillSummaryStats}
 * because most callers want only this half — a bill total feeds coverage
 * (`deriveBillCoverage`), the payment amount, and every "is this bill paid"
 * derivation, none of which care how many items produced it.
 */
export const deriveBillSummaryTotal = (
  summaries: ReadonlyArray<BillLineSummary>
): NonNegativeInteger =>
  NonNegativeInteger(
    summaries.reduce((sum, summary) => sum + summary.totalAmount, 0)
  )

export interface BillLineSummaryChange {
  readonly before: BillLineSummary
  readonly after: BillLineSummary
}

export interface BillLineSummaryDiff {
  readonly added: ReadonlyArray<BillLineSummary>
  readonly removed: ReadonlyArray<BillLineSummary>
  readonly changed: ReadonlyArray<BillLineSummaryChange>
}

/**
 * Compares two `BillLineSummary` snapshots — typically a payment's frozen
 * `paymentLine` snapshot (`expected`, see `paymentLinesToBillLineSummaries`)
 * against the bill's live summaries (`current`, see
 * `calculateBillLineSummaries`) — and reports what changed between them.
 *
 * Matches first on the summary's own id — `createBillLineSummaryId`, over
 * `(billId, catalogItemId, itemId, type)`. An exact match with an unchanged
 * `quantity`/`totalAmount` is not reported at all; one whose amount differs
 * (more/fewer of the same exact item) is `changed`.
 *
 * Deliberately *not* keyed on `itemId` alone, even though that is the
 * content-addressed "same name, description, currency and unit price" identity
 * this comment used to point at. `createItemIdFromSnapshot` leaves the line's
 * `type` out of that hash, so a tip and a manual amount with the same name and
 * amount share one `itemId` while being two separate lines. Keying on it
 * collapsed them: a tip whose total had moved was reported as the *manual
 * amount* having turned into it, and the manual-amount line vanished from the
 * diff — or, with one on each side, an equal tip-for-manual-amount swap read
 * as "nothing changed".
 *
 * A line present on only one side is then correlated by `catalogItemId` (the
 * menu item's identity, independent of its price) against the lines present
 * only on the other — this is what turns "removed: old-price Coffee, added:
 * new-price Coffee" into a single `changed` entry instead of an
 * unrelated-looking add and remove. Correlation candidates are grouped as a
 * *list* per catalog item, consumed in order: the same menu item can sit on
 * the bill under several price snapshots at once (repriced twice while a
 * payment was outstanding), and keeping only one candidate per catalog item
 * paired one of them and left the rest reading as an unrelated add + remove.
 * Both sides arrive in the fold's own deterministic order, so the pairing is
 * stable. Only what's left after that is a genuine `added`/`removed`. See
 * docs/bill-payment-states.md.
 */
export const deriveBillLineSummaryDiff = (
  expected: ReadonlyArray<BillLineSummary>,
  current: ReadonlyArray<BillLineSummary>
): BillLineSummaryDiff => {
  const currentById = new Map(current.map((summary) => [summary.id, summary]))
  const matchedCurrentIds = new Set<BillLineSummary["id"]>()

  const changed: BillLineSummaryChange[] = []
  const unmatchedExpected: BillLineSummary[] = []

  for (const before of expected) {
    const after = currentById.get(before.id)
    if (after === undefined) {
      unmatchedExpected.push(before)
      continue
    }

    matchedCurrentIds.add(after.id)
    if (
      after.quantity !== before.quantity ||
      after.totalAmount !== before.totalAmount
    ) {
      changed.push({ before, after })
    }
  }

  const unmatchedCurrent = current.filter(
    (summary) => !matchedCurrentIds.has(summary.id)
  )
  // A list per catalog item, not one entry: see the doc comment above.
  const candidatesByCatalogItemId = new Map<
    NonNullable<BillLineSummary["catalogItemId"]>,
    BillLineSummary[]
  >()
  for (const summary of unmatchedCurrent) {
    if (summary.catalogItemId === null) continue
    const candidates = candidatesByCatalogItemId.get(summary.catalogItemId)
    if (candidates === undefined) {
      candidatesByCatalogItemId.set(summary.catalogItemId, [summary])
    } else {
      candidates.push(summary)
    }
  }

  const removed: BillLineSummary[] = []
  const claimedCurrentIds = new Set<BillLineSummary["id"]>()

  for (const before of unmatchedExpected) {
    // `shift` consumes the candidate so the next expected line for the same
    // catalog item pairs with the following one instead of re-claiming it.
    const after =
      before.catalogItemId === null
        ? undefined
        : candidatesByCatalogItemId.get(before.catalogItemId)?.shift()
    if (after === undefined) {
      removed.push(before)
      continue
    }

    changed.push({ before, after })
    claimedCurrentIds.add(after.id)
  }

  const added = unmatchedCurrent.filter(
    (summary) => !claimedCurrentIds.has(summary.id)
  )

  return { added, removed, changed }
}

/**
 * Returns the most recently represented snapshot for a catalog item. A cart
 * can retain more than one snapshot when a catalog item changes after it was
 * added, so decrementing must target a persisted summary rather than rebuild
 * the snapshot from the catalog's current values.
 */
export const getLatestCatalogItemSummary = (
  summaries: ReadonlyArray<BillLineSummary>,
  catalogItemId: CatalogItemId
): BillLineSummary | undefined =>
  summaries.findLast((summary) => summary.catalogItemId === catalogItemId)

/**
 * What one unit of a cart line costs, used to build a "remove one" line and to
 * price a partial split selection.
 *
 * Rounded, because the division does not reliably land on an integer even when
 * the line is perfectly ordinary. `quantity` is a `PositiveNumber`, not an
 * integer — `addCatalogItemToBill` and `bin/cli-bills.ts add-item` both accept
 * a fractional one — and 0.7 of a 2000 item stores a clean total of 1400 whose
 * `1400 / 0.7` is `2000.0000000000002` in IEEE 754. Decoding that straight
 * through `NonNegativeInteger` threw, while the operator was doing nothing
 * more exotic than tapping "remove" on that line.
 *
 * For a total that genuinely does not divide, the nearest minor unit is the
 * only answer available — money has no fractional one.
 */
export const getBillLineSummaryUnitAmount = (summary: BillLineSummary) =>
  NonNegativeInteger(Math.round(summary.totalAmount / summary.quantity))
