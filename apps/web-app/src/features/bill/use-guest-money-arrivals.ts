import {
  announceGuestMoney,
  guestMoneyArrivalMessage,
} from "@payky/app-shared/guest-money-arrival"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { paymentsWithClaimsByBillIdQuery } from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { useBillStatus } from "@/features/shared/use-bill-status.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

export function useGuestMoneyArrivals({
  billId,
  billStatus,
  currency,
}: {
  readonly billId: BillId
  readonly billStatus: ReturnType<typeof useBillStatus>
  readonly currency: FiatCurrency
}): { readonly guestsClosedBill: boolean } {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: payments } = useEvoluQuery(
    paymentsWithClaimsByBillIdQuery(billId)
  )
  const announcedRef = useRef<ReadonlySet<PaymentId> | null>(null)
  const [guestsClosedBill, setGuestsClosedBill] = useState(false)

  useEffect(() => {
    const { announced, arrival } = announceGuestMoney(
      announcedRef.current,
      payments,
      billStatus
    )
    announcedRef.current = announced
    if (arrival === undefined) {
      return
    }

    if (arrival.type === "closed") {
      setGuestsClosedBill(true)
    }
    toast.success(
      guestMoneyArrivalMessage(arrival, currency, t, (money) =>
        formatMoney(money, locale)
      )
    )
  }, [payments, billStatus, currency, locale, t])

  return {
    guestsClosedBill: guestsClosedBill && billStatus?.status === "closed",
  }
}
