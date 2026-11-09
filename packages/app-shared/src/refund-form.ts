import type { sqliteTrue } from "@evolu/common"
import { describeQerkoPaymentError } from "@payky/app-shared/qerko-terminal-flow"
import type { QerkoNotStartedReason } from "@payky/core/integrations/qerko/qerko-client"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { ItemLineType } from "@payky/core/modules/item/item-types"
import type { PaymentLineId } from "@payky/core/modules/payment-line/payment-line-types"
import type {
  RefundPaymentError,
  RefundPaymentTipError,
  RefundWholePaymentError,
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
  cardSwitchio: "paymentDetail.refunds.method.cardSwitchio",
  outside: "paymentDetail.refunds.method.outside",
} satisfies Record<RefundMethod, TranslationKey>

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

export const wholeRefundErrorKeys = {
  PaymentNotFound: "paymentDetail.notFound",
  RefundPaymentNotPaid: "refund.error.notPaid",
  RefundAmountInvalid: "refund.error.amount",
  CashRegisterAccountNotFound: "refund.error.cashRegister",
} satisfies Record<RefundWholePaymentError["type"], TranslationKey>

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

/**
 * What the refund screen gives back: everything left, goods and tip (`whole`);
 * goods only, by amount or items (`part`, refund/0011, 0005); or the whole tip
 * alone (`tip`).
 */
export type RefundChoice = "whole" | "part" | "tip"

/** How the refund screen names each of its choices. */
export const refundChoiceLabelKey = {
  whole: "refund.page.choice.whole",
  part: "refund.page.choice.part",
  tip: "refund.page.choice.tip",
} satisfies Record<RefundChoice, TranslationKey>

/**
 * How the refund screen names each method; the Qerko terminal's names the
 * terminal too where the payment recorded it
 * (`refund.dialog.method.qerkoTerminalTid`).
 */
export const refundOptionMethodLabelKey = {
  cardSwitchio: "refund.dialog.method.cardSwitchio",
  qerkoTerminal: "refund.dialog.method.qerkoTerminal",
  qerkoPayment: "refund.page.method.qerkoPayment",
  cashRegister: "refund.dialog.method.cashRegister",
  outside: "refund.dialog.method.outside",
} satisfies Record<RefundMethod, TranslationKey>

export interface RefundChoiceOption {
  readonly choice: RefundChoice
  /**
   * What the choice returns: for `whole` the goods left and the tip, for
   * `part` the most it may (the goods left), for `tip` the tip.
   */
  readonly amount: NonNegativeInteger
  /** The tip `whole` returns beside the goods, 0 when none is left. */
  readonly tipAmount: NonNegativeInteger
}

export interface RefundOptions {
  /** The choices the payment allows, `whole` first. Empty when none. */
  readonly choices: ReadonlyArray<RefundChoiceOption>
  /** The methods each choice allows; empty for a choice not offered. */
  readonly methods: Readonly<Record<RefundChoice, ReadonlyArray<RefundMethod>>>
  /** How `part` may be given: items only from a bill's only payment (refund/0002). */
  readonly partModes: ReadonlyArray<RefundMode>
  readonly defaultChoice: RefundChoice | null
  readonly defaultMethod: RefundMethod | null
}

/** The order the methods are offered in: the card first, as the payment came. */
const refundMethodOrder = [
  "cardSwitchio",
  "qerkoTerminal",
  "qerkoPayment",
  "cashRegister",
  "outside",
] as const satisfies ReadonlyArray<RefundMethod>

/** The account kinds a payment came in by that a refund can go back through. */
const arrivalRefundMethods = [
  "cardSwitchio",
  "qerkoTerminal",
  "qerkoPayment",
  "cashRegister",
] as const satisfies ReadonlyArray<RefundMethod>

/**
 * What the refund screen offers for a payment, from what the payment detail
 * already reads: which of whole, part and tip are left, the methods each
 * allows, and where the screen starts.
 *
 * - `whole` while goods are left (or Qerko can still cancel the whole
 *   payment), with the tip if it was not refunded; `part` while goods are
 *   left; `tip` while the tip is (refund/0011). With only the tip left, only
 *   `tip` is offered.
 * - The cash register and outside the app suit every choice. A refund to the
 *   card through SwitchioPay (refund/0007, 0008) or the Qerko terminal
 *   (qerko/0004, 0006) suits every choice where this device can make it.
 *   A Qerko payment is refunded only whole, and only while nothing of it was
 *   refunded (qerko/0010).
 * - It starts on `whole`, by the method the payment came in (the card back to
 *   the card), else outside the app.
 */
