import { createIdFromString } from "@evolu/common"
import { z } from "zod"

import type {
  QerkoBill,
  QerkoReceipt,
  QerkoTaxInfo,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { jsonCodec } from "../../zod-utils.ts"
import type { TaxRecapRow } from "../bill-line/bill-line-tax-utils.ts"
import {
  minorUnitsToDecimalString,
  signedDecimalAmountToMinorUnits,
} from "../shared/money.ts"
import {
  type FiatCurrency,
  Integer,
  type NonNegativeInteger,
} from "../shared/schema.ts"
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
 * What one of Qerko's states means for an attempt (qerko/0008): only `PAID`
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

/** A Qerko decimal string in minor units; `null` when it is not one. */
export const qerkoDecimalToMinorUnits = (
  value: string,
  currency: FiatCurrency
): number | null => signedDecimalAmountToMinorUnits({ currency, value }) ?? null

const decimal = (value: number, currency: FiatCurrency): string =>
  minorUnitsToDecimalString({ value: Integer(value), currency })

/** The one line a Qerko bill and receipt show: the whole payment. */
export const qerkoPaymentItemName = (serialNumber: number | null): string =>
  serialNumber === null ? "Platba" : `Platba #${serialNumber}`

/**
 * The bill Qerko shows for a payment (qerko/0009): one line with the whole
 * amount, the tip already in it, paid at once — no part payment, no tip in
 * Qerko, no discount, no menus.
 */
export const createQerkoBill = ({
  paymentId,
  serialNumber,
  amount,
  currency,
}: {
  readonly paymentId: PaymentId
  readonly serialNumber: number | null
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
}): QerkoBill => ({
  id: paymentId,
  name: serialNumber === null ? "" : `#${serialNumber}`,
  currency,
  items: [
    {
      id: paymentId,
      name: qerkoPaymentItemName(serialNumber),
      price: decimal(amount, currency),
      quantity: "1",
      minQuantity: "0",
    },
  ],
  allowPartialPayment: false,
  allowTip: false,
  denyDiscounts: true,
  denyMenus: true,
})

/**
 * Why a `paymentStart` does not match the bill Payky offered, or `null` when
 * it does: the currency, the amount its items add up to, and no discount.
 */
export const checkQerkoPaymentStart = ({
  wire,
  amount,
  currency,
}: {
  readonly wire: Pick<QerkoWirePayment, "currency" | "items" | "discount">
  readonly amount: NonNegativeInteger
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
    const quantity = Number(item.quantity)
    if (price === null || !Number.isFinite(quantity)) return "amount"
    total += Math.round(price * quantity)
  }
  return total === amount ? null : "amount"
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
 * The receipt `paymentProcessed` answers with (Qerko cancels the payment
 * without one). Its VAT lines must add up to the amount, so they come from the
 * payment's bill lines only when those cover it: a tip on top goes in as a
 * 0 % line, and a payment without lines, one that pays part of its bill, or
 * one of a business that is not a VAT payer is one 0 % line.
 */
export const createQerkoReceipt = ({
  serialNumber,
  amount,
  currency,
  taxRecap,
}: {
  readonly serialNumber: number | null
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  /** `calculateTaxRecap` of the payment's lines; empty when none apply. */
  readonly taxRecap: ReadonlyArray<TaxRecapRow>
}): QerkoReceipt => {
  const zeroRate = (base: number): QerkoTaxInfo => ({
    rate: "0",
    base: decimal(base, currency),
    tax: decimal(0, currency),
  })

  const linesGross = taxRecap.reduce((sum, row) => sum + row.grossAmount, 0)
  const taxInfo =
    taxRecap.length === 0 || linesGross > amount
      ? [zeroRate(amount)]
      : [
          ...taxRecap.map(
            (row): QerkoTaxInfo => ({
              rate:
                row.ratePercentage === null
                  ? "0"
                  : taxRatePercentageToDecimalString(row.ratePercentage),
              base: decimal(row.baseAmount, currency),
              tax: decimal(row.taxAmount, currency),
            })
          ),
          ...(linesGross < amount ? [zeroRate(amount - linesGross)] : []),
        ]

  return {
    items: [
      {
        name: qerkoPaymentItemName(serialNumber),
        quantity: "1",
        price: decimal(amount, currency),
      },
    ],
    taxInfo,
  }
}
