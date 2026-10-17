import {
  type CartLine,
  invertLine,
  linesNeedDiscard,
} from "@payky/app-shared/cart-lines"
import {
  addCatalogItemToBill,
  appendGuardedBillLines,
  appendRemoveBillLine,
  assignBillToTable,
  createBillAtEnd,
  removeTableFromBill,
} from "@payky/core/modules/bill/bill-actions"
import {
  claimedPaymentsByBillIdQuery,
  claimedTransactionsByBillIdQuery,
  paymentsByBillIdQuery,
} from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { billLinesByBillIdQuery } from "@payky/core/modules/bill-line/bill-line-queries"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import { getBillLineSummaryUnitAmount } from "@payky/core/modules/bill-line/bill-line-utils"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import { itemsByBillIdQuery } from "@payky/core/modules/item/item-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import {
  NonNegativeInteger,
  PositiveNumber,
} from "@payky/core/modules/shared/schema"
import type { TableId } from "@payky/core/modules/table/table-types"
import { useStore } from "jotai"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { useCoveringEditQuestion } from "@/features/bill/use-covering-edit-question.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Shows a toast for a failed cart mutation. `BillLocked` gets its own
 * message (reusing the same copy as the bill page's "locked" state) since
 * it is now a routine, expected outcome — a pending payment on the bill —
 * not a rare error; everything else falls back to the generic save-failed
 * message. See docs/bill-payment-states.md.
 */
const showCartMutationErrorToast = (
  t: ReturnType<typeof useTranslation>["t"],
  error: { readonly type: string }
): void => {
  toast.error(
    error.type === "BillLocked" ? t("bill.locked") : t("app.saveFailed")
  )
}

type CartHistoryEntry = ReadonlyArray<CartLine>

/**
 * Owns the mutation side of a cart: lazily creating the bill row on the
 * first line, adding/removing catalog item taps and whole lines, clearing
 * the cart, assigning its table, and a local undo/redo stack over the lines
 * actually appended.
 *
 * The visible cart contents are never derived from this hook's state —
 * only from the live `useBillLineSummaries` query — this hook only issues
 * mutations and remembers enough to invert them.
 */
export function useCartBill({
  billId,
  currency,
  tableId,
  billExists,
  onTableSeedChange,
}: {
  /**
   * Generated client-side and already in the `/bill` URL from the first
   * render — see `bill-page.tsx` and `pos-overview-page.tsx`'s
   * `NewBillLink`. Its row may not exist yet; see `billExists`.
   */
  readonly billId: BillId
  readonly currency: FiatCurrency
  /** Table to assign when the bill row is lazily created on the first line. */
  readonly tableId: TableId | null
  /** Whether `billId`'s row has been written to Evolu yet. */
  readonly billExists: boolean
  /**
   * Records a new value for `tableId` when `assignTable` finds there is no
   * bill row to write to yet, so the choice still seeds the row that gets
   * lazily created on the first line.
   */
  readonly onTableSeedChange: (tableId: TableId | null) => void
}) {
  const appRun = useAppRun()
  const console = useConsole()
  const evolu = useEvolu()
  const jotaiStore = useStore()
  const { t } = useTranslation()
  const { require } = useRequirePermission()
  const coveringEdit = useCoveringEditQuestion(currency)
  /** The one place the cart checks `discard`, on the lines about to be written. */
  const mayWrite = async (lines: ReadonlyArray<CartLine>) => {
    if (!linesNeedDiscard(lines)) return { type: "staysOpen" } as const
    if (!(await require("discard", "access.action.removeLines"))) return null
    return coveringEdit.ask(billId, lines, "edit")
  }
  // The stacks live in refs, with only the two derived booleans in state to
  // drive re-renders. They're read from callbacks that outlive the render
  // that created them — `bill-page.tsx`'s undo toast is clicked seconds
  // after the change it offers to undo — and a state snapshot there is the
  // snapshot from *before* `record` ran, so `undo` would pop the previous
  // entry (or none at all) while `setUndoStack` dropped the newest one,
  // desyncing the stack. Every write below runs inside `runQueued`, so the
  // refs are only ever mutated one operation at a time.
  const undoStackRef = useRef<ReadonlyArray<CartHistoryEntry>>([])
  const redoStackRef = useRef<ReadonlyArray<CartHistoryEntry>>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [pending, setPending] = useState(false)

  const setStacks = (
    undoStack: ReadonlyArray<CartHistoryEntry>,
    redoStack: ReadonlyArray<CartHistoryEntry>
  ) => {
    undoStackRef.current = undoStack
    redoStackRef.current = redoStack
    setCanUndo(undoStack.length > 0)
    setCanRedo(redoStack.length > 0)
  }

  // Every cart mutation runs through this promise chain, so taps are queued
  // and applied in tap order instead of racing each other. The item grid
  // must therefore never disable its "+"/"-" controls while a mutation is in
  // flight: a button that turns `disabled` between a tap's press and the
  // browser dispatching its click event swallows that click entirely, so the
  // second of two rapid taps was silently lost. Ordering matters here beyond
  // safety — the bill-line ledger is append-only and undo/redo replays it in
  // reverse, so out-of-order appends would make undo pop the wrong entry.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const pendingCountRef = useRef(0)

  /**
   * Resolves `true` only when the operation actually applied and was
   * recorded on the undo stack. Failures are reported here, so most call
   * sites can keep ignoring the result — but one that offers to undo the
   * change has to know, or it offers to undo whatever came before it.
   */
  const runQueued = async (
    operation: () => Promise<boolean>
  ): Promise<boolean> => {
    pendingCountRef.current += 1
    setPending(true)

    // A throw in here is a defect rather than an expected domain failure
    // — realistically only `ensureBillExists` below, which rethrows when
    // the bill row can't be created. Report it the way every Result
    // failure in this hook is reported instead of letting it escape:
    // most call sites are `void cart.addOne(...)`, so a rejection produced
    // no log, no toast and a tap that silently did nothing.
    const guarded = async (): Promise<boolean> => {
      try {
        return await operation()
      } catch (error) {
        console.error("Cart mutation failed", error)
        toast.error(t("app.saveFailed"))

        return false
      }
    }

    // Both handlers run `guarded`: a failed predecessor must not cancel
    // the taps queued behind it.
    const queued = queueRef.current.then(guarded, guarded)
    queueRef.current = queued

    try {
      return await queued
    } finally {
      pendingCountRef.current -= 1
      if (pendingCountRef.current === 0) setPending(false)
    }
  }

  // Guards `ensureBillExists` against creating the bill row twice when
  // several adds are triggered before `billExists` (derived from the bill
  // query) turns true (re-render lag, or two rapid scans in scan mode) —
  // without it, each call sees `billExists === false` and starts its own
  // `createBillAtEnd`. Unlike the id, this never needs resetting mid-mount:
  // `billId` is fixed for the lifetime of this cart (see `bill-page.tsx`),
  // so there's no "later add should start a fresh bill" case to guard for.
  const pendingBillCreationRef = useRef<Promise<void> | null>(null)

  const record = (entry: CartHistoryEntry) => {
    setStacks([...undoStackRef.current, entry], [])
  }

  const ensureBillExists = async (): Promise<void> => {
    if (billExists) return
    if (pendingBillCreationRef.current !== null) {
      await pendingBillCreationRef.current
      return
    }

    const creation = (async () => {
      const { device } = await jotaiStore.get(accountAtom)
      await using run = appRun()
      await run.ok(
        createBillAtEnd({
          id: billId,
          deviceId: device.id,
          label: null,
          tableId,
          currency,
        })
      )

      // Warm the read-side queries the bill view reads unconditionally, so
      // they're already resolved and `use()` doesn't suspend — an uncached
      // suspend here bubbled up to the route's Suspense boundary and
      // blanked the whole page for a beat. Keep this in sync with every
      // query the bill view's `use()` reads, including `usePendingPayments`'s
      // and `useBillStatus`'s — the latter also reads
      // `billLinesByBillIdQuery`/`itemsByBillIdQuery` (already listed here for
      // line summaries), so a brand-new bill's derived status is never computed
      // from an unresolved query.
      await Promise.all([
        evolu.loadQuery(billByIdQuery(billId)),
        evolu.loadQuery(billLinesByBillIdQuery(billId)),
        evolu.loadQuery(itemsByBillIdQuery(billId)),
        evolu.loadQuery(paymentsByBillIdQuery(billId)),
        evolu.loadQuery(claimedPaymentsByBillIdQuery(billId)),
        evolu.loadQuery(claimedTransactionsByBillIdQuery(billId)),
      ])
    })()
    pendingBillCreationRef.current = creation

    try {
      await creation
    } catch (error) {
      pendingBillCreationRef.current = null
      throw error
    }
  }

  const addQuantity = (catalogItem: CatalogItemRow, quantity: PositiveNumber) =>
    runQueued(async () => {
      await ensureBillExists()
      const { device } = await jotaiStore.get(accountAtom)
      await using run = appRun()

      const result = await run(
        addCatalogItemToBill({
          billId,
          deviceId: device.id,
          catalogItemId: catalogItem.id,
          quantity,
        })
      )
      if (!result.ok) {
        console.error("Failed to add catalog item to cart", result.error)
        showCartMutationErrorToast(t, result.error)

        return false
      }

      record([
        {
          billId,
          deviceId: device.id,
          catalogItemId: catalogItem.id,
          itemId: result.value.itemId,
          type: "catalogItem",
          kind: "add",
          quantity,
          totalAmount: NonNegativeInteger(catalogItem.unitAmount * quantity),
        },
      ])

      return true
    })

  const addOne = (catalogItem: CatalogItemRow) =>
    addQuantity(catalogItem, PositiveNumber(1))

  /**
   * Appends a remove line covering part or all of `summary`: `removeOne`
   * takes a single unit off (a "−" tap on an item brick), `removeLine` takes
   * the whole line (the X on a summary row). Both are the same append with
   * different amounts — the ledger has no notion of "one" versus "all".
   */
  const removeFromCart = (
    summary: BillLineSummary,
    quantity: PositiveNumber,
    totalAmount: NonNegativeInteger
  ) =>
    runQueued(async () => {
      const { device } = await jotaiStore.get(accountAtom)
      const line: CartLine = {
        billId,
        deviceId: device.id,
        catalogItemId: summary.catalogItemId,
        itemId: summary.itemId,
        type: summary.type,
        kind: "remove",
        quantity,
        totalAmount,
      }
      const outcome = await mayWrite([line])
      if (outcome === null) return false
      await using run = appRun()
      const result = await run(
        appendRemoveBillLine({
          billId,
          deviceId: device.id,
          quantity,
          totalAmount,
          lineSummary: summary,
        })
      )
      if (!result.ok) {
        console.error("Failed to remove from cart", result.error)
        showCartMutationErrorToast(t, result.error)

        return false
      }

      if (outcome.type !== "staysOpen") {
        await coveringEdit.followUp(billId, outcome)
        return false
      }
      record([line])

      return true
    })

  const removeOne = (summary: BillLineSummary) =>
    removeFromCart(
      summary,
      PositiveNumber(1),
      getBillLineSummaryUnitAmount(summary)
    )

  const removeLine = (summary: BillLineSummary) =>
    removeFromCart(summary, summary.quantity, summary.totalAmount)

  const clear = (summaries: ReadonlyArray<BillLineSummary>) => {
    if (summaries.length === 0) return Promise.resolve(false)

    return runQueued(async () => {
      const { device } = await jotaiStore.get(accountAtom)
      const lines: CartHistoryEntry = summaries.map((summary) => ({
        billId,
        deviceId: device.id,
        catalogItemId: summary.catalogItemId,
        itemId: summary.itemId,
        type: summary.type,
        kind: "remove" as const,
        quantity: summary.quantity,
        totalAmount: summary.totalAmount,
      }))

      const outcome = await mayWrite(lines)
      if (outcome === null) return false
      await using run = appRun()
      const result = await run(appendGuardedBillLines(billId, lines))
      if (!result.ok) {
        console.error("Failed to clear cart", result.error)
        showCartMutationErrorToast(t, result.error)

        return false
      }

      if (outcome.type !== "staysOpen") {
        await coveringEdit.followUp(billId, outcome)
        return false
      }
      record(lines)

      return true
    })
  }

  /**
   * Assigns (or clears) the bill's table, on the same queue as every other
   * cart mutation so it can never race the lazy bill creation. Whether the
   * row exists is read here rather than taken from the `billExists` prop:
   * that prop is derived from a live query and lags the write, so a table
   * picked between the first tap creating the row and the query catching up
   * only reached `onTableSeedChange` — which nothing reads once the row
   * exists — and was silently dropped.
   */
  const assignTable = (nextTableId: TableId | null) =>
    runQueued(async () => {
      const rows = await evolu.loadQuery(billByIdQuery(billId))
      if (rows.length === 0) {
        onTableSeedChange(nextTableId)

        return true
      }

      await using run = appRun()
      await run.ok(
        nextTableId === null
          ? removeTableFromBill(billId)
          : assignBillToTable({ id: billId, tableId: nextTableId })
      )

      return true
    })

  // The top of the stack is read inside `runQueued`, not before it, so two
  // rapid undo taps pop two different entries instead of replaying the same
  // one twice.
  const undo = () =>
    runQueued(async () => {
      const entry = undoStackRef.current.at(-1)
      if (entry === undefined) return false

      const lines = entry.map(invertLine)
      const outcome = await mayWrite(lines)
      if (outcome === null) return false
      await using run = appRun()
      const result = await run(appendGuardedBillLines(billId, lines))
      if (!result.ok) {
        console.error("Failed to undo cart change", result.error)
        showCartMutationErrorToast(t, result.error)

        return false
      }

      setStacks(undoStackRef.current.slice(0, -1), [
        ...redoStackRef.current,
        entry,
      ])
      await coveringEdit.followUp(billId, outcome)

      return true
    })

  const redo = () =>
    runQueued(async () => {
      const entry = redoStackRef.current.at(-1)
      if (entry === undefined) return false

      const outcome = await mayWrite(entry)
      if (outcome === null) return false
      await using run = appRun()
      const result = await run(appendGuardedBillLines(billId, entry))
      if (!result.ok) {
        console.error("Failed to redo cart change", result.error)
        showCartMutationErrorToast(t, result.error)

        return false
      }

      setStacks(
        [...undoStackRef.current, entry],
        redoStackRef.current.slice(0, -1)
      )
      await coveringEdit.followUp(billId, outcome)

      return true
    })

  return {
    pending,
    canUndo,
    canRedo,
    addOne,
    addQuantity,
    removeOne,
    removeLine,
    clear,
    assignTable,
    undo,
    redo,
  }
}
