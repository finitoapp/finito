import {
  err,
  type InsertValues,
  type MutationOptions,
  ok,
  sqliteFalse,
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
  deriveBillTotalAfterLines,
} from "../bill-line/bill-line-utils.ts"
import {
  type CatalogItemNotFoundError,
  createCatalogItemNotFoundError,
} from "../catalog-item/catalog-item-actions.ts"
import { catalogItemByIdQuery } from "../catalog-item/catalog-item-queries.ts"
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
import { getFirstOr } from "../shared/result.ts"
import {
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  type TimestampMs,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { BillRow, bill } from "./bill.ts"
import { loadBillCoveredSince } from "./bill-closing-guards.ts"
import { billClosingCursorId } from "./bill-closing-queries.ts"
import { deriveClosedAtCorrection } from "./bill-closing-utils.ts"
import {
  type BillLockedError,
  type BillNotCanceledError,
  type BillNotFoundError,
  type BillSplitLeavesOverpaymentError,
  type BillSplitSelectionStaleError,
  type BillStatusNotAllowedError,
  type BillStatusSnapshot,
  type BillUnderpaidError,
  type BillWithItems,
  createBillNotCanceledError,
  createBillStatusNotAllowedError,
  createBillUnderpaidError,
  loadBillStatusSnapshot,
  requireCancelableBill,
  requireEditableBill,
  requireSelectionOnSourceBill,
  requireSplitLeavingNoOverpayment,
  type SelectedLineTotals,
} from "./bill-guards.ts"
import {
  billByIdQuery,
  lastBillDisplayNumberQuery,
  openBillsQuery,
} from "./bill-queries.ts"
import type { BillId } from "./bill-types.ts"
import { deriveBillCoverage } from "./bill-utils.ts"

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
export type AddBillLineError =
  | CatalogItemNotFoundError
  | BillLineSummaryMissingError
  | BillNotFoundError
  | BillStatusNotAllowedError
  | BillLockedError
export type SplitBillError =
  | BillNotFoundError
  | BillStatusNotAllowedError
  | BillLockedError
  | BillSplitSelectionStaleError
  | BillSplitLeavesOverpaymentError
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
 * Shared "insert a snapshot + an `add` bill line for it, then read back the
 * resulting summary" step behind `addCatalogItemToBill`, `addManualAmountToBill`,
 * and `addTipToBill` — they differ only in the line's `type` and how its
 * snapshot/detail fields are produced.
 */
const addBillLine =
  <TType extends ItemLineType>(
    type: TType,
    snapshot: ItemRow,
    line: Pick<
      BillLineRow,
      "billId" | "deviceId" | "catalogItemId" | "quantity" | "totalAmount"
    >
  ): Task<
    BillLineSummary,
    BillLineSummaryMissingError,
    EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) => {
      upsertItemSnapshot(run.deps.evolu, snapshot, {
        ...options,
        owner: evoluOwner,
      })
      insertBillLineRows(
        run.deps.evolu,
        [{ ...line, itemId: snapshot.id, type, kind: "add" }],
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
export const addCatalogItemToBill =
  (
    input: Pick<
      InsertValues<typeof billLine>,
      "billId" | "deviceId" | "quantity"
    > & {
      readonly catalogItemId: NonNullable<
        InsertValues<typeof billLine>["catalogItemId"]
      >
    }
  ): Task<
    BillLineSummary,
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

    const snapshot = createCatalogItemSnapshot(catalogItemResult.value)

    return run(
      addBillLine("catalogItem", snapshot, {
        billId: input.billId,
        deviceId: input.deviceId ?? null,
        catalogItemId: catalogItemResult.value.id,
        quantity: input.quantity,
        // `quantity` may be fractional; money has no fractional minor unit.
        totalAmount: NonNegativeInteger(
          Math.round(catalogItemResult.value.unitAmount * input.quantity)
        ),
      })
    )
  }
export const addManualAmountToBill =
  (
    input: Pick<
      InsertValues<typeof billLine>,
      "billId" | "deviceId" | "totalAmount"
    > &
      Pick<InsertValues<typeof item>, "name" | "currency">
  ): Task<
    BillLineSummary,
    | BillLineSummaryMissingError
    | BillNotFoundError
    | BillStatusNotAllowedError
    | BillLockedError,
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
      addBillLine("manualAmount", snapshot, {
        billId: input.billId,
        deviceId: input.deviceId ?? null,
        catalogItemId: null,
        quantity: PositiveNumber(1),
        totalAmount: input.totalAmount,
      })
    )
  }
