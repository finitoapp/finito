import { createIdFromString, err, ok, type Result } from "@evolu/common"
import { z } from "zod"

import type {
  QerkoBill,
  QerkoBillItem,
  QerkoTable,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { jsonCodec } from "../../zod-utils.ts"
import type { BillRow } from "../bill/bill.ts"
import {
  allocateDiscount,
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
 * The one item a table's bill shows once money Payky cannot tie to lines
 * paid part of it (qerko/0018). In Czech whatever the app's language, like
 * `Platba` (qerko/0014).
 */
export const qerkoTableRestItemName = "Zbývá zaplatit"

/** One bill line a table's payment paid (qerko/0018). */
const QerkoPaidLineSchema = z.object({
  /** The line's `BillLineSummaryId`. */
  lineId: z.string().min(1),
  quantity: z.number().positive(),
  /** What Qerko charged for it, in minor units. */
  amount: z.number().int(),
})
export type QerkoPaidLine = z.output<typeof QerkoPaidLineSchema>

/** `qerkoPaymentAttempt.paidLines`. */
export const QerkoPaidLinesJson = jsonCodec(z.array(QerkoPaidLineSchema))

/** The lines one attempt took, and whether Qerko already said `PAID`. */
export interface QerkoAttemptPaidLines {
  readonly paid: boolean
  readonly lines: ReadonlyArray<QerkoPaidLine>
}

/** A quantity netted from several, without a float's tail. */
const roundQuantity = (quantity: number): number => Number(quantity.toFixed(6))

/** A line of a table's bill as offered: what is still left of it. */
export type QerkoTableLine = QerkoLine & Pick<BillLineSummary, "id">

/**
 * What a table's bill offers Qerko (qerko/0018), `restAmount` in all:
 *
 * - `lines`: the lines not yet paid through Qerko, each with the quantity
 *   and amount left of it, as long as every payment that reached the bill
 *   came through Qerko's table flow, which records the lines it paid. A bill
 *   with a discount line is not `splittable`: a guest could pay the goods
 *   and leave the discount behind, so it is paid whole.
 * - `rest`: one amount, the bill's total less what its payments paid, once
 *   money Payky cannot tie to lines reached it (a split at the till, a
 *   direct payment, self-pay), paid whole.
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
  attempts,
}: {
  /** The bill's line summaries as they stand (`loadBillStatusSnapshot`). */
  readonly summaries: ReadonlyArray<BillLineSummary>
  /** The bill's ledger rows, for the order its lines first appeared in. */
  readonly ledger: ReadonlyArray<
    Pick<QerkoLine, "catalogItemId" | "itemId" | "type">
  >
  /** What the bill's payments have paid of it, their tips left out. */
  readonly claimedSum: number
  /** The lines Qerko attempts paid or are paying; failed ones left out. */
  readonly attempts: ReadonlyArray<QerkoAttemptPaidLines>
}): QerkoTableOffer | null => {
  const owed = Math.max(0, deriveBillSummaryTotal(summaries)) - claimedSum
  if (owed <= 0 || deriveBillGoodsTotal(summaries) <= 0) return null

  const paidThroughLines = attempts
    .filter((attempt) => attempt.paid)
    .flatMap((attempt) => attempt.lines)
    .reduce((sum, line) => sum + line.amount, 0)
  if (claimedSum !== paidThroughLines) {
    return { kind: "rest", restAmount: NonNegativeInteger(owed) }
  }

  const taken = new Map<string, { quantity: number; amount: number }>()
  for (const line of attempts.flatMap((attempt) => attempt.lines)) {
    const sums = taken.get(line.lineId) ?? { quantity: 0, amount: 0 }
    taken.set(line.lineId, {
      quantity: sums.quantity + line.quantity,
      amount: sums.amount + line.amount,
    })
  }
  const ordered = orderQerkoLines(allocateDiscount(summaries), ledger)
  const lines = ordered.flatMap((line): ReadonlyArray<QerkoTableLine> => {
    const sums = taken.get(line.id)
    if (sums === undefined) return [line]
    const quantity = roundQuantity(line.quantity - sums.quantity)
    if (quantity <= 0) return []
    return [
      {
        ...line,
        quantity: PositiveNumber(quantity),
        totalAmount: Integer(line.totalAmount - sums.amount),
      },
    ]
  })
  const restAmount = lines.reduce((sum, line) => sum + line.totalAmount, 0)
  if (restAmount <= 0) return null
  return {
    kind: "lines",
    splittable: !lines.some(isDiscountLine),
    restAmount: NonNegativeInteger(restAmount),
    lines,
  }
}

