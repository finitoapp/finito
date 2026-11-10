import {
  announceGuestMoney,
  guestMoneyArrivalMessage,
} from "@payky/app-shared/guest-money-arrival"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { paymentsWithClaimsByBillIdQuery } from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { useEffect, useRef, useState } from "react"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import type { useBillStatus } from "../shared/use-bill-state.ts"

/** As web's `useGuestMoneyArrivals`. */
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
  const toast = useToast()
  const payments = useEvoluQuery(paymentsWithClaimsByBillIdQuery(billId)).data
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
  }, [payments, billStatus, currency, locale, t, toast])

  return {
    guestsClosedBill: guestsClosedBill && billStatus?.status === "closed",
  }
}
