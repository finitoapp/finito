import { createPaymentErrorKeys } from "@payky/app-shared/bill-checkout"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { createPreparedPayment } from "@payky/core/modules/payment/payment-preparation-actions"
import type {
  FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { router } from "expo-router"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback } from "react"
import { accountAtom } from "../atoms/account.ts"
import { terminalAmountInputAtom } from "../atoms/terminal-amount.ts"
import { nativeConsole } from "../core/native-runtime.ts"
import { isSwitchioSupported } from "../platform/switchio.ts"
import { usePreloadPaymentWait } from "./use-preload-payment-wait.ts"
import { useRunToast } from "./use-run-toast.ts"

/**
 * Prepares a payment and opens it, as web's `useCreateTerminalPayment`:
 * failure is logged and toasted here, not signalled back. The route gate
 * already requires `sell` (access/0002), as on web. A payment without a
 * bill charges what home's keypad holds (directly or through the tip
 * screen), so creating one clears that amount, as on web; until then it
 * survives leaving home. `fromTipScreen` replaces the tip screen, as on
 * web, so back from the payment never lands where one tap pays again.
 */
export function useCreateTerminalPayment() {
  const runToast = useRunToast()
  const { device } = useAtomValue(accountAtom)
  const setTerminalAmountInput = useSetAtom(terminalAmountInputAtom)
  const preloadPaymentWait = usePreloadPaymentWait()

  return useCallback(
    async ({
      amount,
      currency,
      tipAmount,
      billId = null,
      fromTipScreen = false,
    }: {
      readonly amount: NonNegativeInteger
      readonly currency: FiatCurrency
      readonly tipAmount: NonNegativeInteger
      readonly billId?: BillId | null
      readonly fromTipScreen?: boolean
    }): Promise<boolean> =>
      // `true` once it left for the payment's screen.
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
            cardTerminalLinked: isSwitchioSupported(),
          })
        )

        if (!result.ok) {
          nativeConsole.error("Failed to create prepared payment", result.error)
          return createPaymentErrorKeys[result.error.type]
        }

        preloadPaymentWait(result.value)
        if (billId === null) setTerminalAmountInput("")
        const leave = fromTipScreen ? router.replace : router.push
        leave({
          pathname: "/payment/[paymentId]",
          params: { paymentId: result.value },
        })
      }),
    [device.id, preloadPaymentWait, runToast, setTerminalAmountInput]
  )
}
