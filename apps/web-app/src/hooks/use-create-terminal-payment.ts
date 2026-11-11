import { createPaymentErrorKeys } from "@payky/app-shared/bill-checkout"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { createPreparedPayment } from "@payky/core/modules/payment/payment-preparation-actions"
import type {
  FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { useNavigate } from "@tanstack/react-router"
import { useStore } from "jotai"
import { useCallback } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { terminalAmountInputAtom } from "@/atoms/terminal-amount.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { isCardTerminalLinked } from "@/platform/switchio.ts"

/**
 * Prepares a payment and navigates to it. Failure is logged and toasted here
 * rather than signalled back: all three callers wanted the same toast, so the
 * boolean bought nothing and a fourth caller forgetting to check it would have
 * failed silently.
 *
 * A payment without a bill charges what home's keypad holds (directly or
 * through the tip screen), so creating one clears that amount for the next
 * customer; until then it survives leaving home.
 */
export function useCreateTerminalPayment() {
  const runToast = useRunToast()
  const console = useConsole()
  const navigate = useNavigate()
  const jotaiStore = useStore()

  return useCallback(
    async ({
      amount,
      currency,
      tipAmount,
      billId = null,
    }: {
      readonly amount: NonNegativeInteger
      readonly currency: FiatCurrency
      readonly tipAmount: NonNegativeInteger
      readonly billId?: BillId | null
    }): Promise<void> => {
      const { device } = await jotaiStore.get(accountAtom)

      await runToast(async (run) => {
        const result = await run(
          createPreparedPayment({
            deviceId: device.id,
            billId,
            tableId: null,
            amount,
            currency,
            tipAmount,
            canceledAt: null,
            cardTerminalLinked: isCardTerminalLinked(),
          })
        )

        if (!result.ok) {
          console.error("Failed to create prepared payment", result.error)
          return createPaymentErrorKeys[result.error.type]
        }

        if (billId === null) jotaiStore.set(terminalAmountInputAtom, "")
        await navigate({
          to: "/payment/$paymentId",
          params: {
            paymentId: result.value,
          },
        })
      })
    },
    [console, jotaiStore, navigate, runToast]
  )
}
