import { confirmPaymentPaidDespiteCancellation } from "@payky/core/modules/payment/payment-actions"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { router } from "expo-router"
import { useState } from "react"
import { useRequirePermission } from "../../core/use-access.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"

/**
 * The actions that resolve a payment's collision, as web's
 * `payment-detail.tsx` does: marking a canceled-but-funded payment paid is
 * `sell` (access/0002). `refund` opens the refund screen, which starts on
 * the money above the bill when the payment can return some (refund/0014);
 * its route asks for `refund`.
 */
export function usePaymentCollisionActions(paymentId: PaymentId) {
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const [resolvePending, setResolvePending] = useState(false)

  const confirmPaid = async () => {
    if (
      !(await require("sell", "access.action.confirmPaidDespiteCancellation"))
    )
      return
    setResolvePending(true)
    await runToast(async (run) => {
      const result = await run(confirmPaymentPaidDespiteCancellation(paymentId))
      if (!result.ok) return "paymentDetail.collision.markPaid.error"
    })
    setResolvePending(false)
  }

  const refund = () =>
    router.push({
      pathname: "/activity/[paymentId]/refund",
      params: { paymentId, choice: "overpayment" },
    })

  return {
    resolvePending,
    confirmPaid,
    refund,
  }
}
