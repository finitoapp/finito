import type { sqliteTrue } from "@evolu/common"
import { describeQerkoPaymentError } from "@payky/app-shared/qerko-terminal-flow"
import type { QerkoNotStartedReason } from "@payky/core/integrations/qerko/qerko-client"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { ItemLineType } from "@payky/core/modules/item/item-types"
import type { PaymentLineId } from "@payky/core/modules/payment-line/payment-line-types"
import type {
  RefundPaymentError,
  RefundPaymentTipError,
} from "@payky/core/modules/refund/refund-actions"
import type { RefundQerkoPaymentError } from "@payky/core/modules/refund/refund-qerko-payment-actions"
import type { RefundMethod } from "@payky/core/modules/refund/refund-types"
import {
  calculateRefundLineAmount,
  deriveRefundableAmount,
  deriveRefundableLines,
  deriveRefundableTipAmount,
  deriveRefundPrefillAmount,
  type RefundableLine,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
} from "@payky/core/modules/refund/refund-utils"
import {
  decimalAmountToMinorUnits,
  minorUnitsToDecimalString,
} from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  NonNegativeInteger,
  PositiveNumber,
} from "@payky/core/modules/shared/schema"
import type { TranslationKey } from "./i18n/resources.ts"

/** The refund form's two ways to say what comes back (refund/0002). */
export type RefundMode = "amount" | "items"

export interface RefundablePaymentLine {
  readonly id: PaymentLineId
  readonly type: ItemLineType
  readonly quantity: PositiveNumber
  readonly totalAmount: NonNegativeInteger
  readonly name: string
}

export type RefundQuantities = Readonly<Partial<Record<PaymentLineId, number>>>

export const refundMethodLabelKey = {
  cashRegister: "paymentDetail.refunds.method.cashRegister",
  qerkoTerminal: "paymentDetail.refunds.method.qerkoTerminal",
  qerkoPayment: "paymentDetail.refunds.method.qerkoPayment",
  outside: "paymentDetail.refunds.method.outside",
} satisfies Record<RefundMethod, TranslationKey>

/**
 * The methods the refund dialog offers. A Qerko payment is not one of them:
 * Qerko refunds all of it or nothing, so it has a button of its own
 * (`deriveQerkoPaymentRefund`, qerko/0010).
 */
export type RefundDialogMethod = Exclude<RefundMethod, "qerkoPayment">

export const refundErrorKeys = {
  PaymentNotFound: "paymentDetail.notFound",
  RefundPaymentNotPaid: "refund.error.notPaid",
  RefundAmountInvalid: "refund.error.amount",
  RefundItemsUnavailable: "refund.error.items",
  RefundLineUnavailable: "refund.error.items",
  CashRegisterAccountNotFound: "refund.error.cashRegister",
} satisfies Record<RefundPaymentError["type"], TranslationKey>

export const tipRefundErrorKeys = {
  PaymentNotFound: "paymentDetail.notFound",
  RefundPaymentNotPaid: "refund.error.notPaid",
  RefundTipUnavailable: "refund.error.tip",
  CashRegisterAccountNotFound: "refund.error.cashRegister",
} satisfies Record<RefundPaymentTipError["type"], TranslationKey>

/**
 * The method a refund starts on: the cash register when the payment took
 * cash, the terminal when it took the card there and the card can be
 * refunded from this device (qerko/0004).
 */
export const defaultRefundMethod = (
  paymentMethodKinds: ReadonlyArray<string>,
  { qerkoRefundable = false }: { readonly qerkoRefundable?: boolean } = {}
): RefundDialogMethod =>
  paymentMethodKinds.includes("cashRegister")
    ? "cashRegister"
    : qerkoRefundable && paymentMethodKinds.includes("qerkoTerminal")
      ? "qerkoTerminal"
      : "outside"

/**
 * How a failed card refund reads: the refund's own checks, what is specific to
 * the terminal, and for the rest (offline, a refusal to start) the payment's
 * wording.
 */
