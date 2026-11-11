import {
  err,
  type InsertValues,
  type MutationOptions,
  ok,
  type Result,
  type Task,
  type UpdateValues,
  type UpsertValues,
} from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { BillLineRow, billLine } from "../bill-line/bill-line.ts"
import {
  insertBillLineRows,
  loadCalculatedBillLineSummaries,
} from "../bill-line/bill-line-actions.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import {
  calculateBillLineSummaries,
  createBillLineSummaryId,
} from "../bill-line/bill-line-utils.ts"
import {
  type CatalogItemNotFoundError,
  createCatalogItemNotFoundError,
} from "../catalog-item/catalog-item-actions.ts"
import { catalogItemByIdQuery } from "../catalog-item/catalog-item-queries.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import type { ItemRow, item } from "../item/item.ts"
import { upsertItemSnapshot } from "../item/item-actions.ts"
import type { ItemLineType } from "../item/item-types.ts"
import {
  createCatalogItemSnapshot,
  createStandaloneItemSnapshot,
} from "../item/item-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { roundMinorUnits } from "../shared/money.ts"
import { getFirstOr } from "../shared/result.ts"
import {
  type Integer,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  type TimestampMs,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { BillRow, bill } from "./bill.ts"
import {
  type BillLineRemovalOutOfRangeError,
  type BillLockedError,
  type BillNotCanceledError,
  type BillNotFoundError,
  type BillSplitSelectionStaleError,
  type BillSplitTotalNegativeError,
  type BillStatusNotAllowedError,
  type BillStatusSnapshot,
  type BillTotalBelowPaidError,
  type BillUnderpaidError,
  type BillWithItems,
  type CartWrite,
  type CartWriteBill,
  createBillNotCanceledError,
  createBillStatusNotAllowedError,
  createBillUnderpaidError,
  loadBillStatusSnapshot,
  requireCancelableBill,
  requireCartWriteNotBelowPaid,
  requireEditableBill,
  requireRemovalWithinLine,
  requireSelectionOnSourceBill,
  requireSplitTotalNotNegative,
  type SelectedLineTotals,
} from "./bill-guards.ts"
import { lastBillDisplayNumberQuery, openBillsQuery } from "./bill-queries.ts"
import type { BillId } from "./bill-types.ts"
import { deriveZeroBillRefusal, type ZeroBillRefusal } from "./bill-utils.ts"

const createBillLineSummaryMissingError = defineError(
  "BillLineSummaryMissing"
)<{
  readonly billId: BillId
  readonly itemId: BillLineSummary["itemId"]
  readonly lineType: BillLineSummary["type"]
}>()
export type BillLineSummaryMissingError = ReturnType<
  typeof createBillLineSummaryMissingError
>
/**
 * What every write to a bill's cart can be refused with: the editing guard's
 * errors (`requireEditableBill`), and a total that would drop below what the
 * bill's payments have paid (`requireCartWriteNotBelowPaid`, payment/0014).
 */
export type CartWriteError =
  | BillNotFoundError
  | BillStatusNotAllowedError
  | BillLockedError
  | BillTotalBelowPaidError
const createCatalogItemPriceSignStaleError = defineError(
  "CatalogItemPriceSignStale"
)<{
  readonly id: CatalogItemId
  readonly expectedDiscount: boolean
}>()
/**
 * The catalog item `addCatalogItemToBill` reloaded is a discount where the
 * caller saw none, or the other way round: the cart judged `discard` on a
 * row that is no longer what the core would write (access/0012).
 */
export type CatalogItemPriceSignStaleError = ReturnType<
  typeof createCatalogItemPriceSignStaleError
>
/** `appendRemoveBillLine`'s refusals. */
export type RemoveBillLineError =
  | CartWriteError
  | BillLineRemovalOutOfRangeError
/** Every refusal a write from the cart can meet, the ones a toast maps. */
export type AddBillLineError =
  | CatalogItemNotFoundError
  | CatalogItemPriceSignStaleError
  | BillLineSummaryMissingError
  | RemoveBillLineError
const createBillSplitSameBillError = defineError("BillSplitSameBill")<{
  readonly id: BillId
}>()
/**
 * A split whose source and target are the same bill: it would write every
 * line's removal and addition onto one bill, judged as two, and could cancel
 * the bill as emptied.
 */
export type BillSplitSameBillError = ReturnType<
  typeof createBillSplitSameBillError
>
export type SplitBillError =
  | CartWriteError
  | BillSplitSameBillError
  | BillSplitSelectionStaleError
  | BillSplitTotalNegativeError
export const createBill =
  (
    input: Pick<
      InsertValues<typeof bill>,
      "deviceId" | "displayNumber" | "label" | "tableId" | "currency"
    >
  ): Task<BillId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    const { id } = await runMutationWithCompletion((options) =>
      run.deps.evolu.insert("bill", removeUndefinedValues({ ...input }), {
        ...options,
        owner: evoluOwner,
      })
    )

    return ok(id)
  }