export const addTipToBill =
  (
    input: Pick<
      InsertValues<typeof billLine>,
      "billId" | "deviceId" | "totalAmount"
    > &
      Pick<InsertValues<typeof item>, "name" | "currency">
  ): Task<
    BillLineSummary,
    | BillLineSummaryMissingError
    | BillNotFoundError
    | BillStatusNotAllowedError
    | BillLockedError,
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
      addBillLine("tip", snapshot, {
        billId: input.billId,
        deviceId: input.deviceId ?? null,
        catalogItemId: null,
        quantity: PositiveNumber(1),
        totalAmount: input.totalAmount,
      })
    )
  }
const closedAtOnceClaimsCoverLines = (
  snapshot: BillStatusSnapshot,
  lines: ReadonlyArray<Omit<BillLineRow, "id">>,
  now: TimestampMs
): TimestampMs | null => {
  const billTotal = deriveBillTotalAfterLines(
    snapshot.items,
    lines.filter((line) => line.billId === snapshot.bill.id)
  )
  return snapshot.bill.closedAt === null &&
    snapshot.hasActiveClaim &&
    deriveBillCoverage(billTotal, snapshot.claimedSum) !== "underpaid"
    ? now
    : null
}

const appendLinesToEditableBill =
  (
    snapshot: BillStatusSnapshot,
    lines: ReadonlyArray<Omit<BillLineRow, "id">>
  ): Task<
    ReadonlyArray<BillLineSummary>,
    never,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const { evoluOwner } = run.deps
    const closedAt = closedAtOnceClaimsCoverLines(
      snapshot,
      lines,
      TimestampMsSchema.decode(run.deps.date.now().getTime())
    )

    if (lines.length > 0) {
      await runMutationWithCompletion((options) => {
        insertBillLineRows(run.deps.evolu, lines, {
          ...options,
          owner: evoluOwner,
        })
        if (closedAt !== null) {
          upsertBillClosedAt(run.deps.evolu, snapshot.bill.id, closedAt, {
            ...options,
            owner: evoluOwner,
          })
        }
      })
    }

    return run(loadCalculatedBillLineSummaries(snapshot.bill.id))
  }
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
    BillNotFoundError | BillStatusNotAllowedError | BillLockedError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billResult = await run(requireEditableBill(input.billId))
    if (!billResult.ok) return billResult

    const projected = await run.ok(
      appendLinesToEditableBill(billResult.value, [
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
    return ok(projected.find((row) => row.id === input.lineSummary.id) ?? null)
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
/**
 * Pairs each item with a "remove" row on `sourceBillId` and an "add" row on
 * `targetBillId` — the move itself, shared by `splitBill` and
 * `splitBillIntoNewBill`, which differ only in how they guard/write it.
 */
const buildSplitLines = (
  sourceBillId: BillId,
  targetBillId: BillId,
  items: ReadonlyArray<BillLineSummary>
): Omit<BillLineRow, "id">[] => {
  const lines: Omit<BillLineRow, "id">[] = []
  for (const item of items) {
    lines.push({
      billId: sourceBillId,
      deviceId: null,
      catalogItemId: item.catalogItemId,
      itemId: item.itemId,
      type: item.type,
      kind: "remove",
      quantity: item.quantity,
      totalAmount: item.totalAmount,
    })
    lines.push({
      billId: targetBillId,
      deviceId: null,
      catalogItemId: item.catalogItemId,
      itemId: item.itemId,
      type: item.type,
      kind: "add",
      quantity: item.quantity,
      totalAmount: item.totalAmount,
    })
  }
  return lines
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

    const lines = buildSplitLines(
      input.sourceBillId,
      input.targetBillId,
      input.items
    )
    const keepsMoneyWithLines = requireSplitLeavingNoOverpayment(
      sourceBillResult.value,
      lines
    )
    if (!keepsMoneyWithLines.ok) return keepsMoneyWithLines
    const { evoluOwner } = run.deps
    const sourceClosedAt = closedAtOnceClaimsCoverLines(
      sourceBillResult.value,
      lines,
      TimestampMsSchema.decode(run.deps.date.now().getTime())
    )

    // An empty selection has nothing to write, and an empty batch would
    // never resolve — see `runMutationWithCompletion`. `appendBillLines`
    // guards its own batch the same way. With no line moved off the source,
    // `cancelSourceBillIfEmptied` could only ever answer `false` anyway.
    const sourceCanceled =
      lines.length === 0
        ? false
        : await runMutationWithCompletion((options) => {
            insertBillLineRows(run.deps.evolu, lines, {
              ...options,
              owner: evoluOwner,
            })
            if (sourceClosedAt !== null) {
              upsertBillClosedAt(
                run.deps.evolu,
                input.sourceBillId,
                sourceClosedAt,
                { ...options, owner: evoluOwner }
              )
            }
            return cancelSourceBillIfEmptied(
              run.deps.evolu,
              input.sourceBillId,
              currentSourceSummaries,
              selectionResult.value,
              TimestampMsSchema.decode(run.deps.date.now().getTime()),
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
    const lines = buildSplitLines(
      input.sourceBillId,
      input.targetBillId,
      input.items
    )
    const keepsMoneyWithLines = requireSplitLeavingNoOverpayment(
      sourceBillResult.value,
      lines
    )
    if (!keepsMoneyWithLines.ok) return keepsMoneyWithLines
    const sourceClosedAt = closedAtOnceClaimsCoverLines(
      sourceBillResult.value,
      lines,
      TimestampMsSchema.decode(run.deps.date.now().getTime())
    )

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
      insertBillLineRows(run.deps.evolu, lines, {
        ...options,
        owner: evoluOwner,
      })
      if (sourceClosedAt !== null) {
        upsertBillClosedAt(run.deps.evolu, input.sourceBillId, sourceClosedAt, {
          ...options,
          owner: evoluOwner,
        })
      }
      cancelSourceBillIfEmptied(
        run.deps.evolu,
        input.sourceBillId,
        currentSourceSummaries,
        selectionResult.value,
        TimestampMsSchema.decode(run.deps.date.now().getTime()),
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
 * could fail on its own. See docs/bill-payment-states.md.
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
 * `docs/bill-payment-states.md` states a `closed` bill is always `paid` or
 * `overpaid`, never `underpaid`.
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
    BillNotFoundError | BillStatusNotAllowedError | BillLockedError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const billResult = await run(requireEditableBill(billId))
    if (!billResult.ok) return billResult

    return run(appendLinesToEditableBill(billResult.value, lines))
  }

export const reconcileBillsClosedAt =
  (
    billIds: ReadonlyArray<BillId>
  ): Task<ReadonlyArray<BillId>, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const corrections: Array<{
      readonly billId: BillId
      readonly closedAt: TimestampMs | null
    }> = []
    for (const billId of new Set(billIds)) {
      const [bill] = await evolu.loadQuery(billByIdQuery(billId))
      if (bill === undefined || bill.canceledAt !== null) continue
      const correction = deriveClosedAtCorrection({
        closedAt: bill.closedAt,
        coveredSince: await run.ok(loadBillCoveredSince(billId)),
      })
      if (correction !== null) {
        corrections.push({ billId, closedAt: correction.closedAt })
      }
    }

    if (corrections.length > 0) {
      await runMutationWithCompletion((options) => {
        for (const { billId, closedAt } of corrections) {
          upsertBillClosedAt(evolu, billId, closedAt, {
            ...options,
            owner: evoluOwner,
          })
        }
      })
    }
    return ok(corrections.map(({ billId }) => billId))
  }

export const saveBillClosingCursor =
  (historyRowid: number): Task<undefined, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "_billClosingCursor",
        {
          id: billClosingCursorId,
          historyRowid: NonNegativeInteger(historyRowid),
          isDeleted: sqliteFalse,
        },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok(undefined)
  }