export const deriveRefundOptions = ({
  paymentMethodKinds,
  availability,
  qerkoPaymentRefundable,
  qerkoTerminalRefundable,
  switchioRefundable,
}: {
  /** The kinds of the transactions that settled the payment. */
  readonly paymentMethodKinds: ReadonlyArray<string>
  readonly availability: Pick<
    ReturnType<typeof deriveRefundAvailability>,
    | "remainingAmount"
    | "refundableTipAmount"
    | "refundableLines"
    | "canRefund"
    | "canRefundTip"
  >
  /** Qerko can cancel the whole payment: `deriveQerkoPaymentRefund` is not `null`. */
  readonly qerkoPaymentRefundable: boolean
  /** The payment's card can go back through the Qerko terminal that took it. */
  readonly qerkoTerminalRefundable: boolean
  /**
   * The payment kept SwitchioPay's refund id (payment/0009) and this device
   * can run SwitchioPay.
   */
  readonly switchioRefundable: boolean
}): RefundOptions => {
  const {
    remainingAmount,
    refundableTipAmount,
    refundableLines,
    canRefund,
    canRefundTip,
  } = availability
  const tipLeft = canRefundTip ? refundableTipAmount : NonNegativeInteger(0)
  const offered = {
    whole: canRefund || qerkoPaymentRefundable,
    part: canRefund,
    tip: canRefundTip,
  } satisfies Record<RefundChoice, boolean>
  const choices = [
    {
      choice: "whole",
      amount: NonNegativeInteger(remainingAmount + tipLeft),
      tipAmount: tipLeft,
    },
    {
      choice: "part",
      amount: remainingAmount,
      tipAmount: NonNegativeInteger(0),
    },
    { choice: "tip", amount: tipLeft, tipAmount: tipLeft },
  ] satisfies ReadonlyArray<RefundChoiceOption>
  const allowed = {
    cardSwitchio: () => switchioRefundable,
    qerkoTerminal: () => qerkoTerminalRefundable,
    qerkoPayment: (choice) => choice === "whole" && qerkoPaymentRefundable,
    cashRegister: () => true,
    outside: () => true,
  } satisfies Record<RefundMethod, (choice: RefundChoice) => boolean>
  const methodsOf = (choice: RefundChoice): ReadonlyArray<RefundMethod> =>
    offered[choice]
      ? refundMethodOrder.filter((method) => allowed[method](choice))
      : []
  const methods = {
    whole: methodsOf("whole"),
    part: methodsOf("part"),
    tip: methodsOf("tip"),
  }

  const offeredChoices = choices.filter(({ choice }) => offered[choice])
  const defaultChoice = offeredChoices[0]?.choice ?? null
  const arrivedBy =
    defaultChoice === null
      ? undefined
      : arrivalRefundMethods.find(
          (method) =>
            paymentMethodKinds.includes(method) &&
            methods[defaultChoice].includes(method)
        )

  return {
    choices: offeredChoices,
    methods,
    partModes: refundableLines.length > 0 ? ["amount", "items"] : ["amount"],
    defaultChoice,
    defaultMethod:
      defaultChoice === null
        ? null
        : selectRefundMethod({
            options: { methods },
            choice: defaultChoice,
            method: arrivedBy ?? "outside",
          }),
  }
}

/**
 * The method to stay on when the choice changes: the current one while the
 * new choice allows it, else the first it allows (`null` when none).
 */
export const selectRefundMethod = ({
  options,
  choice,
  method,
}: {
  readonly options: Pick<RefundOptions, "methods">
  readonly choice: RefundChoice
  readonly method: RefundMethod
}): RefundMethod | null => {
  const methods = options.methods[choice]
  return methods.includes(method) ? method : (methods[0] ?? null)
}

const refundOutcomeKeys = {
  cardSwitchio: "refund.outcome.card",
  qerkoTerminal: "refund.outcome.card",
  qerkoPayment: "refund.outcome.qerkoPayment",
  cashRegister: "refund.outcome.cashRegister",
  outside: "refund.outcome.outside",
} satisfies Record<RefundMethod, TranslationKey>

/**
 * The one sentence under the refund form that says what confirming does.
 * A whole payment SwitchioPay can take back (`chooseSwitchioRefundKind`
 * says `reversal`, refund/0008) needs no card; any other card refund goes
 * back to the card that paid; cash names what to hand over; outside the app
 * is only recorded.
 */
export const describeRefundOutcome = ({
  choice,
  method,
  switchioRefundKind,
  amount,
}: {
  readonly choice: RefundChoice
  readonly method: RefundMethod
  /** What `chooseSwitchioRefundKind` chose, `null` when not asked. */
  readonly switchioRefundKind: "reversal" | "referralRefund" | null
  /** The amount refunded, formatted, which cash from the register names. */
  readonly amount: string
}): {
  readonly key: TranslationKey
  readonly params: { readonly amount: string }
} => ({
  key:
    method === "cardSwitchio" &&
    choice === "whole" &&
    switchioRefundKind === "reversal"
      ? "refund.outcome.reversal"
      : refundOutcomeKeys[method],
  params: { amount },
})