/**
 * Loads the highest existing bill display number (across every bill ever
 * created, not just currently-open ones, so numbers are never reused) and
 * computes the next one, without writing it. Exported so callers that need
 * to fold the bill upsert into a larger mutation batch (e.g.
 * `splitBillIntoNewBill`) can reuse this instead of duplicating it — mirrors
 * `payment-number-actions.ts`'s `loadNextPaymentNumber`.
 */
const loadNextBillDisplayNumber =
  (): Task<PositiveInteger, never, EvoluDep> => async (run) => {
    const [last] = await run.deps.evolu.loadQuery(lastBillDisplayNumberQuery)
    const lastDisplayNumber = last?.displayNumber ?? 0

    return ok(PositiveInteger(lastDisplayNumber + 1))
  }
/**
 * Creates a bill at an `id` the caller already chose — the cart UI generates
 * it client-side and puts it in the `/bill` URL before this ever runs, so the
 * URL stays stable across the lazy-creation moment (see `use-cart-bill.ts`'s
 * `ensureBillExists`). Upserts rather than inserts for that reason: `id` is
 * known ahead of time instead of coming back from the write.
 */
export const createBillAtEnd =
  (
    input: Pick<
      UpsertValues<typeof bill>,
      "id" | "deviceId" | "label" | "tableId" | "currency"
    >
  ): Task<BillId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps
    const displayNumber = await run.ok(loadNextBillDisplayNumber())

    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "bill",
        removeUndefinedValues({ ...input, displayNumber }),
        { ...options, owner: evoluOwner }
      )
    )

    return ok(input.id)
  }
export const assignBillToTable =
  (
    input: Pick<UpdateValues<typeof bill>, "id" | "tableId">
  ): Task<BillId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "bill",
        {
          id: input.id,
          tableId: input.tableId,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(input.id)
  }
export const removeTableFromBill =
  (billId: BillId): Task<BillId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "bill",
        { id: billId, tableId: null },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(billId)
  }
/**
 * The current time as the `closedAt` a cart write closing a bill writes.
 */
const nowTimestamp = (run: { readonly deps: DateDep }): TimestampMs =>
  TimestampMsSchema.decode(run.deps.date.now().getTime())

/**
 * One bill's part of a judged cart write: its lines, and the `closedAt`
 * `requireCartWriteNotBelowPaid` asked for, `null` when the bill stays open.
 */
interface JudgedCartWrite {
  readonly billId: BillId
  readonly lines: ReadonlyArray<Omit<BillLineRow, "id">>
  readonly closedAt: TimestampMs | null
}

/**
 * Inserts judged cart writes into the caller's batch, each bill's `closedAt`
 * beside its lines — so a write that pays a partly paid bill off never lands
 * without the cache that takes it off the floor view (payment/0014).
 */
const insertCartWrite = (
  evolu: EvoluDep["evolu"],
  writes: ReadonlyArray<JudgedCartWrite>,
  options: MutationOptions
): void => {
  for (const { billId, lines, closedAt } of writes) {
    insertBillLineRows(evolu, lines, options)
    if (closedAt !== null) upsertBillClosedAt(evolu, billId, closedAt, options)
  }
}

/**
 * Whether judged cart writes put anything in a batch at all: an empty batch
 * would never resolve (`runMutationWithCompletion`).
 */
const hasCartWrite = (writes: ReadonlyArray<JudgedCartWrite>): boolean =>
  writes.some(({ lines, closedAt }) => lines.length > 0 || closedAt !== null)

/**
 * The cart write behind `appendRemoveBillLine` and `appendGuardedBillLines`:
 * judges `lines` against the bill `requireEditableBill` just approved, writes
 * them together with any `closedAt` they bring, and reads back the bill's
 * summaries.
 */
const appendCartLines =
  (
    bill: BillStatusSnapshot,
    lines: ReadonlyArray<Omit<BillLineRow, "id">>
  ): Task<
    ReadonlyArray<BillLineSummary>,
    BillTotalBelowPaidError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billId = bill.bill.id
    const closedAtResult = requireCartWriteNotBelowPaid(
      bill,
      { lines, itemRows: [] },
      nowTimestamp(run)
    )
    if (!closedAtResult.ok) return closedAtResult

    const writes: ReadonlyArray<JudgedCartWrite> = [
      { billId, lines, closedAt: closedAtResult.value },
    ]
    if (hasCartWrite(writes)) {
      const { evoluOwner } = run.deps
      await runMutationWithCompletion((options) =>
        insertCartWrite(run.deps.evolu, writes, {
          ...options,
          owner: evoluOwner,
        })
      )
    }

    return ok(await run.ok(loadCalculatedBillLineSummaries(billId)))
  }

