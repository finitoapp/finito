import { createIdFromString } from "@evolu/common"
import { z } from "zod"

import type {
  QerkoBill,
  QerkoBillItem,
  QerkoReceipt,
  QerkoTaxInfo,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { jsonCodec } from "../../zod-utils.ts"
import {
  type DiscountShareLine,
  isDiscountLine,
} from "../bill-line/bill-line-discount-utils.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import {
  calculateTaxRecap,
  prorateTaxRecap,
  type TaxRecapRow,
} from "../bill-line/bill-line-tax-utils.ts"
import { createPaymentLineId } from "../payment-line/payment-line-utils.ts"
import {
  minorUnitsToDecimalString,
  signedDecimalAmountToMinorUnits,
} from "../shared/money.ts"
import {
  type FiatCurrency,
  Integer,
  NonNegativeInteger,
} from "../shared/schema.ts"
import type { TaxRateRow } from "../tax-rate/tax-rate.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import { taxRatePercentageToDecimalString } from "../tax-rate/tax-rate-utils.ts"
import type { QerkoPaymentAttemptRow } from "./payment.ts"
import type { PaymentId, QerkoPaymentAttemptId } from "./payment-types.ts"

/**
 * The attempt row of one Qerko payment (qerko/0013): every device that hears
 * of it — over the websocket or from `get-payment` — reaches the same row.
 */
export const createQerkoPaymentAttemptId = (
  qerkoPaymentId: string
): QerkoPaymentAttemptId =>
  createIdFromString<"QerkoPaymentAttempt">(
    `qerko-payment-attempt:${qerkoPaymentId}`
  )

/**
 * How long `paymentClosed` on the websocket is waited for before Qerko is
 * asked with `get-payment` (qerko/0012): the ordinary path settles a payment
 * well within it.
 */
export const qerkoPaymentSyncGraceMs = 30_000

/** `qerkoPaymentAttempt.providers`: the provider types that paid. */
export const QerkoProvidersJson = jsonCodec(z.array(z.string()))

/** Where an attempt stands, derived from its write-once columns. */
export type QerkoPaymentAttemptState =
  | "started"
  | "processing"
  | "paid"
  | "failed"

export const deriveQerkoPaymentAttemptState = (
  attempt: Pick<QerkoPaymentAttemptRow, "processingAt" | "outcome">
): QerkoPaymentAttemptState => {
  if (attempt.outcome !== null) return attempt.outcome
  return attempt.processingAt === null ? "started" : "processing"
}

/** The states after which Qerko's payment no longer changes. */
const qerkoOngoingStates: ReadonlySet<string> = new Set([
  "STARTED",
  "PROCESSING",
  "AUTHORIZED",
])

/**
 * What one of Qerko's states means for an attempt (qerko/0015): only `PAID`
 * is money. Every other state that is not still in progress — `CANCELLED`,
 * `ERROR`, or one Qerko adds later — is a failed payment.
 */
export const classifyQerkoPaymentState = (
  state: string
): "ongoing" | "paid" | "failed" =>
  state === "PAID"
    ? "paid"
    : qerkoOngoingStates.has(state)
      ? "ongoing"
      : "failed"

/**
 * A Qerko decimal string in minor units; `null` when it is not one. Qerko may
 * write zeros past the currency's minor units (`"15.0000"`), which say
 * nothing and are dropped first.
 */
export const qerkoDecimalToMinorUnits = (
  value: string,
  currency: FiatCurrency
): number | null =>
  signedDecimalAmountToMinorUnits({
    currency,
    value: value.trim().replace(/(\.\d*?)0+$/u, "$1"),
  }) ?? null

/**
 * One of the tips of Qerko's `Payment` in minor units: a missing one is zero,
 * and one that is not an amount of the currency, or is below zero, is `null`.
 */