const qerkoRefundNotStartedKeys = {
  terminalNotActivated: "refund.qerko.error.terminalNotActivated",
  unknownTerminal: "refund.qerko.error.unknownTerminal",
  terminalNotConnected: "refund.qerko.error.terminalNotConnected",
} satisfies Partial<Record<QerkoNotStartedReason, TranslationKey>>

export const describeQerkoRefundError = (error: {
  readonly type: string
  readonly reason?: string
}): TranslationKey => {
  const refundKeys: Record<string, TranslationKey | undefined> = {
    ...refundErrorKeys,
    ...tipRefundErrorKeys,
    QerkoRefundNotAvailable: "refund.qerko.error.notAvailable",
    QerkoRefundAttemptRunning: "refund.qerko.error.running",
  }
  // The terminal cannot be swapped for a refund, so the payment's wording
  // ("choose it again in the settings") would send staff the wrong way.
  if (error.type === "QerkoTerminalRefundNotStarted") {
    const key = (
      qerkoRefundNotStartedKeys as Record<string, TranslationKey | undefined>
    )[error.reason ?? ""]
    if (key !== undefined) return key
  }
  if (error.type === "QerkoTerminalRefundFailed") {
    return error.reason === "cancelled"
      ? "refund.qerko.failed.cancelled"
      : "refund.qerko.failed.declined"
  }
  return refundKeys[error.type] ?? describeQerkoPaymentError(error)
}

/**
 * The whole amount a Qerko payment's refund returns, or `null` when it cannot
 * be offered (qerko/0010): the payment was not paid through Qerko, or part of
 * it is refunded already, which a refund of all of it would refund again.
 */
export const deriveQerkoPaymentRefund = ({
  hasPaidQerkoAttempt,
  isPaid,
  refunds,
  refundableAmount,
  refundableTipAmount,
}: {
  readonly hasPaidQerkoAttempt: boolean
  readonly isPaid: boolean
  readonly refunds: ReadonlyArray<unknown>
  readonly refundableAmount: NonNegativeInteger
  readonly refundableTipAmount: NonNegativeInteger
}): NonNegativeInteger | null =>
  hasPaidQerkoAttempt && isPaid && refunds.length === 0
    ? NonNegativeInteger(refundableAmount + refundableTipAmount)
    : null

export const qerkoPaymentRefundErrorKeys = {
  PaymentNotFound: "paymentDetail.notFound",
  RefundPaymentNotPaid: "refund.error.notPaid",
  RefundAmountInvalid: "refund.error.amount",
  RefundItemsUnavailable: "refund.error.items",
  RefundLineUnavailable: "refund.error.items",
  RefundTipUnavailable: "refund.error.tip",
  QerkoPaymentRefundNotAvailable: "refund.qerkoPayment.error.notAvailable",
  QerkoPaymentRefundNotCancelled: "refund.qerkoPayment.error.notCancelled",
  QerkoPluginNotPaired: "paymentWait.qerko.error.notPaired",
  QerkoHttpError: "refund.qerkoPayment.error.unreachable",
  QerkoApiError: "refund.qerkoPayment.error.unreachable",
  FetchError: "refund.qerkoPayment.error.unreachable",
} satisfies Record<RefundQerkoPaymentError["type"], TranslationKey>

/**
 * What a payment's refund panel offers (refund/0002, 0004, 0005): the limit of
 * goods left, the tip left, and the lines that may be refunded one by one,
 * which is none unless the payment is its bill's only one.
 */