/**
 * Shared "insert a snapshot + an `add` bill line for it, then read back the
 * resulting summary" step behind `addCatalogItemToBill`, `addManualAmountToBill`,
 * and `addTipToBill` — they differ only in the line's `type` and how its
 * snapshot/detail fields are produced. Judges the line against `bill`, the
 * snapshot the caller's `requireEditableBill` approved, like every cart write
 * (`requireCartWriteNotBelowPaid`).
 */
const addBillLine =
  <TType extends ItemLineType>(
    bill: BillStatusSnapshot,
    type: TType,
    snapshot: ItemRow,
    line: Pick<
      BillLineRow,
      "billId" | "deviceId" | "catalogItemId" | "quantity" | "totalAmount"
    >
  ): Task<
    BillLineSummary,
    BillLineSummaryMissingError | BillTotalBelowPaidError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps
    const write: CartWrite = {
      lines: [{ ...line, itemId: snapshot.id, type, kind: "add" }],
      itemRows: [snapshot],
    }
    const closedAtResult = requireCartWriteNotBelowPaid(
      bill,
      write,
      nowTimestamp(run)
    )
    if (!closedAtResult.ok) return closedAtResult

    await runMutationWithCompletion((options) => {
      upsertItemSnapshot(run.deps.evolu, snapshot, {
        ...options,
        owner: evoluOwner,
      })
      insertCartWrite(
        run.deps.evolu,
        [
          {
            billId: line.billId,
            lines: write.lines,
            closedAt: closedAtResult.value,
          },
        ],
        { ...options, owner: evoluOwner }
      )
    })

    // Matched on the summary's full identity, not on `itemId` alone: `item`
    // ids are content-addressed over name/description/currency/unitAmount/
    // taxRateId and deliberately exclude the line's `type` (see
    // `createItemIdFromSnapshot`), so a tip and a manual amount with the same
    // name and amount share one `item` row while staying two separate
    // summaries. Finding by `itemId` returned whichever of them the fold
    // happened to project first — `addTipToBill` handing back the bill's
    // manual-amount line. `createBillLineSummaryId` is the same identity the
    // fold keys those summaries by, and what `appendRemoveBillLine` already
    // matches on.
    const summaryId = createBillLineSummaryId({
      billId: line.billId,
      catalogItemId: line.catalogItemId,
      itemId: snapshot.id,
      type,
    })
    const projected = await run.ok(loadCalculatedBillLineSummaries(line.billId))
    const lineSummary = projected.find((row) => row.id === summaryId)

    return lineSummary === undefined
      ? err(
          createBillLineSummaryMissingError({
            billId: line.billId,
            itemId: snapshot.id,
            lineType: type,
          })
        )
      : ok(lineSummary)
  }
/**
 * What `addCatalogItemToBill` wrote: the `add` line itself, priced the way the
 * core priced it, and the bill's net line it now belongs to.
 *
 * The line is handed back so a caller that can undo the add (`use-cart-bill.ts`)
 * records the very amount that was written rather than recomputing it from
 * the catalog row it rendered: the core reloads that row, which may carry a
 * new price by then, and rounds a fractional quantity (`roundMinorUnits`).
 */
export interface AddedCatalogItem {
  readonly line: Omit<BillLineRow, "id">
  readonly summary: BillLineSummary
}
export const addCatalogItemToBill =
  (
    input: Pick<
      InsertValues<typeof billLine>,
      "billId" | "deviceId" | "quantity"
    > & {
      readonly catalogItemId: NonNullable<
        InsertValues<typeof billLine>["catalogItemId"]
      >
      /**
       * Whether the caller saw the item as a discount (priced below zero,
       * catalog/0002) when it decided which permission the tap needs: a
       * discount takes `discard` (access/0012). The core reloads the row, so
       * a price whose sign changed since is refused rather than written past
       * that check. `null` from a caller that checks no permission (the
       * CLI, the demo data).
       */
      readonly expectedDiscount: boolean | null
    }
  ): Task<
    AddedCatalogItem,
    AddBillLineError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    // The catalog lookup depends on nothing the guard reads, so it no longer
    // waits behind it: this whole action is one tap on a menu button, and the
    // guard was already the slower half. The bill's own refusal still wins
    // when both fail — pinned by a test, since concurrency is exactly where
    // that order could invert unnoticed.
    const [billResult, catalogItemRows] = await Promise.all([
      run(requireEditableBill(input.billId)),
      run.deps.evolu.loadQuery(catalogItemByIdQuery(input.catalogItemId)),
    ])
    if (!billResult.ok) return billResult

    const catalogItemResult = getFirstOr(
      catalogItemRows,
      createCatalogItemNotFoundError({ id: input.catalogItemId })
    )
    if (!catalogItemResult.ok) return catalogItemResult
    const isDiscount = catalogItemResult.value.unitAmount < 0
    if (
      input.expectedDiscount !== null &&
      isDiscount !== input.expectedDiscount
    ) {
      return err(
        createCatalogItemPriceSignStaleError({
          id: input.catalogItemId,
          expectedDiscount: input.expectedDiscount,
        })
      )
    }

    const snapshot = createCatalogItemSnapshot(catalogItemResult.value)
    const line = {
      billId: input.billId,
      deviceId: input.deviceId ?? null,
      catalogItemId: catalogItemResult.value.id,
      quantity: input.quantity,
      // `quantity` may be fractional; money has no fractional minor unit. A
      // discount's negative price rounds away from zero like a positive one.
      totalAmount: roundMinorUnits(
        catalogItemResult.value.unitAmount * input.quantity
      ),
    }

    const summary = await run(
      addBillLine(billResult.value, "catalogItem", snapshot, line)
    )
    if (!summary.ok) return summary

    return ok({
      line: { ...line, itemId: snapshot.id, type: "catalogItem", kind: "add" },
      summary: summary.value,
    })
  }