const qerkoTipToMinorUnits = (
  value: string | undefined,
  currency: FiatCurrency
): NonNegativeInteger | null => {
  if (value === undefined) return NonNegativeInteger(0)
  const amount = qerkoDecimalToMinorUnits(value, currency)
  return amount === null || amount < 0 ? null : NonNegativeInteger(amount)
}

/**
 * The tip of Qerko's `Payment` (qerko/0015): `tipBrutto`, what the customer
 * tipped in Qerko, and `tipNetto`, the same less Qerko's commission on it.
 * Neither has anything to do with VAT. Both are fixed once Qerko creates its
 * payment, so `paymentStart` already carries them.
 */
export const readQerkoTip = (
  wire: Pick<QerkoWirePayment, "tipBrutto" | "tipNetto">,
  currency: FiatCurrency
): {
  readonly tipAmount: NonNegativeInteger | null
  readonly tipNetAmount: NonNegativeInteger | null
} => ({
  tipAmount: qerkoTipToMinorUnits(wire.tipBrutto, currency),
  tipNetAmount: qerkoTipToMinorUnits(wire.tipNetto, currency),
})

const decimal = (value: number, currency: FiatCurrency): string =>
  minorUnitsToDecimalString({ value: Integer(value), currency })

/** The one line a Qerko bill and receipt show: the payment's goods. */
export const qerkoPaymentItemName = (serialNumber: number | null): string =>
  serialNumber === null ? "Platba" : `Platba #${serialNumber}`

/**
 * One line a payment froze from its bill (`paymentLinesToBillLineSummaries`):
 * goods, a discount below zero, or a tip from the cart.
 */
export type QerkoLine = Pick<
  BillLineSummary,
  "catalogItemId" | "itemId" | "type" | "name" | "quantity" | "taxRateId"
> &
  DiscountShareLine

/**
 * What a payment is to Qerko (qerko/0014), by how its goods — its amount less
 * its tip — compare with the lines it froze: a payment without lines
 * (`keypad`), one that covers its bill (`wholeBill`), part of it (`partBill`),
 * or more than it (`overBill`).
 */
export type QerkoPaymentKind = "keypad" | "wholeBill" | "partBill" | "overBill"

export interface QerkoPaymentContent {
  readonly kind: QerkoPaymentKind
  /**
   * The payment's goods: its amount less its tip. Qerko gets only these, and
   * the customer tips in Qerko, so the payment's own tip never reaches it
   * (qerko/0015).
   */
  readonly goodsAmount: NonNegativeInteger
  /** The frozen lines in the order Qerko shows them; empty for `keypad`. */
  readonly lines: ReadonlyArray<QerkoLine>
}

const sumTotalAmounts = (lines: ReadonlyArray<QerkoLine>): number =>
  lines.reduce((sum, line) => sum + line.totalAmount, 0)

/**
 * What the bill and the receipt of a payment are made of (qerko/0014): both
 * come from this one value, so the receipt lists what Qerko offered. A
 * payment covers its bill when its goods, its amount less its tip, are
 * exactly what the lines it froze add up to — goods, discount and cart tips
 * together. A line whose item snapshot is missing is not among `lines`, so
 * its payment adds up to something else and falls back to one line.
 */
export const deriveQerkoPaymentContent = ({
  amount,
  tipAmount,
  lines,
}: {
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly lines: ReadonlyArray<QerkoLine>
}): QerkoPaymentContent => {
  const goodsAmount = NonNegativeInteger(Math.max(0, amount - tipAmount))
  if (lines.length === 0) return { kind: "keypad", goodsAmount, lines }
  const linesTotal = sumTotalAmounts(lines)
  const kind =
    goodsAmount === linesTotal
      ? "wholeBill"
      : goodsAmount < linesTotal
        ? "partBill"
        : "overBill"
  return { kind, goodsAmount, lines }
}

/** Where a line goes among a payment's lines: goods, discounts, cart tips. */
const rankQerkoLine = (line: QerkoLine): number =>
  line.type === "tip" ? 2 : isDiscountLine(line) ? 1 : 0

