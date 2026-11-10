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
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import { getBillLineSummaryUnitAmount } from "@payky/core/modules/bill-line/bill-line-utils"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import {
  type FiatCurrency,
  NonNegativeInteger,
  PositiveNumber,
} from "@payky/core/modules/shared/schema"
import type { TableId } from "@payky/core/modules/table/table-types"
import { useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { accountAtom } from "../../atoms/account.ts"
import { evoluAtom } from "../../atoms/evolu.ts"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { useCoveringEditQuestion } from "./use-covering-edit-question.ts"

type CartHistoryEntry = ReadonlyArray<CartLine>

/**
 * Native counterpart of web's `useCartBill`, with its undo/redo stack over
 * the lines actually appended and its clear. It only issues mutations; the
 * visible cart is always the live line query.
 *
 * Every mutation runs through one promise chain so taps apply in tap order
 * (the bill-line ledger is append-only, so out-of-order appends are wrong) and
 * the item bricks never need to disable themselves mid-write: a button that
 * turns `disabled` between press and release swallows the tap.
 */
export function useCartBill({
  billId,
  currency,
  tableId,
  onTableSeedChange,
}: {
  readonly billId: BillId
  readonly currency: FiatCurrency
  /** Table to assign when the bill row is lazily created on the first line. */
  readonly tableId: TableId | null
  /**
   * Records a table picked before the bill row exists, so it still seeds the
   * row the first line creates.
   */
  readonly onTableSeedChange: (tableId: TableId | null) => void
}) {
  const appRun = useAppRun()
  const evolu = useAtomValue(evoluAtom)
  const { device } = useAtomValue(accountAtom)
  const toast = useToast()
  const { t } = useTranslation()
  const { require } = useRequirePermission()
  const [pending, setPending] = useState(false)
  const coveringEdit = useCoveringEditQuestion(currency)
  /** The one place the cart checks `discard`, on the lines about to be written. */
  const mayWrite = async (lines: ReadonlyArray<CartLine>) => {
    if (!linesNeedDiscard(lines)) return { type: "staysOpen" } as const
    if (!(await require("discard", "access.action.removeLines"))) return null
    return coveringEdit.ask(billId, lines, "edit")
  }
  // Refs, as web: an undo toast's action runs long after the render that
  // raised it, and a state snapshot there would pop the wrong entry. Every
  // write runs inside `runQueued`, so they change one operation at a time.
  const undoStackRef = useRef<ReadonlyArray<CartHistoryEntry>>([])
  const redoStackRef = useRef<ReadonlyArray<CartHistoryEntry>>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const setStacks = (
    undoStack: ReadonlyArray<CartHistoryEntry>,
    redoStack: ReadonlyArray<CartHistoryEntry>
  ) => {
    undoStackRef.current = undoStack
    redoStackRef.current = redoStack
    setCanUndo(undoStack.length > 0)
    setCanRedo(redoStack.length > 0)
  }
  const record = (entry: CartHistoryEntry) =>
    setStacks([...undoStackRef.current, entry], [])
  const reportFailure = (what: string, error: { readonly type: string }) => {
    nativeConsole.error(what, error)
    toast.error(
      t(error.type === "BillLocked" ? "bill.locked" : "app.saveFailed")
    )
  }
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const pendingCountRef = useRef(0)
  // Several taps before the new bill's row is visible must create it once.
  const billCreationRef = useRef<Promise<void> | null>(null)

  /** Resolves `true` only when the operation applied; failures are reported here. */
  const runQueued = async (
    operation: () => Promise<boolean>
  ): Promise<boolean> => {
    pendingCountRef.current += 1
    setPending(true)

    // A throw is a defect (e.g. the bill row cannot be created): report it
    // like a failed Result instead of leaving a tap that silently did nothing.
    const guarded = async (): Promise<boolean> => {
      try {
        return await operation()
      } catch (error) {
        nativeConsole.error("Cart mutation failed", error)
        toast.error(t("app.saveFailed"))
        return false
      }
    }

    // A failed predecessor must not cancel the taps queued behind it.
    const queued = queueRef.current.then(guarded, guarded)
    queueRef.current = queued
    try {
      return await queued
    } finally {
      pendingCountRef.current -= 1
      if (pendingCountRef.current === 0) setPending(false)
    }
  }

  // The row is read now, not taken from a render: the live query lags the write.
  const ensureBillExists = async (): Promise<void> => {
    if (billCreationRef.current !== null) return billCreationRef.current
    if ((await evolu.loadQuery(billByIdQuery(billId))).length > 0) return

    const creation = (async () => {
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
    })()
    billCreationRef.current = creation
    try {
      await creation
    } catch (error) {
      billCreationRef.current = null
      throw error
    }
  }

  const addQuantity = (catalogItem: CatalogItemRow, quantity: PositiveNumber) =>
    runQueued(async () => {
      await ensureBillExists()
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
        reportFailure("Failed to add catalog item to cart", result.error)
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
   * Appends a remove line covering part or all of `summary` (the ledger has no
   * notion of "one" versus "all"). It takes `discard` (access/0002), checked
   * on the lines about to be written, at action time: the prompt may be
   * dismissed, and the queue keeps later taps waiting behind it.
   */
  const removeFromCart = (
    summary: BillLineSummary,
    quantity: PositiveNumber,
    totalAmount: NonNegativeInteger
  ) =>
    runQueued(async () => {
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
        reportFailure("Failed to remove from cart", result.error)
        return false
      }
      if (outcome.type !== "staysOpen") {
        coveringEdit.followUp(billId, outcome)
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
        reportFailure("Failed to clear cart", result.error)
        return false
      }
      if (outcome.type !== "staysOpen") {
        coveringEdit.followUp(billId, outcome)
        return false
      }
      record(lines)
      return true
    })
  }

  // The top of a stack is read inside `runQueued`, so two rapid taps pop two
  // different entries instead of replaying one twice.
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
        reportFailure("Failed to undo cart change", result.error)
        return false
      }
      setStacks(undoStackRef.current.slice(0, -1), [
        ...redoStackRef.current,
        entry,
      ])
      coveringEdit.followUp(billId, outcome)
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
        reportFailure("Failed to redo cart change", result.error)
        return false
      }
      setStacks(
        [...undoStackRef.current, entry],
        redoStackRef.current.slice(0, -1)
      )
      coveringEdit.followUp(billId, outcome)
      return true
    })

  /**
   * Assigns (or clears) the bill's table on the same queue as every other
   * mutation, so it cannot race the lazy bill creation. Whether the row
   * exists is read here, as the live query lags the write: a table picked
   * between the first tap creating the row and the query catching up would
   * otherwise only reach the seed, which nothing reads once the row exists.
   */
  const assignTable = (nextTableId: TableId | null) =>
    runQueued(async () => {
      if ((await evolu.loadQuery(billByIdQuery(billId))).length === 0) {
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

  return {
    pending,
    canUndo,
    canRedo,
    assignTable,
    addOne,
    addQuantity,
    removeOne,
    removeLine,
    clear,
    undo,
    redo,
  }
}