/**
 * A typed amount added as a line of its own, with no catalog item behind it:
 * a manual amount or a tip. The two differ only in the line's type.
 */
const addStandaloneAmountToBill =
  (type: Extract<ItemLineType, "manualAmount" | "tip">) =>
  (
    input: Pick<InsertValues<typeof billLine>, "billId" | "deviceId"> &
      Pick<InsertValues<typeof item>, "name" | "currency"> & {
        /**
         * Never below zero, though a bill line's amount may be: only a
         * catalog discount takes a bill down (catalog/0002).
         */
        readonly totalAmount: NonNegativeInteger
      }
  ): Task<
    BillLineSummary,
    BillLineSummaryMissingError | CartWriteError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billResult = await run(requireEditableBill(input.billId))
    if (!billResult.ok) return billResult

    const snapshot = createStandaloneItemSnapshot({
      catalogItemId: null,
      name: input.name,
      description: null,
      currency: input.currency,
      unitAmount: input.totalAmount,
      taxRateId: null,
    })

    return run(
      addBillLine(billResult.value, type, snapshot, {
        billId: input.billId,
        deviceId: input.deviceId ?? null,
        catalogItemId: null,
        quantity: PositiveNumber(1),
        totalAmount: input.totalAmount,
      })
    )
  }
export const addManualAmountToBill = addStandaloneAmountToBill("manualAmount")
export const addTipToBill = addStandaloneAmountToBill("tip")
export const appendRemoveBillLine =
  (
    input: Pick<
      InsertValues<typeof billLine>,
      "billId" | "deviceId" | "quantity" | "totalAmount"
    > & {
      readonly lineSummary: BillLineSummary
    }
  ): Task<
    BillLineSummary | null,
    RemoveBillLineError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billResult = await run(requireEditableBill(input.billId))
    if (!billResult.ok) return billResult

    // Judged against the line as the bill holds it now, not the summary the
    // caller read: the CLI takes any amount, and a screen may be stale.
    const removalResult = requireRemovalWithinLine(
      input.billId,
      billResult.value.items,
      {
        summaryId: input.lineSummary.id,
        quantity: input.quantity,
        totalAmount: input.totalAmount,
      }
    )
    if (!removalResult.ok) return removalResult

    const projected = await run(
      appendCartLines(billResult.value, [
        {
          billId: input.billId,
          deviceId: input.deviceId ?? null,
          catalogItemId: input.lineSummary.catalogItemId,
          itemId: input.lineSummary.itemId,
          type: input.lineSummary.type,
          kind: "remove",
          quantity: input.quantity,
          totalAmount: input.totalAmount,
        },
      ])
    )
    if (!projected.ok) return projected
    return ok(
      projected.value.find((row) => row.id === input.lineSummary.id) ?? null
    )
  }
/**
 * Every open bill with its calculated line items, in one query — `lines` and
 * `items` ride along on `openBillsQuery` (see its doc comment), so this no
 * longer loads summaries per bill. `lines`/`items` are stripped off the
 * returned `bill` so it stays a plain `BillRow`: `bin/cli-bills.ts` spreads it
 * straight into `console.table`.
 */
export const listOpenBills =
  (): Task<ReadonlyArray<BillWithItems>, never, EvoluDep> => async (run) => {
    const bills = await run.deps.evolu.loadQuery(openBillsQuery)

    return ok(
      bills.map(
        ({ lines, items, ...bill }): BillWithItems => ({
          bill,
          items: calculateBillLineSummaries(lines, items),
        })
      )
    )
  }
