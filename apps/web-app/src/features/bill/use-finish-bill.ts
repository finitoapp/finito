import { closeZeroBillErrorKeys } from "@payky/app-shared/bill-checkout"
import { closeZeroBill } from "@payky/core/modules/bill/bill-actions"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The cart's Finish, which stands in for Charge on a bill whose goods come to
 * exactly zero (`deriveBillCheckout`): it closes the bill without a payment
 * (`closeZeroBill`, payment/0013) and goes home, where a paid bill's success
 * screen leads too.
 *
 * Finishing is a sale, so it asks for `sell` itself (payment/0013) rather
 * than leaning on the cart's route gate. The ref closes the window before
 * `pending` re-renders, as Charge's does.
 *
 * `closing` is true from the tap until the screen is left, through a
 * successful write: `BillPage` owns this hook, not the cart, so the closed
 * bill the write leaves behind shows nothing rather than flashing the "bill
 * closed" message on the way home.
 */
export function useFinishBill(billId: BillId) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const runToast = useRunToast()
  const console = useConsole()
  const { require } = useRequirePermission()
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
          console.error("Failed to finish the bill", result.error)
          return closeZeroBillErrorKeys[result.error.type]
        }

        setFinished(true)
        toast.success(t("bill.finish.done"))
        await navigate({ to: "/" })
      })
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return { finish, pending, closing: pending || finished }
}
