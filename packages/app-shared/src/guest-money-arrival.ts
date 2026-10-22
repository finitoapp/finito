import type { InferRow } from "@evolu/common"
import type { BillStatus } from "@payky/core/modules/bill/bill-types"
import type { paymentsWithClaimsByBillIdQuery } from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type { Money } from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import type { createTranslate } from "./i18n/translate.ts"

type BillPaymentRow = InferRow<
  ReturnType<typeof paymentsWithClaimsByBillIdQuery>
>

export type GuestMoneyArrival =
  | { readonly type: "closed" }
  | {
      readonly type: "arrived"
      readonly paid: NonNegativeInteger
      readonly remaining: NonNegativeInteger
    }

export const announceGuestMoney = (
  announced: ReadonlySet<PaymentId> | null,
  payments: ReadonlyArray<
    Pick<
      BillPaymentRow,
      "id" | "amount" | "tipAmount" | "selfPayId" | "claimedTransactions"
    >
  >,
  billStatus:
    | { readonly status: BillStatus; readonly amountDue: NonNegativeInteger }
    | undefined
): {
  readonly announced: ReadonlySet<PaymentId>
  readonly arrival: GuestMoneyArrival | undefined
} => {
  const guestPayments = payments.filter(
    (payment) =>
      payment.selfPayId !== null && payment.claimedTransactions.length > 0
  )
  const nowAnnounced = new Set(guestPayments.map(({ id }) => id))
  const arrived =
    announced === null
      ? []
      : guestPayments.filter(({ id }) => !announced.has(id))

  if (
    arrived.length === 0 ||
    billStatus === undefined ||
    billStatus.status === "canceled"
  ) {
    return { announced: nowAnnounced, arrival: undefined }
  }
  if (billStatus.status === "closed") {
    return { announced: nowAnnounced, arrival: { type: "closed" } }
  }

  return {
    announced: nowAnnounced,
    arrival: {
      type: "arrived",
      paid: NonNegativeInteger(
        arrived.reduce(
          (sum, payment) => sum + payment.amount - payment.tipAmount,
          0
        )
      ),
      remaining: billStatus.amountDue,
    },
  }
}

export const guestMoneyArrivalMessage = (
  arrival: GuestMoneyArrival,
  currency: FiatCurrency,
  t: ReturnType<typeof createTranslate>,
  formatAmount: (money: Money) => string
): string =>
  arrival.type === "closed"
    ? t("bill.guestMoney.closed")
    : t("bill.guestMoney.arrived", {
        paid: formatAmount({ value: arrival.paid, currency }),
        remaining: formatAmount({ value: arrival.remaining, currency }),
      })
