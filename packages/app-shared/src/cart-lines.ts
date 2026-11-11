import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { BillLineRow } from "@payky/core/modules/bill-line/bill-line"

export type CartLine = Omit<BillLineRow, "id">

/**
 * Undoing/redoing a bill-line append is always just re-appending the same
 * line with its `kind` flipped — the append-only ledger design makes this
 * exact and needs no separate undo table.
 */
export const invertLine = (line: CartLine): CartLine => ({
  ...line,
  kind: line.kind === "add" ? "remove" : "add",
})

/** What {@link linesNeedDiscard} reads of a line about to be written. */
export type DiscardCheckedLine = Pick<CartLine, "kind" | "totalAmount">

/**
 * Whether writing `lines` takes `discard` (access/0012): any batch that
 * lowers the bill's total, whichever cart operation writes it. A `remove`
 * line does — removing a line, clearing, undoing an added line — and so does
 * a line below zero: a discount (catalog/0002), added by a tap, a scan or a
 * redo, or a removed discount put back by an undo.
 */
export const linesNeedDiscard = (
  lines: ReadonlyArray<DiscardCheckedLine>
): boolean =>
  lines.some((line) => line.kind === "remove" || line.totalAmount < 0)

/**
 * The action the PIN prompt names when `lines` take `discard`, `null` when
 * they do not: taking items off the bill whenever a `remove` line is among
 * them, adding a discount otherwise.
 */
export const cartWriteDiscardAction = (
  lines: ReadonlyArray<DiscardCheckedLine>
): Extract<
  TranslationKey,
  "access.action.removeLines" | "access.action.addDiscount"
> | null => {
  if (!linesNeedDiscard(lines)) return null
  return lines.some((line) => line.kind === "remove")
    ? "access.action.removeLines"
    : "access.action.addDiscount"
}
