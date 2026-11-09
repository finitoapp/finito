import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { openCardSwitchioRefundAttemptsByDeviceIdQuery } from "@payky/core/modules/refund/refund-queries"
import {
  resolveCardSwitchioRefundAttempt,
  type SettleRestoredCardSwitchioRefundError,
  settleRestoredCardSwitchioRefund,
} from "@payky/core/modules/refund/refund-switchio-actions"
import type { CardSwitchioRefundAttemptId } from "@payky/core/modules/refund/refund-types"
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
  isSwitchioRefundInFlight,
  takeRestoredSwitchioRefundResult,
} from "../../platform/switchio.ts"
import { useLoadSwitchioResultOwner } from "./use-switchio-result-owner.ts"

const restoredRefundErrorKeys = {
  CardSwitchioRefundDeclined: "refund.switchio.failed",
  CardSwitchioReversalDeclined: "refund.switchio.reversalDeclined.title",
  SwitchioRefundNotStarted: "refund.switchio.error.notStarted",
  SwitchioUnavailable: "paymentWait.cardPaid.error.unavailable",
  CardSwitchioRefundAttemptNotFound: "refund.switchio.restored.unusable",
} satisfies Record<
  SettleRestoredCardSwitchioRefundError["type"],
  TranslationKey
>

/**
 * Settles what became of this phone's refunds to the card through
 * SwitchioPay when no promise is waiting for them (refund/0007), at start-up
 * and whenever the app comes back to the foreground:
 *
 * - a result `MainActivity` stored when Android killed the app while
 *   SwitchioPay was in front;
 * - then each attempt of this phone still pending, which nothing will answer
 *   any more, is asked of the terminal once per run. Asking opens
 *   SwitchioPay, whose return brings the app to the foreground again, so an
 *   attempt is never asked twice here; an unknown one is asked from its
 *   payment's detail.
 */
export function SwitchioRestoredRefund() {
  const appRun = useAppRun()
  const evolu = useAtomValue(evoluAtom)
  const deviceId = useAtomValue(accountAtom).device.id
  const loadOwner = useLoadSwitchioResultOwner()
  const toast = useToast()
  const { t } = useTranslation()
  const asked = useRef(new Set<CardSwitchioRefundAttemptId>())
  const running = useRef(false)

  const settle = useCallback(async (): Promise<void> => {
    if (running.current || isSwitchioRefundInFlight()) return
    running.current = true
    try {
      const restored = takeRestoredSwitchioRefundResult(await loadOwner())
      if (restored === "unusable") {
        nativeConsole.warn("[refund] Unusable restored Switchio refund result")
        toast.error(t("refund.switchio.restored.unusable"))
      } else if (restored !== null) {
        await using run = appRun()
        const result = await run(settleRestoredCardSwitchioRefund({ restored }))
        if (!result.ok) {
          nativeConsole.warn("[refund] Restored Switchio refund", result.error)
          toast.error(t(restoredRefundErrorKeys[result.error.type]))
        } else if (result.value.status === "refunded") {
          toast.success(t("refund.switchio.done"))
        } else if (result.value.status === "unresolved") {
          toast.error(t("refund.switchio.unresolved"))
        }
      }

      const pending = (
        await evolu.loadQuery(
          openCardSwitchioRefundAttemptsByDeviceIdQuery(deviceId)
        )
      ).filter(
        ({ id, status }) => status === "pending" && !asked.current.has(id)
      )
      for (const { id } of pending) {
        asked.current.add(id)
        await using run = appRun()
        const result = await run(
          resolveCardSwitchioRefundAttempt({ attemptId: id, deviceId })
        )
        // The attempts asked about are this phone's own, so the only
        // refusal, another phone's attempt, cannot come back here.
        if (result.ok && result.value.status === "refunded") {
          toast.success(t("refund.switchio.done"))
        } else if (result.ok && result.value.status === "unresolved") {
          toast.error(t("refund.switchio.unresolved"))
        }
      }
    } finally {
      running.current = false
    }
  }, [appRun, evolu, deviceId, loadOwner, toast, t])

  useEffect(() => {
    void settle()
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void settle()
    })
    return () => subscription.remove()
  }, [settle])

  return null
}
