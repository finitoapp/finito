import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  resolveSwitchioCardPayment,
  settleRestoredSwitchioCardPayment,
} from "@payky/core/modules/payment/payment-actions"
import type { SettleRestoredSwitchioCardPaymentError } from "@payky/core/modules/payment/payment-errors"
import { unresolvedCardSwitchioPaymentsByDeviceIdQuery } from "@payky/core/modules/payment/payment-queries"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { AppState } from "react-native"
import { accountAtom } from "../../atoms/account.ts"
import { evoluAtom } from "../../atoms/evolu.ts"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import {
  isSwitchioPaymentInFlight,
  takeRestoredSwitchioResult,
} from "../../platform/switchio.ts"
import { useLoadSwitchioResultOwner } from "./use-switchio-result-owner.ts"

const restoredErrorKeys = {
  SwitchioPaymentFailed: "paymentWait.cardPaid.error.declined",
  SwitchioUnavailable: "paymentWait.cardPaid.error.unavailable",
  SwitchioLaunchRefused: "paymentWait.cardPaid.restored.unresolved",
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
 * Asks this device's SwitchioPay about each card payment whose last attempt
 * went to it and whose outcome is still unknown (payment/0019), and records
 * the ones it approved as paid. Each attempt is asked once per run: asking
 * opens SwitchioPay, whose return brings the app to the foreground again, so
 * asking on every return would never end. Staff can ask again from the
 * payment's card tab. Nothing while a payment or a lookup waits on
 * SwitchioPay: that attempt is answered by its own promise.
 */
function useAskAboutUnresolvedSwitchioPayments() {
  const appRun = useAppRun()
  const evolu = useAtomValue(evoluAtom)
  const deviceId = useAtomValue(accountAtom).device.id
  const toast = useToast()
  const { t } = useTranslation()
  const asked = useRef(new Set<string>())

  return useCallback(async (): Promise<void> => {
    if (isSwitchioPaymentInFlight()) return
    const unresolved = (
      await evolu.loadQuery(
        unresolvedCardSwitchioPaymentsByDeviceIdQuery(deviceId)
      )
    ).filter(
      ({ unresolvedTransactionId }) =>
        !asked.current.has(unresolvedTransactionId)
    )
    for (const { id, unresolvedTransactionId } of unresolved) {
      asked.current.add(unresolvedTransactionId)
      await using run = appRun()
      const result = await run(
        resolveSwitchioCardPayment({ paymentId: id, deviceId })
      )
      if (!result.ok) {
        nativeConsole.warn("[payment] Asking SwitchioPay", result.error)
      } else if (result.value.status === "paid") {
        toast.success(t("paymentWait.cardPaid.check.paid"))
      }
    }
  }, [appRun, evolu, deviceId, toast, t])
}

/**
 * Settles a stored SwitchioPay result at start-up and whenever the app comes
 * back to the foreground (a result stored later, e.g. after a JS reload while
 * the process stayed alive, would otherwise wait for the next cold start), as
 * web's `SwitchioRestoredResult`. Without it a charged card would stay unpaid.
 * Then asks SwitchioPay about the payments whose outcome is still unknown
 * (payment/0019), which web cannot.
 */
export function SwitchioRestoredResult() {
  const settle = useSettleStoredSwitchioResult()
  const ask = useAskAboutUnresolvedSwitchioPayments()
  const running = useRef(false)

  useEffect(() => {
    const settleThenAsk = async () => {
      if (running.current) return
      running.current = true
      try {
        await settle()
        await ask()
      } finally {
        running.current = false
      }
    }
    void settleThenAsk()
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void settleThenAsk()
    })
    return () => subscription.remove()
  }, [settle, ask])

  return null
}