export const deriveRefundAvailability = ({
  payment,
  excess,
  isPaid,
  refunds,
  refundLines,
  paymentLines,
  hasOtherClaimedPayment,
}: {
  readonly payment: {
    readonly billId: BillId | null
    readonly amount: NonNegativeInteger
    readonly tipAmount: NonNegativeInteger
    readonly currency: FiatCurrency
    readonly cashReceivedAmount: NonNegativeInteger | null
  }
  readonly excess: NonNegativeInteger
  readonly isPaid: boolean
  readonly refunds: ReadonlyArray<{
    readonly amount: NonNegativeInteger
    readonly isTip: typeof sqliteTrue | null
  }>
  readonly refundLines: Parameters<typeof deriveRefundableLines>[1]
  readonly paymentLines: ReadonlyArray<RefundablePaymentLine>
  readonly hasOtherClaimedPayment: boolean
}) => {
  const refundableAmount = deriveRefundableAmount({ ...payment, excess })
  const remainingAmount = NonNegativeInteger(
    Math.max(0, refundableAmount - sumGoodsRefundAmounts(refunds))
  )
  const refundableTipAmount = deriveRefundableTipAmount({
    ...payment,
    refunds,
  })
  const refundableLines =
    payment.billId === null || hasOtherClaimedPayment
      ? []
      : deriveRefundableLines(paymentLines, refundLines)

  return {
    refundableAmount,
    remainingAmount,
    refundableTipAmount,
    refundableLines,
    canRefund: isPaid && remainingAmount > 0,
    canRefundTip: isPaid && refundableTipAmount > 0,
  }
}

/** The amount field's text: what staff typed, else the prefill for the method (refund/0005, 0006). */
export const deriveRefundAmountText = ({
  typedAmountText,
  remainingAmount,
  excess,
  method,
  currency,
}: {
  readonly typedAmountText: string | null
  readonly remainingAmount: NonNegativeInteger
  readonly excess: NonNegativeInteger
  readonly method: RefundMethod
  readonly currency: FiatCurrency
}): string =>
  typedAmountText ??
  minorUnitsToDecimalString({
    value: deriveRefundPrefillAmount({
      remainingAmount,
      excess,
      method,
      currency,
    }),
    currency,
  })

export interface ChosenRefundLine {
  readonly paymentLineId: PaymentLineId
  readonly quantity: PositiveNumber
  readonly amount: NonNegativeInteger
}

/**
 * The exact amount a form would refund, or `null` while it is not valid:
 * a typed amount above what is left, or no chosen items. The confirm
 * button shows this amount, so staff see exactly what is recorded.
 */
export const deriveRefundForm = ({
  mode,
  amountText,
  quantities,
  refundableLines,
  remainingAmount,
  currency,
}: {
  readonly mode: RefundMode
  readonly amountText: string
  readonly quantities: RefundQuantities
  readonly refundableLines: ReadonlyArray<RefundableLine<RefundablePaymentLine>>
  readonly remainingAmount: NonNegativeInteger
  readonly currency: FiatCurrency
}) => {
  const parsedAmount = decimalAmountToMinorUnits({
    currency,
    value: amountText,
  })
  const typedAmount =
    parsedAmount === null || parsedAmount > remainingAmount
      ? null
      : NonNegativeInteger(parsedAmount)
  const chosenLines = refundableLines.flatMap(
    (refundable): ChosenRefundLine[] => {
      const quantity = quantities[refundable.line.id] ?? 0
      return quantity > 0
        ? [
            {
              paymentLineId: refundable.line.id,
              quantity: PositiveNumber(quantity),
              amount: calculateRefundLineAmount(refundable, quantity),
            },
          ]
        : []
    }
  )
  const itemsAmount = sumRefundAmounts(chosenLines)
  const refundAmount =
    mode === "amount"
      ? typedAmount
      : itemsAmount > 0 && itemsAmount <= remainingAmount
        ? itemsAmount
        : null

  return { typedAmount, chosenLines, refundAmount }
}

/** One step of an item's quantity, kept between 0 and what is left to refund. */
export const stepRefundQuantity = (
  quantities: RefundQuantities,
  refundable: Pick<
    RefundableLine<{ readonly id: PaymentLineId }>,
    "line" | "remainingQuantity"
  >,
  step: 1 | -1
): RefundQuantities => {
  const current = quantities[refundable.line.id] ?? 0
  const next =
    step === 1
      ? Math.min(refundable.remainingQuantity, current + 1)
      : Math.max(0, current - 1)
  return { ...quantities, [refundable.line.id]: next }
}
