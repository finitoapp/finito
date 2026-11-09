import {
  acknowledgePaymentExcessSettlement,
  confirmPaymentPaidDespiteCancellation,
} from "@payky/core/modules/payment/payment-actions"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { router } from "expo-router"
import { useState } from "react"
import { useRequirePermission } from "../../core/use-access.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"

/**
 * The actions that resolve a payment's two collisions, as web's
 * `payment-detail.tsx` does: marking a canceled-but-funded payment paid is
 * `sell`, acknowledging an excess settlement is `refund` (access/0002).
 * `refund` opens the refund screen on a part of the payment, which starts
 * on the money that came in on top (refund/0005); its route asks for
 * `refund`.
 */
export function usePaymentCollisionActions(paymentId: PaymentId) {
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const [resolvePending, setResolvePending] = useState(false)
  const [excessResolvePending, setExcessResolvePending] = useState(false)

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

  const acknowledgeExcess = async () => {
    if (!(await require("refund", "access.action.acknowledgeExcess"))) return
    setExcessResolvePending(true)
    await runToast(async (run) => {
      const result = await run(acknowledgePaymentExcessSettlement(paymentId))
      if (!result.ok) return "paymentDetail.excessCollision.acknowledge.error"
    })
    setExcessResolvePending(false)
  }

  const refund = () =>
    router.push({
      pathname: "/activity/[paymentId]/refund",
      params: { paymentId, choice: "part" },
    })

  return {
    resolvePending,
    excessResolvePending,
    confirmPaid,
    acknowledgeExcess,
    refund,
  }
}
