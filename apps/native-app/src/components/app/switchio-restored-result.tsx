import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { settleRestoredSwitchioCardPayment } from "@payky/core/modules/payment/payment-actions"
import type { SettleRestoredSwitchioCardPaymentError } from "@payky/core/modules/payment/payment-errors"
import { useAtomValue } from "jotai"
import { useCallback, useEffect } from "react"
import { AppState } from "react-native"
import { accountAtom } from "../../atoms/account.ts"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { takeRestoredSwitchioResult } from "../../platform/switchio.ts"
import { useLoadSwitchioResultOwner } from "./use-switchio-result-owner.ts"

const restoredErrorKeys = {
  SwitchioPaymentFailed: "paymentWait.cardPaid.error.declined",
  SwitchioUnavailable: "paymentWait.cardPaid.error.unavailable",
  SwitchioResultUnreadable: "paymentWait.cardPaid.restored.unresolved",
  SwitchioRestoredResultUnmatched: "paymentWait.cardPaid.restored.unresolved",
  PaymentNotFound: "paymentWait.cardPaid.restored.unresolved",
  CardSwitchioAccountNotFound: "paymentWait.cardPaid.restored.unresolved",
  AccountCurrencyMismatch: "paymentWait.cardPaid.restored.unresolved",
} satisfies Record<
  SettleRestoredSwitchioCardPaymentError["type"],
  TranslationKey
>

/**
 * Takes a SwitchioPay result that no promise is waiting for and settles it
 * through `settleRestoredSwitchioCardPayment`, whose guards make a repeated
 * result settle once. `MainActivity` stored it before any JS ran when Android
 * killed the app while the terminal was in the foreground. The result is
 * cleared as it is taken, so a failure to settle leaves the payment's own
 * unresolved marker, and a "verify in SwitchioPay" message, as the only trace.
 */
export function useSettleStoredSwitchioResult() {
  const appRun = useAppRun()
  const deviceId = useAtomValue(accountAtom).device.id
  const loadOwner = useLoadSwitchioResultOwner()
  const toast = useToast()
  const { t } = useTranslation()

  return useCallback(async (): Promise<void> => {
    const restored = takeRestoredSwitchioResult(await loadOwner())
    if (restored === null) return

    if (restored === "unusable") {
      nativeConsole.warn("[payment] Unusable restored Switchio result")
      toast.error(t("paymentWait.cardPaid.restored.unresolved"))
      return
    }

    await using run = appRun()
    const result = await run(
      settleRestoredSwitchioCardPayment({ restored, deviceId })
    )
    if (result.ok) {
      toast.success(t("paymentWait.cardPaid.restored.paid"))
    } else {
      nativeConsole.warn("[payment] Restored Switchio result", result.error)
      toast.error(t(restoredErrorKeys[result.error.type]))
    }
  }, [appRun, deviceId, loadOwner, toast, t])
}

/**
 * Settles a stored SwitchioPay result at start-up and whenever the app comes
 * back to the foreground (a result stored later, e.g. after a JS reload while
 * the process stayed alive, would otherwise wait for the next cold start), as
 * web's `SwitchioRestoredResult`. Without it a charged card would stay unpaid.
 */
export function SwitchioRestoredResult() {
  const settle = useSettleStoredSwitchioResult()

  useEffect(() => {
    void settle()
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void settle()
    })
    return () => subscription.remove()
  }, [settle])

  return null
}
