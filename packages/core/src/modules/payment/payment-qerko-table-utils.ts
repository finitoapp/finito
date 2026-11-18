import { createIdFromString } from "@evolu/common"

import type {
  QerkoBill,
  QerkoBillItem,
  QerkoTable,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import type { BillRow } from "../bill/bill.ts"
import { allocateDiscount } from "../bill-line/bill-line-discount-utils.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import {
  deriveBillGoodsTotal,
  deriveBillSummaryTotal,
} from "../bill-line/bill-line-utils.ts"
import { type FiatCurrency, NonNegativeInteger } from "../shared/schema.ts"
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
 * The one item a table's bill shows once part of it is paid (qerko/0018). In
 * Czech whatever the app's language, like `Platba` (qerko/0014).
 */
export const qerkoTableRestItemName = "Zbývá zaplatit"

/**
 * What a table's bill offers Qerko (qerko/0018): what is left to pay of it,
 * `restAmount`, the bill's total less what its payments have paid (the same
 * remainder PR #220's self-pay offers, table-self-pay/0002). While nothing is
 * paid that is the whole bill, offered line by line (`lines`); after a split
 * payment it is one item (`rest`), since Payky does not know which lines the
 * money paid. `null` when nothing is left to pay, or the bill's goods come to
 * nothing a payment could be made for (payment/0012).
 */
export type QerkoTableOffer =
  | {
      readonly kind: "lines"
      readonly restAmount: NonNegativeInteger
      readonly lines: ReadonlyArray<QerkoLine & Pick<BillLineSummary, "id">>
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
  const billTotal = deriveBillSummaryTotal(summaries)
  const restAmount = Math.max(0, billTotal) - claimedSum
  if (restAmount <= 0 || deriveBillGoodsTotal(summaries) <= 0) return null
  if (claimedSum > 0) {
    return { kind: "rest", restAmount: NonNegativeInteger(restAmount) }
  }
  return {
    kind: "lines",
    restAmount: NonNegativeInteger(restAmount),
    lines: orderQerkoLines(allocateDiscount(summaries), ledger),
  }
}

/**
 * The bill Qerko shows for a table's bill (qerko/0018): its lines priced as
 * a payment's are (qerko/0014), or one item with what is left. Its id is the
 * bill's, and its name the bill's label or `#` and its number, so guests
 * tell several bills on one table apart. Paid whole: no part payment, no
 * discount, no menus; the guest tips in Qerko (qerko/0015).
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
              minQuantity: "0",
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
    allowPartialPayment: false,
    allowTip: true,
    denyDiscounts: true,
    denyMenus: true,
  }
}

/** One item as `paymentStart` is compared by: its id and its price. */
const itemKey = (
  item: Pick<QerkoBillItem, "id" | "price">,
  currency: FiatCurrency
): string =>
  JSON.stringify([
    item.id ?? null,
    qerkoDecimalToMinorUnits(item.price, currency),
  ])

/**
 * Why a `paymentStart` for a table's bill does not match what the bill
 * offers now, or `null` when it does (qerko/0018): the currency, no
 * discount, and exactly the items offered, each by its id and its price. A
 * bill that changed since Qerko read it — a line added, taken off or paid
 * by another payment — no longer matches, and Qerko refreshes it. The
 * customer's tip is in no item (qerko/0015).
 */
export const checkQerkoTablePaymentStart = ({
  wire,
  offered,
  currency,
}: {
  readonly wire: Pick<QerkoWirePayment, "currency" | "items" | "discount">
  readonly offered: Pick<QerkoBill, "items">
  readonly currency: FiatCurrency
}): "currency" | "discount" | "items" | null => {
  if (wire.currency !== currency) return "currency"

  const discount =
    wire.discount === null || wire.discount === undefined
      ? 0
      : qerkoDecimalToMinorUnits(wire.discount.value, currency)
  if (discount !== 0) return "discount"

  const sorted = (items: ReadonlyArray<Pick<QerkoBillItem, "id" | "price">>) =>
    items.map((item) => itemKey(item, currency)).sort()
  const paid = sorted(wire.items)
  const expected = sorted(offered.items)
  return paid.length === expected.length &&
    paid.every((key, index) => key === expected[index])
    ? null
    : "items"
}
