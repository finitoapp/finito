import { createIdFromString, err, ok, type Result } from "@evolu/common"

import type {
  QerkoBill,
  QerkoBillItem,
  QerkoTable,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import type { BillRow } from "../bill/bill.ts"
import type { BillId } from "../bill/bill-types.ts"
import {
  allocateDiscount,
  type DiscountShareLine,
  isDiscountLine,
} from "../bill-line/bill-line-discount-utils.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import {
  deriveBillGoodsTotal,
  deriveBillSummaryTotal,
} from "../bill-line/bill-line-utils.ts"
import {
  type FiatCurrency,
  Integer,
  NonNegativeInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import type { TableRow } from "../table/table.ts"
import type { QerkoPaymentAttemptRow } from "./payment.ts"
import {
  formatQerkoAmount,
  labelQerkoLine,
  orderQerkoLines,
  type QerkoLine,
  qerkoDecimalToMinorUnits,
} from "./payment-qerko-payment-utils.ts"
import type { PaymentId } from "./payment-types.ts"

/**
 * The payment a Qerko table payment becomes (qerko/0018), derived from
 * Qerko's payment id: a repeated `paymentStart` reaches the same payment,
 * and `settleQerkoPayment` tells a table payment from a direct one by it.
 */
export const createQerkoTablePaymentId = (qerkoPaymentId: string): PaymentId =>
  createIdFromString<"Payment">(`qerko-table-payment:${qerkoPaymentId}`)

/**
 * The bill a guest's part of a table's bill is split off into
 * (qerko/0018), derived from Qerko's payment id like its payment, so a
 * repeated or interrupted `paymentStart` reaches the same bill.
 */
export const createQerkoTableSplitBillId = (qerkoPaymentId: string): BillId =>
  createIdFromString<"Bill">(`qerko-table-bill:${qerkoPaymentId}`)

/** Whether an attempt is of a payment `paymentStart` made for a table's bill. */
export const isQerkoTablePaymentAttempt = (
  attempt: Pick<QerkoPaymentAttemptRow, "paymentId" | "qerkoPaymentId">
): boolean =>
  attempt.paymentId === createQerkoTablePaymentId(attempt.qerkoPaymentId)

/**
 * `getTableList` (qerko/0017): the catalog's tables, their code as Qerko's id
 * and their name, in their `sortOrder`. Two tables sharing a code — codes are
 * generated, so only by accident — are listed once, as the first of them,
 * which is the one `getTableContents` answers for.
 */
export const createQerkoTableList = (
  tables: ReadonlyArray<Pick<TableRow, "code" | "name">>
): ReadonlyArray<QerkoTable> => {
  const seen = new Set<string>()
  const list: QerkoTable[] = []
  for (const table of tables) {
    if (table.code === null || table.name === null) continue
    if (seen.has(table.code)) continue
    seen.add(table.code)
    list.push({ id: table.code, name: table.name })
  }
  return list
}

/**
 * The one item a table's bill shows once part of it is paid (qerko/0018):
 * Payky does not know which lines the money paid. In Czech whatever the
 * app's language, like `Platba` (qerko/0014).
 */
export const qerkoTableRestItemName = "Zbývá zaplatit"

/** A line of a table's bill as offered, with its share of any discount. */
export type QerkoTableLine = BillLineSummary &
  Pick<DiscountShareLine, "discountShare">

/**
 * What a table's bill offers Qerko (qerko/0018), `restAmount` in all:
 *
 * - `lines`: its lines while nothing is paid of it. A guest may pay part of
 *   them (`splittable`), which splits that part off into a bill of its own;
 *   a bill with a discount line is paid whole, since a split may leave
 *   neither bill below zero and a guest could not tell which parts would.
 * - `rest`: one amount, its total less what its payments paid, once part of
 *   it is paid, paid whole.
 *
 * `null` when nothing is left to pay, or the bill's goods come to nothing a
 * payment could be made for (payment/0012).
 */
export type QerkoTableOffer =
  | {
      readonly kind: "lines"
      readonly splittable: boolean
      readonly restAmount: NonNegativeInteger
      readonly lines: ReadonlyArray<QerkoTableLine>
    }
  | { readonly kind: "rest"; readonly restAmount: NonNegativeInteger }

export const deriveQerkoTableOffer = ({
  summaries,
  ledger,
  claimedSum,
}: {
  /** The bill's line summaries as they stand (`loadBillStatusSnapshot`). */
  readonly summaries: ReadonlyArray<BillLineSummary>
  /** The bill's ledger rows, for the order its lines first appeared in. */
  readonly ledger: ReadonlyArray<
    Pick<QerkoLine, "catalogItemId" | "itemId" | "type">
  >
  /** What the bill's payments have paid of it, their tips left out. */
  readonly claimedSum: number
}): QerkoTableOffer | null => {
  const owed = Math.max(0, deriveBillSummaryTotal(summaries)) - claimedSum
  if (owed <= 0 || deriveBillGoodsTotal(summaries) <= 0) return null
  if (claimedSum > 0) {
    return { kind: "rest", restAmount: NonNegativeInteger(owed) }
  }
  const lines = orderQerkoLines(allocateDiscount(summaries), ledger)
  return {
    kind: "lines",
    splittable: !lines.some(isDiscountLine),
    restAmount: NonNegativeInteger(owed),
    lines,
  }
}

/** Whether Qerko may split a line: a whole quantity of a splittable bill. */
const isSplittableLine = (
  offer: Extract<QerkoTableOffer, { kind: "lines" }>,
  line: QerkoTableLine
): boolean => offer.splittable && Number.isInteger(line.quantity)

/**
 * The bill Qerko shows for a table's bill (qerko/0018): its lines, priced as
 * a payment's are (qerko/0014), or one item with the rest. Its id is the
 * bill's, and its name the bill's label or `#` and its number, so guests
 * tell several bills on one table apart. A splittable bill lets the guest
 * pay part of it, each whole quantity one at a time (`minQuantity` `"1"`);
 * any other is paid whole. No discount, no menus; the guest tips in Qerko
 * (qerko/0015).
 */
export const createQerkoTableBill = ({
  bill,
  offer,
}: {
  readonly bill: Pick<BillRow, "id" | "label" | "displayNumber" | "currency">
  readonly offer: QerkoTableOffer
}): QerkoBill => {
  const { currency } = bill
  return {
    id: bill.id,
    name: bill.label ?? `#${bill.displayNumber}`,
    currency,
    items:
      offer.kind === "lines"
        ? offer.lines.map((line): QerkoBillItem => {
            const label = labelQerkoLine(line)
            return {
              id: line.id,
              name: label.name,
              price: formatQerkoAmount(line.totalAmount, currency),
              quantity: label.quantity,
              minQuantity: isSplittableLine(offer, line) ? "1" : "0",
            }
          })
        : [
            {
              id: bill.id,
              name: qerkoTableRestItemName,
              price: formatQerkoAmount(offer.restAmount, currency),
              quantity: "1",
              minQuantity: "0",
            },
          ],
    allowPartialPayment: offer.kind === "lines" && offer.splittable,
    allowTip: true,
    denyDiscounts: true,
    denyMenus: true,
  }
}

/** What a `paymentStart` of a table's bill pays, once it matches the offer. */
export interface QerkoTablePaymentStart {
  /** The goods: what its items add up to. */
  readonly amount: NonNegativeInteger
  /**
   * The part of the bill it pays, each line at the quantity and amount paid,
   * to be split off into a bill of its own; `null` when it pays the whole
   * bill, or its rest.
   */
  readonly split: ReadonlyArray<QerkoTableLine> | null
}

export type QerkoTablePaymentMismatch = "currency" | "discount" | "items"

/**
 * Whether a `paymentStart` of a table's bill matches what the bill offers
 * now (qerko/0018), and what it pays when it does. The currency must match
 * and no discount be applied; the customer's tip is in no item (qerko/0015).
 *
 * - The rest is one item, its id the bill's, at the rest's price.
 * - Each line is paid at most once per start, never above its quantity. A
 *   line paid whole costs its total; part of a whole quantity costs its
 *   share of that, within one minor unit of Qerko's rounding. A line Qerko
 *   may not split, and every line of a bill that is not splittable, is paid
 *   whole. A part must hold goods: a tip line of the cart alone is no sale
 *   (payment/0012).
 *
 * A bill that changed since Qerko read it — a line added, taken off or paid
 * by another guest — no longer matches, and Qerko refreshes it.
 */
export const checkQerkoTablePaymentStart = ({
  wire,
  offer,
  billId,
  currency,
}: {
  readonly wire: Pick<QerkoWirePayment, "currency" | "items" | "discount">
  readonly offer: QerkoTableOffer
  readonly billId: string
  readonly currency: FiatCurrency
}): Result<QerkoTablePaymentStart, QerkoTablePaymentMismatch> => {
  if (wire.currency !== currency) return err("currency")
  const discount =
    wire.discount === null || wire.discount === undefined
      ? 0
      : qerkoDecimalToMinorUnits(wire.discount.value, currency)
  if (discount !== 0) return err("discount")

  const items: Array<{ id: string; quantity: number; price: number }> = []
  for (const item of wire.items) {
    const price = qerkoDecimalToMinorUnits(item.price, currency)
    const quantity = Number(item.quantity)
    if (price === null || !Number.isFinite(quantity) || quantity <= 0) {
      return err("items")
    }
    if (typeof item.id !== "string") return err("items")
    if (items.some((other) => other.id === item.id)) return err("items")
    items.push({ id: item.id, quantity, price })
  }

  if (offer.kind === "rest") {
    const [rest] = items
    return items.length === 1 &&
      rest !== undefined &&
      rest.id === billId &&
      rest.price === offer.restAmount
      ? ok({ amount: offer.restAmount, split: null })
      : err("items")
  }

  const paid: QerkoTableLine[] = []
  for (const item of items) {
    const line = offer.lines.find((candidate) => candidate.id === item.id)
    if (line === undefined) return err("items")
    if (isSplittableLine(offer, line)) {
      if (!Number.isInteger(item.quantity) || item.quantity > line.quantity) {
        return err("items")
      }
      const whole = item.quantity === line.quantity
      const share = (line.totalAmount * item.quantity) / line.quantity
      if (
        whole
          ? item.price !== line.totalAmount
          : Math.abs(item.price - share) > 1
      ) {
        return err("items")
      }
      paid.push({
        ...line,
        quantity: PositiveNumber(item.quantity),
        totalAmount: Integer(item.price),
      })
    } else {
      // A line Qerko may not split goes as one at its total (qerko/0014).
      if (
        String(item.quantity) !== labelQerkoLine(line).quantity ||
        item.price !== line.totalAmount
      ) {
        return err("items")
      }
      paid.push(line)
    }
  }

  // Each item names a different line, so as many items as lines, each at
  // its line's full quantity, is the whole bill.
  const whole =
    paid.length === offer.lines.length &&
    paid.every(
      (line) =>
        line.quantity ===
        offer.lines.find((candidate) => candidate.id === line.id)?.quantity
    )
  if (!offer.splittable && !whole) return err("items")
  const amount = paid.reduce((sum, line) => sum + line.totalAmount, 0)
  if (amount <= 0 || deriveBillGoodsTotal(paid) <= 0) return err("items")
  return ok({
    amount: NonNegativeInteger(amount),
    split: whole ? null : paid,
  })
}