interface SplitLines {
  readonly source: ReadonlyArray<Omit<BillLineRow, "id">>
  readonly target: ReadonlyArray<Omit<BillLineRow, "id">>
}

/**
 * The move itself: a "remove" row on `sourceBillId` and an "add" row on
 * `targetBillId` for each item, shared by `splitBill` and
 * `splitBillIntoNewBill`, which differ only in how they guard/write it.
 */
const buildSplitLines = (
  sourceBillId: BillId,
  targetBillId: BillId,
  items: ReadonlyArray<BillLineSummary>
): SplitLines => {
  const lineOn = (
    billId: BillId,
    kind: BillLineRow["kind"],
    item: BillLineSummary
  ): Omit<BillLineRow, "id"> => ({
    billId,
    deviceId: null,
    catalogItemId: item.catalogItemId,
    itemId: item.itemId,
    type: item.type,
    kind,
    quantity: item.quantity,
    totalAmount: item.totalAmount,
  })
  return {
    source: items.map((item) => lineOn(sourceBillId, "remove", item)),
    target: items.map((item) => lineOn(targetBillId, "add", item)),
  }
}
/**
 * Checks whether moving the selection off `currentSummaries` would leave the
 * bill with no line items at all and, if so, writes the same `canceledAt`
 * field `cancelBill` does, folded into the caller's own mutation batch
 * instead of opening a second one. Returns whether it canceled, so a caller
 * that needs to know (e.g. to decide whether the UI should navigate away) can
 * read it off the result.
 *
 * Takes the already-summed selection from `requireSelectionOnSourceBill` —
 * building its own map keyed by id used to keep only the *last* entry per
 * line, so two partial quantities of one line (2 + 3 of a five-quantity
 * line) compared as 3 >= 5 and left a fully emptied bill open.
 */
const cancelSourceBillIfEmptied = (
  evolu: EvoluDep["evolu"],
  sourceBillId: BillId,
  currentSummaries: ReadonlyArray<BillLineSummary>,
  selectedById: ReadonlyMap<BillLineSummary["id"], SelectedLineTotals>,
  now: TimestampMs,
  options: MutationOptions
): boolean => {
  // `every` is vacuously true on an empty list, so the length check is what
  // keeps "nothing was there to move" from reading as "everything moved
  // out": a bill with no lines would otherwise be canceled without anything
  // actually being emptied out of it. `requireSelectionOnSourceBill` now
  // rejects a non-empty selection against an empty bill before this runs, so
  // no caller can reach that state — kept because this decision should hold
  // on its own terms rather than on its caller having validated first.
  const sourceCanceled =
    currentSummaries.length > 0 &&
    currentSummaries.every(
      (summary) =>
        (selectedById.get(summary.id)?.quantity ?? 0) >= summary.quantity
    )
  if (sourceCanceled) {
    evolu.update("bill", { id: sourceBillId, canceledAt: now }, options)
  }
  return sourceCanceled
}
/**
 * Judges a split's lines on both bills, the source first: neither may be left
 * with lines and a total below zero (`requireSplitTotalNotNegative`,
 * payment/0015), nor below what its payments have paid
 * (`requireCartWriteNotBelowPaid`). Hands back each bill's lines with the
 * `closedAt` they bring, for `insertCartWrite`. `target` is `newSplitBill` when
 * the split creates it.
 */
const judgeSplitWrites = (
  source: CartWriteBill,
  target: CartWriteBill,
  lines: SplitLines,
  now: TimestampMs
): Result<
  ReadonlyArray<JudgedCartWrite>,
  BillTotalBelowPaidError | BillSplitTotalNegativeError
> => {
  const sourceWrite: CartWrite = { lines: lines.source, itemRows: [] }
  // The target's new lines refer to the source's item snapshots.
  const targetWrite: CartWrite = {
    lines: lines.target,
    itemRows: source.ledger.itemRows,
  }

  const sourceNotNegative = requireSplitTotalNotNegative(
    source.bill.id,
    source.ledger,
    sourceWrite
  )
  if (!sourceNotNegative.ok) return sourceNotNegative
  const targetNotNegative = requireSplitTotalNotNegative(
    target.bill.id,
    target.ledger,
    targetWrite
  )
  if (!targetNotNegative.ok) return targetNotNegative

  const sourceClosedAt = requireCartWriteNotBelowPaid(source, sourceWrite, now)
  if (!sourceClosedAt.ok) return sourceClosedAt
  const targetClosedAt = requireCartWriteNotBelowPaid(target, targetWrite, now)
  if (!targetClosedAt.ok) return targetClosedAt

  return ok([
    {
      billId: source.bill.id,
      lines: sourceWrite.lines,
      closedAt: sourceClosedAt.value,
    },
    {
      billId: target.bill.id,
      lines: targetWrite.lines,
      closedAt: targetClosedAt.value,
    },
  ])
}

