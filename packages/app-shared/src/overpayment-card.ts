import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import type {
  BillOverpayment,
  OverpaymentAnswer,
} from "@payky/core/modules/bill/bill-utils"
import type {
  RecordOverpaymentResolutionError,
  WithdrawOverpaymentResolutionError,
} from "@payky/core/modules/overpayment-resolution/overpayment-resolution-actions"
import { derivePaymentHasCancellationCollision } from "@payky/core/modules/payment/payment-status-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  decimalAmountToMinorUnits,
  minorUnitsToDecimalString,
} from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  NonNegativeInteger,
  PositiveInteger,
  type TimestampMs,
} from "@payky/core/modules/shared/schema"
import { paymentMethodLabelKey } from "./activity-labels.ts"
import { formatDateTime } from "./format-date.ts"
import type { TranslationKey } from "./i18n/resources.ts"
import type { createTranslate } from "./i18n/translate.ts"

type Translate = ReturnType<typeof createTranslate>

export interface OverpaymentCardPayment {
  readonly id: PaymentId
  readonly number: NonNegativeInteger | null
  readonly amount: NonNegativeInteger
  readonly methods: ReadonlyArray<AccountTransactionKind>
  readonly createdAt: string
  readonly canceledAt: TimestampMs | null
  readonly confirmedPaidAt: TimestampMs | null
}

export type Resolution = "tip" | "kept"

export const resolvableFrom = (
  overpayment: BillOverpayment,
  payment: OverpaymentCardPayment
): number =>
  Math.min(
    overpayment.unresolved,
    overpayment.roomByPayment.get(payment.id) ?? 0
  )

export const recordErrorKeys = {
  PaymentNotFound: "paymentDetail.notFound",
  PaymentCanceled: "overpayment.error.canceled",
  BillNotFound: "billDetail.notFound",
  OverpaymentResolutionAboveUnresolved: "overpayment.error.aboveUnresolved",
  OverpaymentResolutionAbovePayment: "overpayment.error.abovePayment",
} satisfies Record<RecordOverpaymentResolutionError["type"], TranslationKey>

export const withdrawErrorKeys = {
  OverpaymentResolutionNotFound: "overpayment.error.notFound",
  OverpaymentResolutionNotWithdrawable: "overpayment.error.notWithdrawable",
} satisfies Record<WithdrawOverpaymentResolutionError["type"], TranslationKey>

export const answerLabelKeys = {
  return: "overpayment.breakdown.return",
  tip: "overpayment.breakdown.tip",
  kept: "overpayment.breakdown.kept",
  acknowledgement: "overpayment.breakdown.acknowledgement",
} satisfies Record<OverpaymentAnswer["source"]["type"], TranslationKey>

export const resolutionKeys = {
  tip: {
    title: "overpayment.dialog.tip.title",
    consequence: "overpayment.dialog.tip.consequence",
    aboveRoom: "overpayment.dialog.amount.aboveTip",
    confirm: "overpayment.dialog.confirm.tip",
    confirmEmpty: "overpayment.dialog.confirmEmpty.tip",
    recorded: "overpayment.recorded.tip",
  },
  kept: {
    title: "overpayment.dialog.keep.title",
    consequence: "overpayment.dialog.keep.consequence",
    aboveRoom: "overpayment.dialog.amount.aboveKeep",
    confirm: "overpayment.dialog.confirm.keep",
    confirmEmpty: "overpayment.dialog.confirmEmpty.keep",
    recorded: "overpayment.recorded.keep",
  },
} satisfies Record<Resolution, Readonly<Record<string, TranslationKey>>>

export const partitionOverpaymentPayments = (
  overpayment: BillOverpayment,
  payments: ReadonlyArray<OverpaymentCardPayment>
) => {
  const collisions = payments.filter((payment) =>
    derivePaymentHasCancellationCollision({
      canceledAt: payment.canceledAt,
      confirmedPaidAt: payment.confirmedPaidAt,
      hasActiveClaim: true,
    })
  )
  const holding = payments.filter(
    (payment) => !collisions.some(({ id }) => id === payment.id)
  )
  const returnable = holding.filter(
    (payment) => resolvableFrom(overpayment, payment) > 0
  )
  return { collisions, holding, returnable }
}

export const deriveResolveForm = ({
  resolution,
  overpayment,
  payment,
  typedAmountText,
  amountLeft,
  guestLeftTip,
  pending,
  currency,
}: {
  readonly resolution: Resolution
  readonly overpayment: BillOverpayment
  readonly payment: OverpaymentCardPayment | null
  readonly typedAmountText: string | null
  readonly amountLeft: boolean
  readonly guestLeftTip: boolean
  readonly pending: boolean
  readonly currency: FiatCurrency
}) => {
  const room = payment === null ? 0 : resolvableFrom(overpayment, payment)
  const amountText =
    typedAmountText ??
    minorUnitsToDecimalString({ value: NonNegativeInteger(room), currency })
  const parsedAmount = decimalAmountToMinorUnits({
    currency,
    value: amountText,
  })
  const amount =
    parsedAmount === null || parsedAmount <= 0 || parsedAmount > room
      ? null
      : PositiveInteger(parsedAmount)
  const amountErrorKey:
    | (typeof resolutionKeys)[Resolution]["aboveRoom"]
    | "overpayment.dialog.amount.invalid"
    | null =
    !amountLeft || amount !== null
      ? null
      : parsedAmount !== null && parsedAmount > room
        ? resolutionKeys[resolution].aboveRoom
        : "overpayment.dialog.amount.invalid"
  return {
    room,
    amountText,
    amount,
    amountErrorKey,
    canConfirm:
      payment !== null &&
      amount !== null &&
      !pending &&
      (resolution === "kept" || guestLeftTip),
  }
}

export const paymentOptionLabel = ({
  payment,
  overpayment,
  locale,
  t,
  format,
  formatList,
}: {
  readonly payment: OverpaymentCardPayment
  readonly overpayment: BillOverpayment
  readonly locale: string
  readonly t: Translate
  readonly format: (value: number) => string
  readonly formatList: (items: ReadonlyArray<string>) => string
}): string => {
  const details = {
    method: formatList(
      [...new Set(payment.methods)].map((method) =>
        t(paymentMethodLabelKey[method])
      )
    ),
    amount: format(resolvableFrom(overpayment, payment)),
  }
  return payment.number === null
    ? t("overpayment.dialog.paymentOption.unnumbered", {
        ...details,
        time: formatDateTime(new Date(payment.createdAt), locale),
      })
    : t("overpayment.dialog.paymentOption", {
        ...details,
        number: payment.number,
      })
}