const qerkoLineKey = (
  line: Pick<QerkoLine, "catalogItemId" | "itemId" | "type">
): string => JSON.stringify([line.catalogItemId, line.itemId, line.type])

/**
 * The order a payment's lines go to Qerko in: goods first, then discounts,
 * then the cart's tips, each in the order its line first appeared in the
 * bill's ledger (`billLinesByBillIdQuery`, by `createdAt`). A frozen line has
 * no order of its own; one the ledger no longer holds goes last of its kind.
 */
export const orderQerkoLines = <T extends QerkoLine>(
  lines: ReadonlyArray<T>,
  ledger: ReadonlyArray<Pick<QerkoLine, "catalogItemId" | "itemId" | "type">>
): ReadonlyArray<T> => {
  const firstSeen = new Map<string, number>()
  ledger.forEach((row, index) => {
    const key = qerkoLineKey(row)
    if (!firstSeen.has(key)) firstSeen.set(key, index)
  })
  const position = (line: T): number =>
    firstSeen.get(qerkoLineKey(line)) ?? Number.POSITIVE_INFINITY
  const compare = (a: number, b: number): number =>
    a === b ? 0 : a < b ? -1 : 1

  // `sort` is stable, so lines the ledger does not hold keep their order.
  return [...lines].sort(
    (a, b) =>
      compare(rankQerkoLine(a), rankQerkoLine(b)) ||
      compare(position(a), position(b))
  )
}

/**
 * A quantity as a Qerko line's name carries it: a decimal comma and no
 * trailing zeros (`0,35`, `1,5`). Czech, like `Platba`, not the device's
 * locale.
 */
export const formatQerkoQuantity = (quantity: number): string =>
  // Rounded first: a quantity netted from adds and removes can carry a
  // float's tail (`1 - 0.7` is `0.30000000000000004`).
  String(Number(quantity.toFixed(6))).replace(".", ",")

interface QerkoLineLabel {
  readonly name: string
  readonly quantity: string
}

/**
 * How a line is named and counted in Qerko, which prices every item at its
 * line's total, on the bill as on the receipt: a whole quantity as it is,
 * any other as one with the quantity in the name (`Sýr (0,35)`), since Qerko
 * draws a quantity without decimals.
 */
const labelQerkoLine = (line: QerkoLine): QerkoLineLabel =>
  Number.isInteger(line.quantity)
    ? { name: line.name, quantity: String(line.quantity) }
    : {
        name: `${line.name} (${formatQerkoQuantity(line.quantity)})`,
        quantity: "1",
      }

/**
 * The bill Qerko shows for a payment (qerko/0014, qerko/0015): the lines of a
 * bill the payment covers, each at its line's total; otherwise one line with
 * the payment's goods. Never the payment's own tip: the customer tips in
 * Qerko, which the bill allows. Paid at once either way — no part payment, no
 * discount, no menus.
 */
export const createQerkoBill = ({
  paymentId,
  serialNumber,
  currency,
  content,
}: {
  readonly paymentId: PaymentId
  readonly serialNumber: number | null
  readonly currency: FiatCurrency
  readonly content: QerkoPaymentContent
}): QerkoBill => ({
  id: paymentId,
  name: serialNumber === null ? "" : `#${serialNumber}`,
  currency,
  items:
    content.kind === "wholeBill"
      ? content.lines.map((line): QerkoBillItem => {
          const label = labelQerkoLine(line)
          return {
            id: createPaymentLineId({
              paymentId,
              catalogItemId: line.catalogItemId,
              itemId: line.itemId,
              type: line.type,
            }),
            name: label.name,
            price: decimal(line.totalAmount, currency),
            quantity: label.quantity,
            minQuantity: "0",
          }
        })
      : [
          {
            id: paymentId,
            name: qerkoPaymentItemName(serialNumber),
            price: decimal(content.goodsAmount, currency),
            quantity: "1",
            minQuantity: "0",
          },
        ],
  allowPartialPayment: false,
  allowTip: true,
  denyDiscounts: true,
  denyMenus: true,
})