/**
 * The bill `splitBillIntoNewBill` creates, as `judgeSplitWrites` reads it: no
 * lines and no payment yet, so its write always keeps it open.
 */
const newSplitBill = (id: BillId): CartWriteBill => ({
  bill: { id, closedAt: null },
  ledger: { lineRows: [], itemRows: [] },
  claimedSum: NonNegativeInteger(0),
  hasActiveClaim: false,
})
export const splitBill =
  (input: {
    readonly sourceBillId: BillId
    readonly targetBillId: BillId
    readonly items: ReadonlyArray<BillLineSummary>
  }): Task<
    BillWithItems & { readonly sourceCanceled: boolean },
    SplitBillError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    if (input.sourceBillId === input.targetBillId) {
      return err(createBillSplitSameBillError({ id: input.sourceBillId }))
    }

    // Both guards run concurrently; neither depends on the other. The
    // source's current summaries are not loaded separately alongside them —
    // `requireEditableBill` derives the bill's status from that exact
    // projection and hands it back, so `cancelSourceBillIfEmptied` below
    // judges emptiness against the same read the guard just approved rather
    // than a second, concurrent one that could disagree with it.
    const [sourceBillResult, targetBillResult] = await Promise.all([
      run(requireEditableBill(input.sourceBillId)),
      run(requireEditableBill(input.targetBillId)),
    ])
    if (!sourceBillResult.ok) return sourceBillResult
    if (!targetBillResult.ok) return targetBillResult

    const currentSourceSummaries = sourceBillResult.value.items
    const selectionResult = requireSelectionOnSourceBill(
      input.sourceBillId,
      currentSourceSummaries,
      input.items
    )
    if (!selectionResult.ok) return selectionResult

    const now = nowTimestamp(run)
    // Both bills are judged, the source first: taking lines off a partly paid
    // source may pay it off or take it below what was paid, and so may adding
    // them to a partly paid target once a line can be worth less than nothing.
    const writesResult = judgeSplitWrites(
      sourceBillResult.value,
      targetBillResult.value,
      buildSplitLines(input.sourceBillId, input.targetBillId, input.items),
      now
    )
    if (!writesResult.ok) return writesResult
    const writes = writesResult.value
    const { evoluOwner } = run.deps

    // An empty selection has nothing to write, and an empty batch would
    // never resolve — see `runMutationWithCompletion`. `appendBillLines`
    // guards its own batch the same way. With no line moved off the source,
    // `cancelSourceBillIfEmptied` could only ever answer `false` anyway.
    const sourceCanceled = !hasCartWrite(writes)
      ? false
      : await runMutationWithCompletion((options) => {
          insertCartWrite(run.deps.evolu, writes, {
            ...options,
            owner: evoluOwner,
          })
          return cancelSourceBillIfEmptied(
            run.deps.evolu,
            input.sourceBillId,
            currentSourceSummaries,
            selectionResult.value,
            now,
            { ...options, owner: evoluOwner }
          )
        })

    const targetItems = await run.ok(
      loadCalculatedBillLineSummaries(input.targetBillId)
    )

    return ok({
      bill: targetBillResult.value.bill,
      items: targetItems,
      sourceCanceled,
    })
  }
/**
 * Creates a brand-new bill and, in the same mutation batch, moves the
 * selected `items` off `sourceBillId` onto it — the "split bill" entry point
 * used by the `/bill` UI. One batch instead of `createBillAtEnd` followed by
 * `splitBill`'s own separate one: the target bill's `id` is chosen by the
 * caller (same client-generated-id convention as `createBillAtEnd`), so
 * nothing needs to be read back before the line moves can be written
 * alongside it.
 *
 * `sourceBillId` must still be open and unlocked at the moment this actually
 * runs, not just when the UI opened the split screen — same guard as every
 * other cart-editing action, checked immediately before the write within
 * this same function. See docs/bill-payment-states.md. The new bill needs no
 * such check: it does not exist yet, so it is trivially open.
 *
 * Also auto-cancels `sourceBillId` in the same batch if this move empties it
 * out entirely (e.g. every line fully selected) — same cleanup `splitBill`
 * does, so a full split never leaves a dangling empty open bill behind
 * regardless of which action moved it. The caller always navigates to the
 * new bill either way, so this isn't surfaced in the return value.
 */