/** Whether Qerko may split a line: a whole quantity of a splittable bill. */
const isSplittableLine = (
  offer: Extract<QerkoTableOffer, { kind: "lines" }>,
  line: QerkoTableLine
): boolean => offer.splittable && Number.isInteger(line.quantity)

/**
 * The bill Qerko shows for a table's bill (qerko/0018): what is left of its
 * lines, priced as a payment's are (qerko/0014), or one item with the rest.
 * Its id is the bill's, and its name the bill's label or `#` and its number,
 * so guests tell several bills on one table apart. A splittable bill lets the
 * guest pay part of it, each whole quantity one at a time (`minQuantity`
 * `"1"`); any other is paid whole. No discount, no menus; the guest tips in
 * Qerko (qerko/0015).
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
  /** The lines it pays; `null` for the rest paid as one item. */
  readonly paidLines: ReadonlyArray<QerkoPaidLine> | null
}

export type QerkoTablePaymentMismatch = "currency" | "discount" | "items"

/**
 * Whether a `paymentStart` of a table's bill matches what the bill offers
 * now (qerko/0018), and what it pays when it does. The currency must match
 * and no discount be applied; the customer's tip is in no item (qerko/0015).
 *
 * - The rest is one item, its id the bill's, at the rest's price.
 * - Each line is paid at most once per start, never above what is left of
 *   it. A line paid whole costs what is left of it; part of a whole quantity
 *   costs its share of that, within one minor unit of Qerko's rounding. A
 *   line Qerko may not split, and every line of a bill that is not
 *   splittable, is paid whole.
 *
 * A bill that changed since Qerko read it — a line added, taken off or paid
 * by another payment — no longer matches, and Qerko refreshes it.
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
      ? ok({ amount: offer.restAmount, paidLines: null })
      : err("items")
  }

  const paidLines: QerkoPaidLine[] = []
  for (const item of items) {
    const line = offer.lines.find((candidate) => candidate.id === item.id)
    if (line === undefined) return err("items")
    if (isSplittableLine(offer, line)) {
      if (!Number.isInteger(item.quantity) || item.quantity > line.quantity) {
        return err("items")
      }
      const share = (line.totalAmount * item.quantity) / line.quantity
      const whole = item.quantity === line.quantity
      if (
        whole
          ? item.price !== line.totalAmount
          : Math.abs(item.price - share) > 1
      ) {
        return err("items")
      }
    } else if (
      String(item.quantity) !== labelQerkoLine(line).quantity ||
      item.price !== line.totalAmount
    ) {
      return err("items")
    }
    paidLines.push({
      lineId: line.id,
      // A line Qerko may not split goes as one at its total (qerko/0014).
      quantity: isSplittableLine(offer, line) ? item.quantity : line.quantity,
      amount: item.price,
    })
  }

  if (!offer.splittable && paidLines.length !== offer.lines.length) {
    return err("items")
  }
  const amount = paidLines.reduce((sum, line) => sum + line.amount, 0)
  return amount > 0
    ? ok({ amount: NonNegativeInteger(amount), paidLines })
    : err("items")
}

/**
 * The lines a table's payment paid, as its receipt lists them (qerko/0018):
 * each of the payment's frozen lines it paid, at the quantity and amount
 * Qerko charged, in the frozen lines' order. A line paid whole keeps its
 * discount share; only a bill without a discount is ever split, so a line
 * paid in part has none.
 */
export const applyQerkoPaidLines = <
  T extends QerkoLine & Pick<BillLineSummary, "id">,
>(
  frozen: ReadonlyArray<T>,
  paidLines: ReadonlyArray<QerkoPaidLine>
): ReadonlyArray<T> =>
  frozen.flatMap((line): ReadonlyArray<T> => {
    const paid = paidLines.find((candidate) => candidate.lineId === line.id)
    if (paid === undefined) return []
    const whole =
      paid.quantity === line.quantity && paid.amount === line.totalAmount
    return [
      {
        ...line,
        quantity: PositiveNumber(paid.quantity),
        totalAmount: Integer(paid.amount),
        discountShare: whole ? line.discountShare : null,
      },
    ]
  })