/**
 * Why a `paymentStart` does not match the bill Payky offered, or `null` when
 * it does: the currency, the payment's goods its items add up to, and no
 * discount. An item's `price` is its line's total, the quantity already in
 * it. The customer's tip is in no item, so it is not part of the sum.
 */
export const checkQerkoPaymentStart = ({
  wire,
  goodsAmount,
  currency,
}: {
  readonly wire: Pick<QerkoWirePayment, "currency" | "items" | "discount">
  readonly goodsAmount: NonNegativeInteger
  readonly currency: FiatCurrency
}): "currency" | "amount" | "discount" | null => {
  if (wire.currency !== currency) return "currency"

  const discount =
    wire.discount === null || wire.discount === undefined
      ? 0
      : qerkoDecimalToMinorUnits(wire.discount.value, currency)
  if (discount !== 0) return "discount"

  let total = 0
  for (const item of wire.items) {
    const price = qerkoDecimalToMinorUnits(item.price, currency)
    if (price === null) return "amount"
    total += price
  }
  return total === goodsAmount ? null : "amount"
}

/** What Qerko reports was paid: the parts' totals and who paid them. */
export const summarizeQerkoPaymentParts = (
  parts: QerkoWirePayment["parts"],
  currency: FiatCurrency
): {
  readonly chargedAmount: number
  readonly providers: ReadonlyArray<string>
} | null => {
  let chargedAmount = 0
  for (const part of parts) {
    const total = qerkoDecimalToMinorUnits(part.total, currency)
    if (total === null || total < 0) return null
    chargedAmount += total
  }
  return {
    chargedAmount,
    providers: [...new Set(parts.map((part) => part.provider.type))],
  }
}

/**
 * The tip a paid Qerko payment brings in place of the payment's own
 * (qerko/0015), or `undefined` when the money does not add up to the
 * payment's goods and a tip: then it is recorded as charged, and anything
 * above or below the payment reads as an overpayment or a shortfall. A tip
 * of zero replaces the payment's own too — the customer tipped nothing in
 * Qerko, and the payment's own tip never reached it.
 */
export const deriveQerkoChargedTip = ({
  chargedAmount,
  tipAmount,
  goodsAmount,
}: {
  /** What the parts add up to: goods and the customer's tip. */
  readonly chargedAmount: number
  /** `tipBrutto`, `null` when Qerko gave none Payky reads. */
  readonly tipAmount: NonNegativeInteger | null
  readonly goodsAmount: number
}): NonNegativeInteger | undefined =>
  tipAmount !== null && chargedAmount - tipAmount === goodsAmount
    ? tipAmount
    : undefined

type QerkoReceiptItem = QerkoReceipt["items"][number]

/**
 * The VAT recap of a keypad payment's goods (qerko/0014): one row at the rate
 * the business set for keypad amounts (`appSettings.keypadTaxRateId`), split
 * by `splitInclusiveAmount`. Empty without a rate set, and with one this
 * device does not hold — deleted, or not synced yet — so the receipt then
 * carries no VAT lines rather than a guessed rate.
 */
export const calculateQerkoKeypadTaxRecap = ({
  goodsAmount,
  taxRateId,
  taxRates,
}: {
  readonly goodsAmount: NonNegativeInteger
  readonly taxRateId: TaxRateId | null
  readonly taxRates: ReadonlyArray<Pick<TaxRateRow, "id" | "name" | "rate">>
}): ReadonlyArray<TaxRecapRow> =>
  taxRateId === null
    ? []
    : calculateTaxRecap(
        [{ taxRateId, totalAmount: Integer(goodsAmount), discountShare: null }],
        taxRates
      )