export const splitBillIntoNewBill =
  (
    input: Pick<
      UpsertValues<typeof bill>,
      "deviceId" | "tableId" | "currency"
    > & {
      readonly sourceBillId: BillId
      readonly targetBillId: BillId
      readonly items: ReadonlyArray<BillLineSummary>
    }
  ): Task<BillId, SplitBillError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    // Independent reads run concurrently before the mutation batch starts.
    // The source's summaries come off its own guard result — see `splitBill`.
    const [sourceBillResult, displayNumber] = await Promise.all([
      run(requireEditableBill(input.sourceBillId)),
      run.ok(loadNextBillDisplayNumber()),
    ])
    if (!sourceBillResult.ok) return sourceBillResult

    const currentSourceSummaries = sourceBillResult.value.items
    const selectionResult = requireSelectionOnSourceBill(
      input.sourceBillId,
      currentSourceSummaries,
      input.items
    )
    if (!selectionResult.ok) return selectionResult

    const { evoluOwner } = run.deps
    const now = nowTimestamp(run)
    const writesResult = judgeSplitWrites(
      sourceBillResult.value,
      newSplitBill(input.targetBillId),
      buildSplitLines(input.sourceBillId, input.targetBillId, input.items),
      now
    )
    if (!writesResult.ok) return writesResult
    const writes = writesResult.value

    await runMutationWithCompletion((options) => {
      run.deps.evolu.upsert(
        "bill",
        removeUndefinedValues({
          id: input.targetBillId,
          deviceId: input.deviceId,
          label: null,
          tableId: input.tableId,
          currency: input.currency,
          displayNumber,
        }),
        { ...options, owner: evoluOwner }
      )
      insertCartWrite(run.deps.evolu, writes, {
        ...options,
        owner: evoluOwner,
      })
      cancelSourceBillIfEmptied(
        run.deps.evolu,
        input.sourceBillId,
        currentSourceSummaries,
        selectionResult.value,
        now,
        { ...options, owner: evoluOwner }
      )
    })

    return ok(input.targetBillId)
  }
export const cancelBill =
  (
    billId: BillId
  ): Task<
    BillId,
    BillNotFoundError | BillStatusNotAllowedError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billResult = await run(requireCancelableBill(billId))
    if (!billResult.ok) return billResult

    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "bill",
        {
          id: billId,
          canceledAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(billId)
  }
/**
 * Writes the `closedAt` best-effort cache (see `bill.ts`'s doc comment).
 *
 * Thin on purpose, and not inlinable: an actions file writes only its own
 * module's tables (AGENTS.md), and `reconciliation-claim-actions.ts` folds
 * this in via `loadBillClosedAtIfCovered` so the cache lands in the same batch
 * as the claim that closes the bill, rather than a second round trip that
 * could fail on its own. The cart writes here fold it in the same way, beside
 * the lines that pay a partly paid bill off (`insertCartWrite`,
 * payment/0014). See docs/bill-payment-states.md.
 */
export const upsertBillClosedAt = (
  evolu: EvoluDep["evolu"],
  billId: BillId,
  closedAt: BillRow["closedAt"],
  options: MutationOptions
): void => {
  evolu.update("bill", { id: billId, closedAt }, options)
}
/**
 * Manually refreshes a bill's `closedAt` cache (e.g. `bin/cli-bills.ts
 * close`) — a repair tool for the rare multi-device race where the
 * automatic write in `loadBillClosedAtIfCovered` never landed (see
 * `bill.ts`'s doc comment), not a way to force a bill closed. Rejects a
 * `canceled` bill (use `confirmBillClosedDespiteCancellation` for that
 * collision) and one with no active claim yet or still `underpaid` —
 * `docs/bill-payment-states.md` states a bill its payments closed is always
 * `paid` or `overpaid`, never `underpaid`. A bill no payment can settle,
 * its goods coming to zero, is closed with `closeZeroBill` instead.
 */
export const closeBill =
  (
    billId: BillId
  ): Task<
    BillId,
    BillNotFoundError | BillStatusNotAllowedError | BillUnderpaidError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const snapshotResult = await run(loadBillStatusSnapshot(billId))
    if (!snapshotResult.ok) return snapshotResult

    const {
      bill: billRow,
      status,
      coverage,
      billTotal,
      claimedSum,
      hasActiveClaim,
    } = snapshotResult.value

    if (status === "canceled") {
      return err(
        createBillStatusNotAllowedError({
          id: billId,
          status,
          // A repair tool: it refreshes the `closedAt` cache of a bill that is
          // already settled, so an already-`closed` one is fine and only a
          // `canceled` one is not (see `confirmBillClosedDespiteCancellation`
          // for that collision).
          allowedStatuses: ["open", "closed"],
        })
      )
    }
    if (!hasActiveClaim || coverage === "underpaid") {
      return err(
        createBillUnderpaidError({ id: billId, billTotal, claimedSum })
      )
    }

    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      upsertBillClosedAt(
        run.deps.evolu,
        billId,
        billRow.closedAt ??
          TimestampMsSchema.decode(run.deps.date.now().getTime()),
        { ...options, owner: evoluOwner }
      )
    )

    return ok(billId)
  }
