import type { BillId } from "@payky/core/modules/bill/bill-types"
import { calculatePaymentAmounts } from "@payky/core/modules/payment/payment-tip-utils"
import type { Money } from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { atom } from "jotai"
import { useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { AmountKeypad } from "@/features/shared/amount-keypad.tsx"
import { useCreateTerminalPayment } from "@/hooks/use-create-terminal-payment.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

/**
 * The custom tip, typed on the keypad home charges from. The tip lives in an
 * atom of this screen's own, so leaving it forgets the tip and leaves home's
 * amount alone.
 */
export function PaymentCustomTipPage({
  amount,
  currency,
  billId,
}: {
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly billId: BillId | null
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const createTerminalPayment = useCreateTerminalPayment()
  const [tipInputAtom] = useState(() => atom(""))

  const handleContinue = async (tip: Money) => {
    await createTerminalPayment({
      ...calculatePaymentAmounts({
        amount,
        tipAmount: NonNegativeInteger(tip.value),
      }),
      currency,
      billId,
    })
  }

  return (
    <>
      <FadeHeader />

      <div className="flex h-full min-h-0 flex-col justify-between gap-6 px-4 pt-4">
        <section className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-md font-semibold tracking-tight">
            {t("paymentTip.custom.label")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("paymentTip.custom.orderTotal", {
              amount: formatMoney({ value: amount, currency }, locale),
            })}
          </p>
        </section>

        <AmountKeypad
          amountInputAtom={tipInputAtom}
          currency={currency}
          submitLabel={t("paymentTip.continue")}
          onCharge={handleContinue}
        />
      </div>
    </>
  )
}