/**
 * A receipt's VAT lines (qerko/0014): the payment's goods and nothing else —
 * no tip, neither the one Payky's tip screen set nor the one the customer
 * chose in Qerko (qerko/0015). Without a recap (not a VAT payer) they are one
 * 0 % line for the goods. Otherwise the recap must hold everything it stands
 * for — every line the payment froze, or a keypad payment's goods — or there
 * are no VAT lines at all rather than a guessed rate. A payment covering part
 * of its bill takes its recap prorated to its goods (`prorateTaxRecap`); what
 * a payment above its bill pays over it is no goods of the bill and is left
 * out. Rows of one rate are merged, so the lines without a rate and those at
 * 0 % share one 0 % line, which comes last.
 */
const createQerkoTaxInfo = ({
  content,
  currency,
  taxRecap,
}: {
  readonly content: QerkoPaymentContent
  readonly currency: FiatCurrency
  readonly taxRecap: ReadonlyArray<TaxRecapRow> | null
}): Array<QerkoTaxInfo> => {
  const zeroRate = (base: number): QerkoTaxInfo => ({
    rate: "0",
    base: decimal(base, currency),
    tax: decimal(0, currency),
  })
  if (taxRecap === null) return [zeroRate(content.goodsAmount)]

  const recapGross = taxRecap.reduce((sum, row) => sum + row.grossAmount, 0)
  const recapFor =
    content.kind === "keypad"
      ? content.goodsAmount
      : sumTotalAmounts(content.lines)
  if (taxRecap.length === 0 || recapGross !== recapFor) return []

  const goodsRows =
    content.kind === "partBill"
      ? prorateTaxRecap(taxRecap, content.goodsAmount)
      : taxRecap

  const sumsByRate = new Map<string, { base: number; tax: number }>()
  for (const row of goodsRows) {
    const rate =
      row.ratePercentage === null
        ? "0"
        : taxRatePercentageToDecimalString(row.ratePercentage)
    const sums = sumsByRate.get(rate) ?? { base: 0, tax: 0 }
    sumsByRate.set(rate, {
      base: sums.base + row.baseAmount,
      tax: sums.tax + row.taxAmount,
    })
  }

  const rated = [...sumsByRate]
    .filter(([rate]) => rate !== "0")
    .map(
      ([rate, sums]): QerkoTaxInfo => ({
        rate,
        base: decimal(sums.base, currency),
        tax: decimal(sums.tax, currency),
      })
    )
  const zero = sumsByRate.get("0")
  return zero === undefined ? rated : [...rated, zeroRate(zero.base)]
}

/**
 * The receipt `paymentProcessed` answers with (Qerko cancels the payment
 * without one), which Qerko keeps and renders for the customer as it is
 * (qerko/0014): the items of the bill Qerko offered, the goods alone. Neither
 * the payment's own tip nor the one the customer chose in Qerko is an item
 * (qerko/0015). Its VAT lines follow `createQerkoTaxInfo`.
 */
export const createQerkoReceipt = ({
  serialNumber,
  currency,
  content,
  taxRecap,
}: {
  readonly serialNumber: number | null
  readonly currency: FiatCurrency
  readonly content: QerkoPaymentContent
  /**
   * The VAT recap of the payment's goods — `calculateTaxRecap` of its frozen
   * lines, `calculateQerkoKeypadTaxRecap` without them — or `null` when the
   * business is not a VAT payer.
   */
  readonly taxRecap: ReadonlyArray<TaxRecapRow> | null
}): QerkoReceipt => ({
  items:
    content.kind === "wholeBill"
      ? content.lines.map((line): QerkoReceiptItem => {
          const label = labelQerkoLine(line)
          return {
            name: label.name,
            quantity: label.quantity,
            price: decimal(line.totalAmount, currency),
          }
        })
      : [
          {
            name: qerkoPaymentItemName(serialNumber),
            quantity: "1",
            price: decimal(content.goodsAmount, currency),
          },
        ],
  taxInfo: createQerkoTaxInfo({ content, currency, taxRecap }),
})