/**
 * A bill `closeZeroBill` will not close: it has no lines, a tip line, or
 * goods that do not come to exactly zero.
 */
export const createBillNotZeroError = defineError("BillNotZero")<{
  readonly id: BillId
  readonly reason: ZeroBillRefusal
  readonly billTotal: Integer
}>()
export type BillNotZeroError = ReturnType<typeof createBillNotZeroError>

export type CloseZeroBillError =
  | BillNotFoundError
  | BillStatusNotAllowedError
  | BillLockedError
  | BillNotZeroError

/**
 * Closes a bill whose goods come to exactly zero — free items, nothing to
 * collect — without a payment ("Finish", payment/0013). No payment can settle
 * it (`BillTotalNotPositive`, payment/0012), and closing by coverage
 * needs a claim, so staff confirm the closing themselves.
 *
 * The bill must be editable (`requireEditableBill`: open, no payment in
 * flight) and carry at least one line once adds and removes are netted — an
 * empty cart is not a sale — with no tip line, since nobody can pay a tip on
 * a bill that is never charged.
 *
 * One write sets both `closedAt`, which the floor view and the sales
 * statistics filter on, and `confirmedClosedAt`, which `deriveBillStatus`
 * reads first: the closing is final and the bill never reopens on its own. A
 * device that has not yet seen the closing can still add a line to it; the
 * bill then stays closed and reads underpaid, which the bill detail and the
 * bill history show, and staff ring the item up on a new bill. Two devices
 * finishing the same bill write the same fields; one finishing it while
 * another discards it ends closed, `confirmedClosedAt` outranking
 * `canceledAt`, which for a bill worth nothing is no loss.
 */
export const closeZeroBill =
  (
    billId: BillId
  ): Task<BillId, CloseZeroBillError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const snapshotResult = await run(requireEditableBill(billId))
    if (!snapshotResult.ok) return snapshotResult

    const { items, billTotal } = snapshotResult.value
    const reason = deriveZeroBillRefusal(items)
    if (reason !== null) {
      return err(createBillNotZeroError({ id: billId, reason, billTotal }))
    }

    const { evoluOwner } = run.deps
    const now = TimestampMsSchema.decode(run.deps.date.now().getTime())

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "bill",
        {
          id: billId,
          closedAt: snapshotResult.value.bill.closedAt ?? now,
          confirmedClosedAt: now,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(billId)
  }

export type ConfirmBillClosedDespiteCancellationError =
  | BillNotFoundError
  | BillNotCanceledError
  | BillUnderpaidError
/**
 * Resolves the canceled+funded collision mirrored from the payment
 * vertical's `confirmPaymentPaidDespiteCancellation`: a bill can be
 * `canceled` (an explicit discard) while its payments' claims already cover
 * its total — money that arrived despite the cancellation. This lets staff
 * explicitly acknowledge that and flip the bill's *derived* status from
 * `canceled` to `closed` via `confirmedClosedAt`, without ever touching
 * `canceledAt` itself. Requires both an existing cancellation and an
 * already-covered bill — this resolves an existing collision, it does not
 * create a way to force-close an underpaid canceled bill. See
 * docs/bill-payment-states.md.
 */
export const confirmBillClosedDespiteCancellation =
  (
    billId: BillId
  ): Task<
    BillId,
    ConfirmBillClosedDespiteCancellationError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const snapshotResult = await run(loadBillStatusSnapshot(billId))
    if (!snapshotResult.ok) return snapshotResult

    const {
      bill: billRow,
      coverage,
      billTotal,
      claimedSum,
      hasActiveClaim,
    } = snapshotResult.value

    if (billRow.canceledAt === null) {
      return err(createBillNotCanceledError({ id: billId }))
    }
    if (!hasActiveClaim || coverage === "underpaid") {
      return err(
        createBillUnderpaidError({ id: billId, billTotal, claimedSum })
      )
    }

    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "bill",
        {
          id: billId,
          confirmedClosedAt: TimestampMsSchema.decode(
            run.deps.date.now().getTime()
          ),
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(billId)
  }
/**
 * Appends a batch of already-computed bill lines after checking the bill is
 * still editable — used by cart-level undo/redo/clear (`use-cart-bill.ts`),
 * which otherwise called `appendBillLines` directly with no status/lock
 * guard at all, silently bypassing the editing lock for as long as a
 * payment is pending on the bill. See docs/bill-payment-states.md.
 */
export const appendGuardedBillLines =
  (
    billId: BillId,
    lines: ReadonlyArray<Omit<BillLineRow, "id">>
  ): Task<
    ReadonlyArray<BillLineSummary>,
    CartWriteError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billResult = await run(requireEditableBill(billId))
    if (!billResult.ok) return billResult

    return run(appendCartLines(billResult.value, lines))
  }
