import { closeZeroBillErrorKeys } from "@payky/app-shared/bill-checkout"
import { closeZeroBill } from "@payky/core/modules/bill/bill-actions"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { router } from "expo-router"
import { useRef, useState } from "react"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * Native counterpart of web's `useFinishBill`: the cart's Finish, which
 * stands in for Charge on a bill whose goods come to exactly zero
 * (`deriveBillCheckout`). It closes the bill without a payment
 * (`closeZeroBill`, payment/0013) and goes home, where a paid bill's success
 * screen leads too. Finishing is a sale, so it asks for `sell` itself
 * (payment/0013) rather than leaning on the cart's route gate.
 *
 * `closing` is true from the tap until the screen is left, through a
 * successful write: `BillPage` owns this hook, not the cart, so the closed
 * bill the write leaves behind shows no "bill closed" message on the way
 * home.
 */
export function useFinishBill(billId: BillId) {
  const { t } = useTranslation()
  const toast = useToast()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  // Closes the window before `pending` re-renders, as Charge's ref does.
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [finished, setFinished] = useState(false)

  const finish = async () => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    try {
      if (!(await require("sell", "access.action.finishBill"))) return
      await runToast(async (run) => {
        const result = await run(closeZeroBill(billId))
        if (!result.ok) {
          nativeConsole.error("Failed to finish the bill", result.error)
          return closeZeroBillErrorKeys[result.error.type]
        }

        setFinished(true)
        toast.success(t("bill.finish.done"))
        router.dismissTo("/")
      })
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return { finish, pending, closing: pending || finished }
}
